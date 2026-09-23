# @gw/dsh-text-inject · 现状梳理 / 问题诊断 / 重做方案

> 面向 v2 重做的调研底稿。所有结论都对着本机 `~/.dsh/profiles/node_modules/@deepseek-ai/*`
> 的**实际源码**和 typert 类型声明核过，不是凭印象。

---

## 一、现状梳理（v1 做了什么）

### 1.1 一句话

在 dsh 官方**设置页左侧栏**注册一个「文字注入」分区，把文本分别注入到
**系统提示词**（`[system]` 块，每轮生效）或**会话上下文**（`[context]` 块，合成一条 user 消息）。
内容写在独立文件 `~/.dsh/text-inject/inject.md`，改文件即热加载，每次保存自动备份。

### 1.2 运行链路

```
inject.md ──► parser.js ──┬─► host: ctx.systemPrompt.section()       [system 块]
                          └─► host: agent/pre-step → 追加 user 消息   [context 块]

client: settings.section(id=gw-text-inject, order=60)
        └─► 同源 fetch /gw-text-inject/* ──► host: webServer prefix 路由 ──► history/
```

### 1.3 文件清单（v1 实测大小）

| 文件 | 大小 | 职责 |
|---|---|---|
| `lib/index.js` | 12 937 B | host 半：注入 + 热加载 + webServer 数据通道 + 备份 |
| `lib/client.js` | 27 797 B | client 半：设置页 UI（lazy-CJS bundle） |
| `lib/parser.js` | 3 580 B | `inject.md` 的纯解析 / 序列化（零依赖） |
| `inject.md` | 849 B | 数据文件种子模板 |
| `cordis.patch.yml` | 583 B | loader 入口（一条 insert） |
| `package.json` | 1 326 B | npm 元数据 + `dsh.bundle.patch` + `dsh.client` |

### 1.4 数据文件格式

块头 `## [system] 名称` / `## [context] 名称`（大小写不敏感）；
元数据只认 `order` / `kind` / `trigger` / `enabled`，**英文冒号**，必须紧跟块头；
首个「非元数据非空行」之后全是正文 —— 因此正文里的「中文：」不会被误解析。
`[context]` 块必须有 `kind`（去重键）；`trigger` 留空 = 每轮注入；`enabled: false` 临时禁用。

> 这个「元数据段 → 正文」的切分规则设计得不错，v2 保留。

---

## 二、问题诊断

### P0-1 注入消息的 `source` 不在官方枚举里

v1（`lib/index.js`）：

```js
{ id: randomUUID(), role: "user", content: [...], source: { kind: b.kind } }   // kind = 'gw-project'
```

而官方 `@deepseek-ai/dsh-llm` 的 `MessageSourceMap` / `ContextFormed` 是封闭联合：

```ts
type ContextFormed =
  | { form?: never } | { form: 'instructions' } | { form: 'catalog' }
  | { form: 'snapshot'; sections: ContextSnapshotSection[] }
  | { form: 'notice'; summary: string } | { form: 'relay' } | { form: 'recall' };

// plugin 来源必须自带 plugin 字段
{ kind: 'plugin'; plugin: string } & ContextFormed
```

官方范例 `@deepseek-ai/dsh-time-context`：

```js
ctx.on("agent/pre-step", async ({agent, turn, step, signal}, next) => {
  const decision = await next();
  ...
  return { ...decision, messages: [...decision.messages, createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: "plugin", plugin: name, form: "snapshot", sections: [{ name, text }] },
  })] };
}, { prepend: true });
```

**结论**：v1 的游离 kind 属协议层错误 → v2 照抄 `kind:'plugin' + form:'snapshot' + sections`，
并且用 `createUserMessage()` 而不是手搓对象。

### P0-2 没有预览

整份 UI 都在「写」，没有一处告诉你「写完后模型看到了什么」。
host 侧本来就能 `ctx.systemPrompt.assemble()` 拿到**真实装配结果**，把它做成只读路由即可。
这是「不太好用」的第一感受来源。

### P1-1 去重逻辑跨轮必然失效

```js
const msgs = decision.messages;                        // 只是本轮新消息，不是会话历史
const kinds = new Set(msgs.map(m => m.source.kind));
if (kinds.has(b.kind)) continue;                       // 跨轮永远 has 不到
```

只要 trigger 命中，同一块每轮都注一条 → token 持续增长。
正解：官方 `dsh-time-context` / `dsh-agent-instructions` 都用
`ctx.sessionProjections.register({ key, stateVersion, stateSchema, init, apply })`
维护跨轮状态。v2 用它记录「本会话已注入过哪些块」。

### P1-2 `[system]` 段硬套 32 个短横线

```js
text: `\n\n${"-".repeat(32)}\n${b.body}\n${"-".repeat(32)}`
```

装饰符原样进提示词。框架 `renderPrompt()` 本来就用 `"\n\n"` join 各段 → v2 直接用原文。

### P1-3 `fs.watch` 盯的是单个文件

多数编辑器保存是「写临时文件 → 替换」，文件被替换后 Windows 上原 watch 句柄静默失效，热加载失灵。
→ v2 盯**目录**并过滤目标文件名。

### P2

- `config` 没有 Schemastery schema（传数字/空串/非法路径都不报错）。官方约定：非法配置应在加载时大声报错。
- `POST /save` 不校验块结构，畸形块会被写成半截 markdown 落盘。
- 历史只有堆叠：不能 diff、不能命名、恢复是看不见后果的直接覆盖。
- `order` 是裸数字，用户不知道官方段序列、也不知道 40 落在哪。
- 变量 `{{provider}}` / `{{model}}` / `{{cwd}}`（官方 `dsh-agent-loop` 注册的）没被支持也没提示。
- 报错只写 `console.warn`，界面上看不见。

---

## 三、目标效果（v2 原型）

`docs/prototype.html` —— 单文件可交互原型，四个标签页：现状 / 诊断 / 原型 / 方案。

原型本体是三栏「注入工作台」：

1. **左**：分区导航 + 注入块清单（类型徽标、order、kind、trigger、启停开关）
2. **中**：编辑器（名称/类型/order/启停/kind/trigger/正文）+ `inject.md` 实时预览 + **order 轴**（叠官方段序列）
3. **右**：**模型视角预览**
   - 「系统提示词装配」：调 `assemble()` 的等价结果，逐段列出 `[order] name`，**高亮标出哪几段是你注入的**
   - 「本轮注入的消息」：按模拟输入匹配 trigger，展示实际挂进 `messages` 的对象形状
   - 实时校验面板：kind 唯一 / 名称不重复 / order 合法 / 变量已注册 / 正文非空 / 空 trigger 提醒

新增点：真实预览、变量支持、order 可视化、带 diff 的历史、实时校验、导入导出。

---

## 四、技术方案

### 4.1 host 半（`lib/index.js`）

- Config 走 Schemastery：`file` / `watch` / `maxHistory`
- `source` 改为 `{kind:'plugin', plugin:name, form:'snapshot', sections:[…]}`，用 `createUserMessage()`
- 去重改投影式：`sessionProjections.register()` 记录本会话已注入的块
- `system` 段 `text` 去掉 32 分横线，直接是原文
- `fs.watch` 改盯目录
- 新增路由：`GET /preview`（真实装配）、`POST /validate`、`GET /variables`
- `save` 落盘前过 schema

### 4.2 client 半（`lib/client.js`）

- 三栏布局；块拖动排序、悬停快捷启停、类型切换
- order 轴可视化；历史 diff + 恢复预演
- 报错上浮到界面（不再只 `console`）
- 词典补齐 zh/en 全键（`ctx.locale.register` 要求两种内置语言齐全，否则抛错）
- 保留：`settings.section` 注册范式、同源 fetch、无 CORS、不额外占端口

### 4.3 官方段 order 常量（`dsh-system-prompt` `SECTION_ORDERS`）

| 段 | order |
|---|---|
| `harness:identity` | −1000 |
| `harness:source` | −900 |
| `web:surface` | −800 |
| `deployment:persona` | 0 |
| `PLAN_POLICY` | 500 |
| `TEAM_POLICY` | 600 |
| 工具段（bash/pwsh/read/write/edit/glob/grep/jobs/pty…） | 1000 – 2900 |
| `TOOLS_SDK` | 5000 |
| `DELIVERABLE_FILE_REFERENCES` | 9000 |
| `STRUCTURED_OUTPUT` | 9900 |

排序规则：**order 升序 → 同 order 按 name 代码单元比较**（跨机器确定）。
段名在同层重复会直接抛错 → 保留 `gw-text-inject:<名称>` 命名前缀。
`assemble()` 里有效 `complete` 段超过 1 个会抛错。

### 4.4 验证方式

```bash
dsh --profile web --dump-config            # 看配置树里 insert 行是否生效
dsh plugin --profile plugin-dev add ./dsh-text-inject
dsh web --patch ./scratch/cordis.yml       # name 必须绝对路径，相对路径静默失败
```

### 4.5 本机实测到的环境事实

- web profile 的 `cordis.patch.yml` 已有 `gw-text-inject` insert 行，`--dump-config` 能打印出来 → 配置层没问题
- 同一份 patch 里 `font` / `modlens` 两行报 `patch: entry not found`（本就 `disabled`，不影响启动）
- `@gw/dsh-text-inject` **不在** profile 的 `dependencies`，也**不在** `dsh.profile.bundles`，靠 patch insert 加载
- profile 的 webserver 配置：`host 127.0.0.1` / `port 3080` / `compression gzip`
- v1 的 `lib/client.js` 里 `\u2713`（✓）字符在 Windows 控制台读取时显示为 `?` —— 文件本身是 UTF-8 无 BOM，**不是**编码损坏（已用码点逐字节验证：`已保存 U+2713 已热加载`）

---

## 五、待确认（留给爹拍板）

1. 预览里的「模拟输入」要不要支持**从真实会话历史**取最近一条 user 消息（更真，但要读 session 数据）
2. 历史 diff 用行级还是字符级；备份要不要允许命名
3. 是否保留「无 kind 的 context 块直接跳过」这个保护（v1 行为），还是改成「自动补 kind」
4. 要不要顺手把 `[system]` 块也支持 `complete: true`（独占整段提示词）—— 框架支持，但风险高

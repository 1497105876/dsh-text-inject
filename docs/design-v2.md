# @gw/dsh-text-inject v2 设计方案

> 对象：`Z:\dsh\@gw\dsh-text-inject`（web profile）
> 日期：2026-09-23
> 依据：本机 `node_modules/@deepseek-ai/*` 真实源码 + 189 个真实会话日志 + 插件实机复现

---

## 一、先回答你那 7 个问题

| # | 你的需求 | 结论 |
|---|---|---|
| 1 | 历史要备份/保留 | 已有，**但缺陷**：只有整文件快照、没有 diff、30 份就被裁掉。v2 补 diff + 命名 + 手动保留（不被自动裁剪） |
| 2 | 提示词注入可用，上下文不能用 | **确认是真 bug，且根因已定位** —— 走错了通道（详见第二节） |
| 3 | 想看到实际对话里的系统提示词与上下文 | **可以，而且是真实数据**。dsh 把每轮真实发出的 system prompt 写进了会话日志（`request/header`），host 侧也能直接调 `systemPrompt.assemble()` 拿装配结果 |
| 4 | 设置要更简单：标题(必填) + 描述(可空) + 正文 | 采纳。v2 就这三个字段，order/kind 等全部收进「高级」 |
| 5 | 新增的能开关，切换后要不要重启 | **不用重启，立即生效**。原理见第五节 |
| 6 | 界面难看，重新设计 | 全新浅色设计（见第七节 + 可交互 HTML） |
| 7 | 要设计方案 + 浅色可交互 HTML | 就是这份 + `docs/ui-prototype-v2.html` |

---

## 二、为什么「上下文」用不了（硬证据）

### 2.1 实测：上下文一次都没进过模型

写脚本解压全部会话日志（189 个文件、141319 个 zstd 帧），按关键词扫：

```
探针                              命中会话数
"这是一段示例"（v1 的 system 示例正文）  -> 2      ✅ system 生效过
"硬约束"（v1 的 context 正文）          -> 0      ❌
"纯情小绿茶"（同一段 context 正文）      -> 0      ❌
"kind":"123"（v1 给 context 打的 source） -> 0     ❌
```

同时看 `request/header` 事件里**真实发出的 system prompt**：

```
seq=10  system 长度=10090   含"这是一段示例"=true   含"硬约束"=false   含"纯情小绿茶"=false
user/message 的 source 分布: {"user":1, "plugin":1}
```

**结论**：`[system]` 块确实进了提示词；`[context]` 块从来没有产生过任何消息。这不是"效果不好"，是**完全没跑通**。

### 2.2 根因：绕过了官方通道

dsh 给「运行时上下文」准备了**专用通道**，v1 完全没用：

```js
// 官方 API（@deepseek-ai/dsh-system-prompt）
ctx.systemPrompt.context({ name, order, text })   // text 可以是函数，每轮动态求值
```

官方 `dsh-sandbox-policy`、`dsh-user-approval`、`dsh-subagent` 三家的上下文**全部**这样注册：

```js
// dsh-sandbox-policy/lib/index.js:121
ctx.inject(["systemPrompt"], (scope) => {
  scope.systemPrompt.context({
    name: "sandbox:policy",
    order: scope.systemPrompt.getContextOrder("SANDBOX_POLICY"),   // = 110
    text: (context) => { ... }                                     // 每轮求值
  });
});
```

通道由 `dsh-agent-loop` 负责收尾（`lib/index.js:504-505`）：

```js
const sections = renderContextSections(assembly);                       // 官方导出
const context  = this.runtimeContext.project(joinContextSections(sections), sections);
```

`RuntimeContextProjection` 自动干三件事，v1 全都手搓且搓错了：

1. **自动投影成 user 消息**，source 用合法形态 `{kind:"plugin", plugin:"@deepseek-ai/dsh-system-prompt", form:"snapshot", sections:[...]}`
2. **自动去重**：内容与上一份快照相同 → 不产生新消息（`if (this.retained?.text === snapshot) return;`）
3. **自动作废旧快照**：新快照出现时把旧的在 surface 上遮蔽掉

### 2.3 v1 手搓方案的三个硬伤

我用真实数据文件 + 模拟 ctx 把 v1 的 `apply()` 跑起来复现：

```
解析出的块:
  type=system  name="示例提示词" enabled=true order=40           bodyLen=56
  type=context name="1233"      enabled=true kind="123" trigger="1" bodyLen=2208

模拟三轮对话（trigger 填的是 "1"）:
  用户="你好呀 1"      -> 注入 1 条  source={"kind":"123"}
  用户="帮我写个东西"  -> 注入 0 条
  用户="1"            -> 注入 1 条  source={"kind":"123"}
```

**① source 不合法（最致命）**

```js
source: { kind: b.kind }        // kind = "123"
```

官方 `MessageSourceMap`（`dsh-llm` 类型声明，多处 typert 一致）是**封闭联合**：

```ts
export interface MessageSourceMap {
  user: { kind: 'user' };
  plugin: { kind: 'plugin'; plugin: string } & ContextFormed;   // ← 插件消息只有这一个口子
  model: ModelMessageSource;
  tool: ToolMessageSource;
  // 'user-rpc' | 'agent-message' | 'subagent-settled' | 'skill-invocation'
  // | 'team-message' | 'goal' | 'session-reference'
}
```

根本没有 `kind:"123"` 这个位置。插件想注入，只能走 `kind:"plugin"` 且**必带 `plugin` 字段**。

**② 去重跨轮必然失效**

```js
const kinds = new Set(msgs.filter(...).map(m => m.source.kind));   // msgs = 本轮要进的消息
if (kinds.has(b.kind)) continue;
```

`msgs` 是 `inbox.claim()` 返回的**本轮待进入的消息**，不是会话历史。历史消息早就在 session 里了，不在这个数组里。所以**每轮都会重新注入** —— 上面模拟里"1"出现两次就注入了两次，这就是证据。用户会觉得"上下文乱套/重复烧 token"。

**③ 依赖的 `agent/pre-step` 是给"改写待进入消息"用的**

看 `dsh-time-context` 的写法就知道这是**动态单次注入**的场景（时间戳、每轮不同），它的 source 是合法的：

```js
source: { kind: "plugin", plugin: name, form: "snapshot", sections: [{ name, text }] }
```

而"常驻上下文"这种事，官方给了 `systemPrompt.context()` 专门做，不该抢 `agent/pre-step`。

### 2.4 顺带发现的其它问题

| 级别 | 问题 | 说明 |
|---|---|---|
| 高 | `[system]` 段硬包了 32 个短横线 | `text: \n\n${'-'.repeat(32)}\n${body}\n${'-'.repeat(32)}` —— 这些横线原样进了提示词，占 token 还干扰模型。实测 system prompt 里就有 `\n\n\n\n--------------` |
| 中 | `fs.watch` 盯的是**单个文件** | Windows 上编辑器保存是"写临时文件→替换"，句柄静默失效，热加载看着像坏了 |
| 中 | 没有 config schema | 官方要求 `Config = Schema.object(...)`，v1 直接读裸对象 |
| 中 | 保存不校验 | `POST /save` 只查 `Array.isArray(blocks)`，标题空、正文空、order 非数字都能存进去 |
| 低 | 报错只进 console | 用户看不到"我的块为什么没生效" |
| 低 | 历史无 diff | 4 份备份（849B/803B/764B/6740B）互相差什么，只能肉眼比 |
| 低 | order 不可视 | 填 40 落在哪、跟官方段什么关系，完全看不出来 |

---

## 三、v2 数据模型（简化为三个字段）

文件仍是纯 Markdown（可手改、可 git、兼容 v1 数据）：

```md
## [system] 群聊人格
描述: 群聊机器人的说话风格约束

（正文，随便写多长）

## [context] 项目背景
描述:
trigger: 部署,上线

（正文）

## [context] 临时停用的东西
描述: 先留着
enabled: false

（正文）
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `## [system] 标题` / `## [context] 标题` | ✅ 标题必填 | 标题 = 块名，也是界面上显示的名字 |
| `描述:` | ❌ 可空 | 一句话说明，只给**你自己**看，不进提示词 |
| `trigger:` | ❌ 可空 | 逗号分隔关键词；留空 = 每轮生效（仅 context） |
| `enabled:` | ❌ | 默认开；填 `false/0/no/off` 关 |
| `order:` | ❌ | **收进「高级」**，默认 40；system 块专用 |

界面上的字段就三个：**标题、描述、正文**。其余全藏在「高级」折叠里。

---

## 四、两条注入通道（v2 核心）

### 通道 A：系统提示词 → `ctx.systemPrompt.section()`

```js
ctx.systemPrompt.section({
  name: `gw-text-inject:${标题}`,
  order: 40,                    // 默认值，可高级调整
  text: 正文                     // 不加任何装饰符
});
```

- 每轮请求都会重新 `assemble()` → 改了立刻生效
- 官方按 `order` 升序、同序按名字排序拼装（`comparePromptSections`）
- 各段之间官方用 `"\n\n"` 连接，**不需要自己加分隔线**

order 参考坐标（官方 `SECTION_ORDERS` 常量）：

```
-1000  harness:identity      固定开场白
 -900  harness:source        来源信息
   0   deployment:persona    人格设定
  40   gw-text-inject:*     ← 本插件默认落这里（紧跟人格）
 500   plan-policy
 600   team-policy
 900   file-reference
1000+  tools:*
5000   tools:sdk
9900   structured-output
```

### 通道 B：运行时上下文 → `ctx.systemPrompt.context()`（**这就是修好的关键**）

```js
ctx.systemPrompt.context({
  name: `gw-text-inject:${标题}`,
  order: 120,                   // 官方 CONTEXT_ORDERS: sandbox 110 / approval 115 / subagent 120
  text: 正文                     // 或 (context) => string 动态求值
});
```

官方自动完成：装配 → 投影成合法 user 消息 → 内容没变就不重复发 → 变了才发新快照并作废旧快照。

**模型看到的样子**（`joinContextSections` 官方拼装）：

```
Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

<sandbox-policy 的内容>

<approval-policy 的内容>

<你的 context 块内容>          ← 你的东西在这里
```

**为什么这样就"能用"了**：不需要自己造 source、不需要自己判重、不需要自己管历史。全交给框架。

### trigger 怎么办（需要你拍板）

官方 context 的 `text` 是每轮求值的函数，理论上能在函数里拿 `context.agent` 看最近一条用户消息来判关键词。但这依赖读会话历史，有个取舍：

- **选项 1（推荐）**：trigger 只当成文档说明，**不做门控** —— 块开关自己控制。简单、零风险。
- **选项 2**：在 `text(context)` 里读 `context.agent.session` 的最近用户消息做关键词匹配，不匹配就返回 `""`（官方会自动过滤空段）。功能全但要摸会话 API，出错风险略高。
- **选项 3**：干脆去掉 trigger 字段。

我倾向 **选项 2**（保住你已经在用的能力），但这块需要你点头我再动。

---

## 五、开关切换要不要重启？**不用**

| 场景 | 生效时机 | 原因 |
|---|---|---|
| 改正文 / 加块 / 删块 / 切开关（system） | **下一次请求立即生效** | `reload` 时先 dispose 旧 section 再注册新的；每轮 `preStep` 都重新 `systemPrompt.assemble()` |
| 同上（context） | **下一轮立即生效** | 每轮重新 assemble → 投影器发现内容变了 → 发新快照 |
| 已经发出的历史消息 | **不受影响** | 注入是"每轮现算"的，不改历史 |

⚠️ 一个必须说清的细节：**context 是「快照」语义**。改动后不是"改掉旧的那条"，而是**追加一条新快照**并声明旧快照失效（模型会看到 `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.`）。这是官方设计，避免污染 KV cache。

所以界面上切开关的提示应该写：**「已保存 · 下一轮对话生效（无需重启）」**

---

## 六、预览怎么做（你问的第 3 点）

**能做，而且可以是真实数据。** 两条路：

### 路 1：读真实会话日志（100% 真实）

dsh 每轮都把**实际发给模型的 system prompt** 记进会话日志的 `request/header` 事件。实测：

```
seq=10  headerKeys=["config","adapterDefaults","system","tools"]
        config={"provider":"agnes","model":"agnes-3.0-flash","reasoningEffort":"max","maxTokens":65500}
        system 长度=10090
        tools=30 个
```

所以「上一轮实际发给模型的完整提示词」是现成可读的 —— 这是"事后真实预览"。

### 路 2：实时调装配（**推荐做主视图**）

host 侧直接调官方装配：

```js
const assembly = await ctx.systemPrompt.assemble({});
// assembly.sections  → [{name, text}, ...]   系统提示词各段（已排序）
// assembly.contexts  → [{name, text}, ...]   运行时上下文各段（已排序）
```

拿到的是**当前配置下、下一轮将要发出的**真实内容，不用等一次对话。

两个坑要绕开：
- 段里的 `text` 可能是函数，需要以 `context` 调用（传 `{}` 时 sandbox-policy 会返回 `""`，安全）
- `assemble` 是 async，路由要 await

界面呈现（三栏里的右栏）：

```
模型视角                                    [ 系统提示词 | 运行时上下文 ]
────────────────────────────────────────────────────────
[ -1000 ] harness:identity        You are an AI agent powered by...
[  -900 ] harness:source          ...
[     0 ] deployment:persona      你是爹身边黏人的小女子...
[    40 ] gw-text-inject:群聊人格  ← 你注入的（高亮 + 蓝色左边框）
[   500 ] plan-policy             ...
[  1000 ] tools:bash              ...
[  9900 ] structured-output       ...
────────────────────────────────────────────────────────
总长度 10,090 字符 · 其中你的贡献 1,240 字符（12.3%）
```

---

## 七、界面重新设计（浅色）

### 设计原则

- **浅色**、留白足、细边框、低饱和 —— 不炫技，就是个干活的工具
- 三个字段就三个字段，别的一次性看不见
- **左边列表 / 中间编辑 / 右边预览** 三栏；预览是常驻的，不是弹窗（这是 v1 最大的体验缺失）
- 开关就在列表行上，一眼能看到哪些是开的

### 配色

| 用途 | 色值 |
|---|---|
| 页面底色 | `#f7f8fa` |
| 卡片/面板 | `#ffffff` |
| 边框 | `#e5e7eb` |
| 主文字 | `#1f2328` |
| 次要文字 | `#6b7280` |
| 主色（选中/按钮） | `#2563eb` |
| 主色浅底 | `#eff6ff` |
| 系统提示词徽章 | `#7c3aed` / 底 `#f5f3ff` |
| 上下文徽章 | `#0891b2` / 底 `#ecfeff` |
| 开启态 | `#16a34a` |
| 停用态 | `#9ca3af` |

### 页面结构

```
┌────────────────────────────────────────────────────────────────┐
│ 文字注入                    已保存 · 下一轮生效 (无需重启)   [历史]│
├──────────────┬─────────────────────────┬───────────────────────┤
│ 块 (5)       │ 编辑                    │ 模型视角              │
│              │                         │                       │
│ [+ 新建]     │ 标题  [群聊人格      ]  │ [系统提示词|上下文]   │
│              │ 类型  [系统提示词 ▾]    │                       │
│ ● 群聊人格   │ 描述  [群聊说话风格  ]  │ 段列表 + order 轴      │
│   系统  [开] │                         │ 你的段高亮             │
│ ● 项目背景   │ 正文                    │                       │
│   上下文[开] │ ┌─────────────────────┐ │ ───────────────       │
│ ○ 临时停用   │ │（大 textarea）      │ │ 总长 10,090 字符      │
│   上下文[关] │ │                     │ │ 你的贡献 1,240 (12.3%)│
│              │ └─────────────────────┘ │                       │
│              │                         │                       │
│              │ [高级 ▾]  删除  保存    │                       │
└──────────────┴─────────────────────────┴───────────────────────┘
```

### 交互细节

- **新建**：只需要点「+ 新建」，选类型，填标题，开写。标题为空不让保存（红框 + 提示）
- **开关**：列表行右端，切了立刻 POST /save → 状态栏显示「已保存 · 下一轮生效」
- **预览实时**：切开关/改正文 → 右栏立刻重算（本地模拟），同时后台拉真实装配
- **历史**：抽屉式，从右侧滑出；每条显示时间 + 大小 + **改了什么**（+12 行 / −3 行）；可预览、可恢复、可命名保留
- **报错可见**：注册失败、保存失败、schema 不合法 → 顶部红色条，不再只进 console

---

## 八、v2 实施清单（待你点头后动手）

**host 半（`lib/index.js`）**
1. `[context]` 块改走 `ctx.systemPrompt.context()`，删除手搓的 `agent/pre-step`
2. `[system]` 块去掉 32 横线装饰
3. 加 `Config = Schema.object({ file, defaultSystemOrder, defaultContextOrder })`
4. `POST /save` 加校验（标题非空、type 合法、order 有限数）
5. 新增 `GET /preview` → 调 `systemPrompt.assemble({})` 返回 sections/contexts
6. `fs.watch` 改成盯**目录** + 文件存在性检查
7. 历史加 diff 计算 + `pinned` 标记

**client 半（`lib/client.js`）**
8. 全量重写 UI（浅色三栏 + 实时预览 + 简化表单）
9. 字段从 order/kind/trigger 缩到 标题/描述/正文，其余进「高级」

**其余**
10. 补 `LICENSE`、`dsh.client.inject`、`files`、`peerDependencies`
11. 用 `dsh --profile web --dump-config` 验证 + 真实会话验证

---

## 九、需要你拍板的 4 件事

1. **trigger 保不保？** 选项 1（只当文档）/ 选项 2（真门控，读会话历史）/ 选项 3（删掉）
2. **预览要不要读真实会话日志**（路 1）？读的话需要放开 `sessions` 目录读取权限
3. **历史裁剪策略**：仍保留最近 30 份自动裁？还是允许「钉住」某些不被裁掉？
4. **order 要不要露出来**？还是完全用默认 40 + 一个「插到人格前/后」的简单二选一

---

## 附：本次诊断用到的证据

| 证据 | 来源 |
|---|---|
| `MessageSourceMap` 封闭联合 | `dsh-llm` / `dsh-agent-presets` / `dsh-api-session-controller` 的 typert 类型声明 |
| `systemPrompt.context()` API | `dsh-system-prompt/lib/index.js:255`，类声明 `dsh-tool-cordis/lib/index.js:7573` |
| 官方 context 注册范例 | `dsh-sandbox-policy:121`、`dsh-user-approval:79`、`dsh-subagent:701` |
| 装配与投影调用点 | `dsh-agent-loop/lib/index.js:502-505`、`RuntimeContextProjection` 同文件 13-85 |
| 空段过滤与拼装规则 | `dsh-system-prompt/lib/index.js:108-146` |
| 段序常量表 | `dsh-system-prompt/lib/index.js:10-46` |
| session append 路径 | `dsh-agent-loop/lib/index.js:559` |
| system prompt 落盘 | `dsh-session/lib/index.js:380` `canonicalHeader`（含 `header.system`）、`:416` `foldRequestHeader` |
| 189 个会话全量扫描 | 自写 zstd 多帧解压脚本（141319 帧） |
| v1 行为复现 | 自写 harness，用真实数据文件跑 v1 `apply()` + 模拟三轮 pre-step |

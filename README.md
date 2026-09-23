# @gw/dsh-text-inject

在 dsh（DeepSeek Harness）**官方设置页左侧栏**添加一个「**文字注入**」分区：把文字注入到
**系统提示词**（每轮生效）或**会话上下文**；内容存于**独立文件**，支持**热加载**与**历史备份**。

不碰官方 `inject-system-prompt` 那种"在官方配置里塞字段"的做法——你的文字写在你自己的一份
`inject.md` 里，随手可改。

## 功能

| 能力 | 说明 |
|---|---|
| 提示词注入 | `## [system] 名称` 块 → 追加进系统提示词，每轮对话生效 |
| 上下文注入 | `## [context] 名称` 块 → 合成一条 user 消息注入会话；`kind` 去重、`trigger` 关键词门控 |
| 增删改 | 设置页以卡片列出所有块，支持新增 / 编辑 / 删除 / 启停 |
| 独立文件 | 内容全部写在你自己的一份 `inject.md`，与官方配置隔离 |
| 热加载 | 改文件保存即生效（`fs.watch`），或在设置页点保存；都不用重启 dsh |
| 历史备份 | 每次保存自动把上一版存进 `history/`，可查看 / 一键恢复（保留最近 30 份） |

## 安装

1. 把本包放进对应 profile 的 node_modules（scope 目录 `@gw`）：

   ```bash
   # web profile（桌面客户端则换成 profiles/desktop）
   cp -r dsh-text-inject ~/.dsh/profiles/web/node_modules/@gw/
   ```

2. 在 profile 的 `cordis.patch.yml` 追加 loader 入口：

   ```yaml
   - insert:
       - id: gw-text-inject
         name: '@gw/dsh-text-inject'
   ```

3. 重启 dsh，打开设置页 → 左侧栏出现「**文字注入**」。

数据文件默认在 `~/.dsh/text-inject/inject.md`，插件首次加载会自动创建（含示例块）。
想换位置，在 loader 入口加 `config.file`：

```yaml
- insert:
    - id: gw-text-inject
      name: '@gw/dsh-text-inject'
      config:
        file: 'C:/Users/<你的用户名>/Desktop/文字注入.md'
```

## 数据文件格式

```md
# 任意标题（说明用，忽略）

## [system] 我的常驻规则
order: 40

这段会追加进系统提示词，每轮生效。

## [context] 项目背景
kind: gw-project
trigger: 项目,需求

当消息里出现「项目」或「需求」时，这段作为一条 user 消息注入会话。
```

- 块头：`## [system] 名称` 或 `## [context] 名称`（大小写不敏感）。
- 元数据：紧跟在块头之后、正文之前，**英文冒号**，只认 `order` / `kind` / `trigger` / `enabled`。
  一旦出现非元数据、非空行，后面就全是正文——所以正文里的「中文：」不会被误解析。
- `[context]` 块必须有 `kind`（唯一，用于去重）；`trigger` 留空 = 每轮注入。
- `enabled: false` 可临时禁用某块。

## 设置页数据通道

前端无本地文件桥，读写经 host 的 webServer 路由（**同源**，无 CORS、不额外占端口）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/gw-text-inject/state` | `{ file, raw, blocks, history }` |
| POST | `/gw-text-inject/save` | body `{ blocks }` → 保存 + 自动备份 |
| POST | `/gw-text-inject/restore` | body `{ name }` → 恢复某份备份 |
| GET | `/gw-text-inject/raw?name=<备份名>` | 读某份备份原文 |

## 依赖与兼容

- host 半依赖服务：`systemPrompt`（`@deepseek-ai/dsh-base` 提供）、`webServer`（`@deepseek-ai/dsh-host-webserver` 提供）。
- client 半依赖服务：`slots`、`locale`；`dsh.client.inject` 声明 `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-settings`。
- `dsh.client.platform = "web"`；`exports` 含 `"."` 与 `"./client"`。
- 兼容 dsh release：`0.1.2-rc.1` / `0.1.5-rc.1` / `0.1.5-rc.2`。

## 卸载

1. 删掉 profile `cordis.patch.yml` 里的 `gw-text-inject` insert 块。
2. 删除 `node_modules/@gw/dsh-text-inject/`。
3. 数据文件 `~/.dsh/text-inject/`（含 `history/`）可按需保留或删除。
4. 重启 dsh。

## 结构

```
dsh-text-inject/
├─ package.json         # npm 元数据 + dsh.bundle.patch + dsh.client 声明
├─ cordis.patch.yml     # loader 入口（insert 块）
├─ inject.md            # 数据文件种子模板（首次加载复制到用户数据文件）
├─ lib/
│  ├─ index.js          # host 半：注入 + 热加载 + webServer 数据路由 + 备份
│  ├─ client.js         # client 半：设置页「文字注入」UI（lazy-CJS bundle）
│  └─ parser.js         # inject.md 的纯解析 / 序列化
└─ README.md
```

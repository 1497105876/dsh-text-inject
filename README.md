# @gw/dsh-text-inject

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-4b8bbe?logo=github)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

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
- 兼容 dsh release：`0.1.2-rc.1` / `0.1.5-rc.1` / `0.1.5-rc.2` / `0.1.7-rc.2` / `0.2.0-rc.2`（最后验证 2026-10-01）。
- 官方 `@deepseek-ai/*` 包未列入 `dependencies`，由宿主 profile 提供。

### 按 dsh 版本选择插件版本

dsh 仍处开发者预览期，破坏性变更频繁，**插件按 dsh 版本锁定**。本仓库的每个 git tag 对应一个已验证的 dsh 发行版，装之前先对上号：

| 你本机的 dsh 版本 | 装这个插件 tag | 说明 |
|---|---|---|
| `0.1.0` – `0.1.7`（含 rc / alpha） | `dsh-0.1.x` | 旧版 dsh（2026-09 及之前验证，设置页为单一 `ui-settings`） |
| `0.2.0-rc.1` / `0.2.0-rc.2` | `dsh-0.2.0-rc.2` | 0.2.0 把设置页拆成 `ui-settings-*` 子包后的版本（2026-10-01 验证） |
| 其它 / 未知 | 取最新 tag | 未单独锁定，请自行验证并到仓库提 issue |

不必手挑——仓库根目录的 [`tools/install.sh`](./tools/install.sh)（Git Bash）与 [`tools/install.ps1`](./tools/install.ps1) 会自动跑 `dsh --version` 探测你本机版本，挑出对应 tag，装进指定 profile 的 `node_modules/@gw/`：

```bash
bash tools/install.sh            # 探测 dsh 版本 → 选 tag → 装进 web profile
bash tools/install.sh desktop    # 装进 desktop profile
```

> 在仓库目录内运行安装器时，它装的是**你当前 git checkout 的版本**（请先 `git checkout` 到对应 tag）；在仓库外运行则从 GitHub 拉对应 tag。

## 卸载

1. 删掉 profile `cordis.patch.yml` 里的 `gw-text-inject` insert 块。
2. 删除 `node_modules/@gw/dsh-text-inject/`。
3. 数据文件 `~/.dsh/text-inject/`（含 `history/`）可按需保留或删除。
4. 重启 dsh。

## 权限与数据

- 读写的只有一份文件：默认 `~/.dsh/text-inject/inject.md` 及其 `history/` 备份（可在 loader 配置里改到任意路径）。
- 不访问网络、不读凭据、不上报任何数据。
- 前端与 host 之间走 dsh 自己的 webServer **同源**路由（`/gw-text-inject/*`），不额外开端口、无跨域。
- 注入的内容会进入每一轮请求，等于放大提示词体积——`[context]` 块建议配 `trigger`，别全量常驻，否则白白烧 token。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 设置页左侧栏没有「文字注入」 | 包没进 `node_modules`，或 `cordis.patch.yml` 的 insert 块用了 `file://` 路径。带 `dsh.client` 的插件**必须**真装进 node_modules，绝对路径挂载会让整站前端 bundle 连坐失败 |
| 改了文件没生效 | 热加载靠 `fs.watch`；部分编辑器「原子保存」会丢事件，去设置页点一次保存即可 |
| 上下文块一直重复注入 | `[context]` 块缺 `kind`（去重键），或 `trigger` 太宽泛 |
| 元数据行没被识别 | 必须用**英文冒号**，且要紧跟块头、在正文之前 |
| 整站前端报 `Failed to load plugins` | 见第一条：摘掉本插件的 insert 块并重启，前端即恢复 |

回滚：按「卸载」四步走，数据文件可保留。插件自身不落盘日志，排障看 dsh 启动日志。

## 许可证与安全

MIT，见 [LICENSE](./LICENSE)。本插件不接触密钥、不产生外发流量，安全问题直接在仓库提 issue。

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

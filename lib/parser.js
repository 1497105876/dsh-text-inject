// lib/parser.js — inject.md 的纯解析 / 序列化（零依赖）。
//
// 文件格式：
//   # 任意标题（忽略，可写说明）
//   ## [system] 名称
//   order: 40              ← 元数据：紧邻标题、正文之前、英文冒号
//   正文……
//
//   ## [context] 名称
//   kind: gw-xxx           ← 必填且唯一，去重标识
//   trigger: 词1,词2       ← 可选，命中关键词才注入；留空=每轮注入
//   enabled: false         ← 可选，禁用本块
//   正文……
//
// 识别规则：
//   - 块头：整行匹配 `## [system|context] 名称`（大小写不敏感）。
//   - 元数据：块头之后、正文之前连续的 `key: value` 行，key 限
//     order / kind / trigger / enabled，且冒号必须是英文冒号。
//   - 一旦出现非元数据、非空行，即视为正文开始，其后所有行都是正文
//     （所以正文里的「中文：」或任意 `key: value` 都不会被误当元数据）。

const META_KEYS = new Set(["order", "kind", "trigger", "enabled"]);
const HEAD_RE = /^##\s*\[\s*(system|context)\s*\]\s*(.*)$/i;
const META_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;

function truthy(v) {
  if (v === undefined || v === null || v === "") return true;
  return !/^(false|0|no|off)$/i.test(String(v).trim());
}

export function parseBlocks(raw) {
  const blocks = [];
  const lines = String(raw == null ? "" : raw).split(/\r?\n/);
  let cur = null;
  let body = [];
  let inMeta = false;

  function flush() {
    if (!cur) return;
    blocks.push({
      type: cur.type,
      name: cur.name,
      order: cur.order,
      kind: cur.kind,
      trigger: cur.trigger,
      enabled: cur.enabled,
      body: body.join("\n").replace(/^\n+|\n+$/g, ""),
    });
    cur = null;
    body = [];
    inMeta = false;
  }

  for (const line of lines) {
    const head = HEAD_RE.exec(line);
    if (head) {
      flush();
      cur = {
        type: head[1].toLowerCase(),
        name: (head[2] || "").trim() || "未命名",
        order: 40,
        kind: "",
        trigger: "",
        enabled: true,
      };
      inMeta = true;
      continue;
    }
    if (!cur) continue;
    if (inMeta) {
      const meta = META_RE.exec(line);
      if (meta && META_KEYS.has(meta[1].toLowerCase())) {
        const key = meta[1].toLowerCase();
        const val = (meta[2] || "").trim();
        if (key === "order") cur.order = Number.parseInt(val, 10) || 40;
        else if (key === "enabled") cur.enabled = truthy(val);
        else cur[key] = val;
        continue;
      }
      if (line.trim() === "") continue;
      inMeta = false;
    }
    body.push(line);
  }
  flush();
  return blocks;
}

export function serializeBlocks(blocks) {
  const out = [
    "# @gw/dsh-text-inject — 文字注入配置",
    "",
    "> 本文件由设置页「文字注入」维护，也可手动编辑；保存即热加载（无需重启 dsh）。",
    "> 块头：`## [system] 名称` 进系统提示词；`## [context] 名称` 进会话上下文。",
    "",
  ];
  for (const b of blocks || []) {
    const type = b.type === "context" ? "context" : "system";
    out.push(`## [${type}] ${(b.name || "未命名").trim()}`);
    if (type === "system") {
      out.push(`order: ${b.order || 40}`);
    } else {
      if (b.kind) out.push(`kind: ${b.kind}`);
      out.push(`trigger: ${b.trigger || ""}`);
    }
    if (b.enabled === false) out.push("enabled: false");
    out.push("");
    out.push(String(b.body || "").replace(/\s+$/, ""));
    out.push("");
  }
  return out.join("\n");
}

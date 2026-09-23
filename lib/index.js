// lib/index.js — @gw/dsh-text-inject host 半（Node 端，跑在 dsh 主进程）。
//
// 职责：
//   1. 读写用户数据文件（默认 ~/.dsh/text-inject/inject.md，可用 config.file 改）
//   2. [system]  块 → ctx.systemPrompt.section({name, order, text})   每轮进系统提示词
//   3. [context] 块 → ctx.systemPrompt.context({name, order, text})  每轮进运行时上下文
//   4. fs.watch 热加载：改文件保存即生效，不用重启 dsh
//   5. 注册 webServer 路由 /gw-text-inject/*，供设置页前端读写 + 预览 + 历史备份
//
// 依赖：systemPrompt、webServer。
// 前端没有本地文件桥，所以数据通道走 host 的 webServer 路由（同源，无 CORS、不额外占端口）。
//
// ── v2 相对 v1 的关键修正 ──────────────────────────────────────
//
// [1] 上下文改走官方通道。
//     v1 自己手搓 agent/pre-step 往 messages 里塞 user 消息，source 写成
//     `{kind: b.kind}`（例如 `{kind:"123"}`）。但官方 MessageSourceMap 是封闭
//     联合，插件消息唯一口子是 `{kind:"plugin", plugin:string} & ContextFormed`，
//     所以 v1 的 source 非法；而且它的去重集合取的是「本轮待进消息」而非会话
//     历史，跨轮必然失效 → 每轮重复注入。
//     实测：扫 189 个真实会话、141319 个事件，v1 的 context 块内容命中 0 次。
//     现在改走 ctx.systemPrompt.context()，由 agent-loop 的 RuntimeContextProjection
//     自动完成「投影成合法 user 消息 + 内容没变不重发 + 新快照作废旧快照」。
//
// [2] disposer 形态修正（这是个会让热加载彻底失效的真 bug）。
//     ctx.effect() 返回的是**函数**（规范里 disposer 可以是函数，也可以是带
//     .dispose() 的对象）。v1 只判断 `typeof d.dispose === "function"`，永远为假，
//     于是旧注册从不清理 → 重新注册撞名报 "already registered" → 改完内容不生效。
//     实测复现：改内容后装配结果仍是旧值。本文件统一用 release() 处理三种形态。
//
// [3] 去掉 32 个短横线装饰符。官方各段之间用 "\n\n" 拼接，不需要自己加分隔线；
//     v1 那些横线原样进了提示词（占 token 还干扰模型）。
//
// [4] fs.watch 从「盯单个文件」改成「盯目录」。Windows 上编辑器保存是
//     「写临时文件 → 替换」，句柄会静默失效。
//
// [5] 去掉 trigger 门控（用户要求）。它是 v1 自造的、非官方的概念。
//
// [6] 历史备份支持「钉住不裁」，并计算与当前版本的差异。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseBlocks, serializeBlocks, DEFAULT_SYSTEM_ORDER, DEFAULT_CONTEXT_ORDER } from "./parser.js";

/** Cordis plugin name。 */
export const name = "@gw/dsh-text-inject";

/** 硬依赖（cordis 红线：访问 ctx.xxx 必须先 inject，否则 apply 期直接抛错）。 */
export const inject = ["systemPrompt", "webServer"];

// ────────────────────────────────────────────────────────────────
//  位置开放度开关
// ────────────────────────────────────────────────────────────────
/**
 * 系统提示词侧允许的最小 order。
 *
 * `0` 是官方 `deployment:persona`（人格段）的位置，它之前是三条固定段：
 *   -1000 harness:identity   固定开场白
 *    -900 harness:source     来源信息
 *    -800 web:surface        界面标识
 *
 * 按产品取舍，界面只允许把块放在 0 及之后，所以这里锁成 0。
 * **想放开到固定段之前（比如插进开场白和来源信息之间），把这个数改成 -1000 即可**，
 * 界面的位置下拉会自动长出对应的可选项，不必改别的代码。
 *
 * 上下文侧不受此限制（那边是 110 / 115 / 120 三档，默认插在 125）。
 */
export const MIN_ORDER = 0;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.resolve(HERE, "..", "inject.md");
const DEFAULT_DATA_FILE = path.join(os.homedir(), ".dsh", "text-inject", "inject.md");
const ROUTE_PREFIX = "/gw-text-inject";
const DEFAULT_HISTORY_LIMIT = 30;

/** 数据文件名前缀：本插件注册的段统一用这个前缀，便于在装配结果里认出自己的段。 */
const SECTION_PREFIX = "gw-text-inject:";

// ────────────────────────────────────────────────────────────────
//  配置 schema（schemastery）
// ────────────────────────────────────────────────────────────────
// 官方要求用 @deepseek-ai/schemastery 声明 Config，加载时校验、不合法要大声失败。
// 这里用 createRequire 包一层，保证即使 schemastery 解析不到也不会让插件加载失败。
let Config;
try {
  const req = createRequire(import.meta.url);
  const loaded = req("@deepseek-ai/schemastery");
  const z = (loaded && loaded.default) || loaded;
  if (z && typeof z.object === "function") {
    Config = z.object({
      file: z.string().default(""),
      historyLimit: z.number().default(DEFAULT_HISTORY_LIMIT),
    });
  }
} catch (e) {
  Config = undefined; // 拿不到 schemastery 就不做 schema 校验，功能不受影响
}
export { Config };

// ────────────────────────────────────────────────────────────────
//  disposer 归一化
// ────────────────────────────────────────────────────────────────
/**
 * 释放一个 disposer。cordis 的 disposer 有三种形态，必须都认：
 *   - 函数（ctx.effect / webServer.register 返回的就是这种）
 *   - 带 .dispose() 的对象
 *   - 带 .close() 的对象（fs.watch 的 watcher）
 * @param d - 待释放的 disposer。
 */
function release(d) {
  if (!d) return;
  try {
    if (typeof d === "function") d();
    else if (typeof d.dispose === "function") d.dispose();
    else if (typeof d.close === "function") d.close();
  } catch (e) {
    /* 释放失败不该影响其它清理 */
  }
}

/** 释放一整组 disposer 并清空数组。 */
function releaseAll(list) {
  const items = list.splice(0).reverse();
  for (const d of items) release(d);
}

// ────────────────────────────────────────────────────────────────
//  简单行级 diff（LCS）
// ────────────────────────────────────────────────────────────────
/**
 * 计算两个文本的差异（unified 风格行列表）。
 * @param before - 旧文本。
 * @param after - 新文本。
 * @returns `{added, removed, lines: [{k: 'a'|'d'|'c', t: string}]}`。
 */
function diffLines(before, after) {
  const a = String(before || "").split(/\r?\n/);
  const b = String(after || "").split(/\r?\n/);

  // LCS 长度表。数据文件通常几百行，O(n*m) 完全够用。
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ k: "c", t: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ k: "d", t: a[i] });
      removed++;
      i++;
    } else {
      lines.push({ k: "a", t: b[j] });
      added++;
      j++;
    }
  }
  while (i < n) {
    lines.push({ k: "d", t: a[i++] });
    removed++;
  }
  while (j < m) {
    lines.push({ k: "a", t: b[j++] });
    added++;
  }
  return { added, removed, lines };
}

// ────────────────────────────────────────────────────────────────
//  插件主体
// ────────────────────────────────────────────────────────────────
/**
 * 挂载插件。
 * @param ctx - host cordis context。
 * @param config - `{ file?, historyLimit? }`。
 * @returns disposer，方便直接调用 apply 的场合（cordis 加载时拿到的是 undefined，
 *   见下方 ctx.effect 那段注释）。
 */
export function apply(ctx, config = {}) {
  const dataFile = config.file ? path.resolve(String(config.file)) : DEFAULT_DATA_FILE;
  const dataDir = path.dirname(dataFile);
  const historyDir = path.join(dataDir, "history");
  const pinnedFile = path.join(historyDir, ".pinned.json");
  const historyLimit = Number.isFinite(config.historyLimit)
    ? Math.max(1, Math.floor(config.historyLimit))
    : DEFAULT_HISTORY_LIMIT;

  const log = (...a) => { try { ctx.logger?.info?.(...a); } catch (e) {} };
  const warn = (...a) => { try { ctx.logger?.warn?.(...a); } catch (e) {} };

  // ── 目录 / 文件 ────────────────────────────────────────────
  function ensureDirs() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
      if (!fs.existsSync(dataFile)) {
        let seed = "";
        try { seed = fs.readFileSync(SEED_FILE, "utf8"); } catch (e) {}
        if (!seed) {
          seed =
            "# @gw/dsh-text-inject — 文字注入配置\n\n" +
            "## [system] 示例提示词\n描述: 这段会拼进系统提示词\n\n在这里写要常驻注入的内容。\n";
        }
        fs.writeFileSync(dataFile, seed, "utf8");
      }
    } catch (e) {
      warn(`[gw-text-inject] 初始化数据目录失败: ${e?.message}`);
    }
  }

  const readRaw = () => { try { return fs.readFileSync(dataFile, "utf8"); } catch (e) { return ""; } };

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  /**
   * 生成一个当前不存在的备份文件名。
   *
   * 时间戳只精确到秒，同一秒内连续保存两次会算出同一个文件名，后一次直接把
   * 前一次的备份覆盖掉——等于丢了一份历史。这里撞名时追加 -2、-3… 规避。
   * @returns 可用的备份文件名。
   */
  function nextBackupName() {
    const base = `inject-${stamp()}`;
    let fn = `${base}.md`;
    for (let i = 2; fs.existsSync(path.join(historyDir, fn)); i++) fn = `${base}-${i}.md`;
    return fn;
  }

  // ── 钉住标记（sidecar JSON，与备份文件放一起）──────────────
  function readPinned() {
    try {
      const arr = JSON.parse(fs.readFileSync(pinnedFile, "utf8"));
      return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
    } catch (e) {
      return new Set();
    }
  }
  function writePinned(set) {
    try {
      fs.writeFileSync(pinnedFile, JSON.stringify([...set].sort(), null, 2), "utf8");
    } catch (e) {
      warn(`[gw-text-inject] 写入钉住标记失败: ${e?.message}`);
    }
  }

  // ── 历史备份 ───────────────────────────────────────────────
  function listHistory() {
    const pinned = readPinned();
    const cur = readRaw();
    let entries = [];
    try {
      entries = fs.readdirSync(historyDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          let size = 0;
          let mtime = 0;
          try {
            const st = fs.statSync(path.join(historyDir, f));
            size = st.size;
            mtime = st.mtimeMs;
          } catch (e) {}
          return { name: f, size, mtime };
        });
    } catch (e) {
      return [];
    }

    // 按时间倒序（最新的在前）。
    // 不能直接按文件名排序：同一秒内可能产生多份（inject-…-1、inject-…-2），
    // 字符串序会把 -2 排到 -1 前面，看起来像时间倒着走。
    entries.sort((a, b) => (b.mtime - a.mtime) || b.name.localeCompare(a.name));

    return entries.map((it) => {
      let raw = "";
      try { raw = fs.readFileSync(path.join(historyDir, it.name), "utf8"); } catch (e) {}
      const d = raw ? diffLines(raw, cur) : { added: 0, removed: 0 };
      return {
        name: it.name,
        size: it.size,
        mtime: it.mtime,
        pinned: pinned.has(it.name),
        added: d.added,
        removed: d.removed,
      };
    });
  }

  function backup() {
    try {
      const cur = readRaw();
      if (!cur.trim()) return null;
      const fn = nextBackupName();
      fs.writeFileSync(path.join(historyDir, fn), cur, "utf8");

      // 裁剪：钉住的不裁。同样要按时间新旧判断（见 listHistory 里的说明）。
      const pinned = readPinned();
      const all = fs.readdirSync(historyDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          let mtime = 0;
          try { mtime = fs.statSync(path.join(historyDir, f)).mtimeMs; } catch (e) {}
          return { f, mtime };
        })
        .sort((x, y) => (x.mtime - y.mtime) || x.f.localeCompare(y.f)); // 最旧的在前
      const removable = all.filter((x) => !pinned.has(x.f));
      const overflow = all.length - historyLimit;
      for (let i = 0; i < overflow && i < removable.length; i++) {
        try { fs.unlinkSync(path.join(historyDir, removable[i].f)); } catch (e) {}
      }
      return fn;
    } catch (e) {
      warn(`[gw-text-inject] 备份失败: ${e?.message}`);
      return null;
    }
  }

  // ── 状态 ───────────────────────────────────────────────────
  let state = { raw: "", blocks: [] };
  let sysDisposers = [];   // [system] 块的 section disposer
  let ctxDisposers = [];   // [context] 块的 context disposer
  let registerErrors = []; // 最近一次注册遇到的错误（给界面显示，别只进 console）
  let watcher = null;
  let reloadTimer = null;
  let disposed = false;

  function loadState() {
    const raw = readRaw();
    state = { raw, blocks: parseBlocks(raw) };
    return state;
  }

  /** 按官方规则注册所有块。先全部撤掉旧的，再注册新的（顺序不能反，否则撞名）。 */
  function registerAll() {
    releaseAll(sysDisposers);
    releaseAll(ctxDisposers);
    registerErrors = [];
    if (disposed) return;

    const sp = ctx.systemPrompt;
    if (!sp || typeof sp.section !== "function" || typeof sp.context !== "function") {
      registerErrors.push("systemPrompt 服务不可用，注入未生效");
      return;
    }

    let nSys = 0;
    let nCtx = 0;
    for (const b of state.blocks) {
      if (!b.enabled) continue;
      if (!b.body || !b.body.trim()) continue;

      const title = (b.title || "").trim();
      if (!title) {
        registerErrors.push(`有一个 ${b.type === "system" ? "系统提示词" : "上下文"}块没有标题，已被跳过`);
        continue;
      }

      const order = Number.isFinite(b.order) ? b.order : (b.type === "system" ? DEFAULT_SYSTEM_ORDER : DEFAULT_CONTEXT_ORDER);
      // 系统侧落在固定段之前的，按 MIN_ORDER 抬高（只提示，不阻断）
      const effective = b.type === "system" ? Math.max(order, MIN_ORDER) : order;

      try {
        if (b.type === "system") {
          sysDisposers.push(sp.section({ name: SECTION_PREFIX + title, order: effective, text: b.body }));
          nSys++;
        } else {
          ctxDisposers.push(sp.context({ name: SECTION_PREFIX + title, order: effective, text: b.body }));
          nCtx++;
        }
      } catch (e) {
        registerErrors.push(`「${title}」注册失败：${e?.message || e}`);
      }
    }

    if (nSys || nCtx) log(`[gw-text-inject] 已注册 ${nSys} 个系统提示词块、${nCtx} 个上下文块`);
    for (const err of registerErrors) warn(`[gw-text-inject] ${err}`);
  }

  function reload(reason) {
    if (disposed) return;
    loadState();
    try {
      registerAll();
    } catch (e) {
      // 卸载竞态：定时器可能在插件已卸载后才触发，此时 ctx 已失效。
      // 这不是错误，静默吞掉即可，否则日志里会刷无意义的堆栈。
      if (disposed) return;
      warn(`[gw-text-inject] 热加载失败: ${e?.message}`);
      return;
    }
    log(`[gw-text-inject] 已热加载（${reason || "手动"}）：${state.blocks.length} 个块`);
  }

  ensureDirs();
  loadState();
  registerAll();
  log(
    `[gw-text-inject] 已加载：system ${state.blocks.filter((b) => b.type === "system").length} / ` +
      `context ${state.blocks.filter((b) => b.type === "context").length}；文件 ${dataFile}`
  );

  // ── 热加载（盯目录，不是文件）────────────────────────────
  const onFsEvent = () => {
    if (disposed) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (disposed) return;
      reload("文件变化");
    }, 150);
  };
  try {
    watcher = fs.watch(dataDir, onFsEvent);
  } catch (e) {
    // 目录监听失败时退回单文件监听（聊胜于无）
    try { watcher = fs.watch(dataFile, onFsEvent); } catch (e2) {
      warn(`[gw-text-inject] 监听数据文件失败: ${e2?.message}`);
    }
  }

  // ── 预览：调官方装配，拿「下一轮将要发出」的真实内容 ────────
  /**
   * 装配一次并整理成界面好用的形状。
   * @param scope - 作用域（agent 对象）或 undefined（全局）。
   * @returns 整理后的装配结果。
   */
  async function buildPreview(scope) {
    const sp = ctx.systemPrompt;
    const context = scope ? { agent: scope, scope } : {};
    const asm = await sp.assemble(context);

    const shape = (list, kind) =>
      (list || []).map((s, idx) => ({
        name: s.name,
        text: String(s.text ?? ""),
        chars: String(s.text ?? "").length,
        mine: String(s.name).startsWith(SECTION_PREFIX),
        // assemble() 的返回值不带 order（官方在映射时就丢掉了），
        // 所以官方段只给顺序位次，我们自己的段能精确给出 order。
        index: idx,
        order: myOrderOf(s.name, kind),
        kind,
      }));

    const sys = shape(asm.sections, "system");
    const ctxSections = shape(asm.contexts, "context");
    return {
      system: { sections: sys, totalChars: sys.reduce((a, s) => a + s.chars, 0) },
      context: { sections: ctxSections, totalChars: ctxSections.reduce((a, s) => a + s.chars, 0) },
    };
  }

  /** 从当前块定义里找出某个段名对应的 order（只对我们的段有效）。 */
  function myOrderOf(segName, kind) {
    if (!String(segName).startsWith(SECTION_PREFIX)) return null;
    const title = String(segName).slice(SECTION_PREFIX.length);
    const b = state.blocks.find((x) => x.type === kind && (x.title || "").trim() === title);
    if (!b) return null;
    const order = Number.isFinite(b.order) ? b.order : (kind === "system" ? DEFAULT_SYSTEM_ORDER : DEFAULT_CONTEXT_ORDER);
    return kind === "system" ? Math.max(order, MIN_ORDER) : order;
  }

  /** 官方位置锚点（供界面做位置下拉，直接问官方要，不写死）。 */
  function buildAnchors() {
    const sp = ctx.systemPrompt;
    const safe = (fn, key) => { try { return sp[fn](key); } catch (e) { return null; } };
    return {
      system: {
        HARNESS_IDENTITY: safe("getSectionOrder", "HARNESS_IDENTITY"),
        HARNESS_SOURCE: safe("getSectionOrder", "HARNESS_SOURCE"),
        WEB_SURFACE: safe("getSectionOrder", "WEB_SURFACE"),
        DEPLOYMENT_PERSONA: safe("getSectionOrder", "DEPLOYMENT_PERSONA"),
        PLAN_POLICY: safe("getSectionOrder", "PLAN_POLICY"),
        TEAM_POLICY: safe("getSectionOrder", "TEAM_POLICY"),
        FILE_REFERENCE: safe("getSectionOrder", "FILE_REFERENCE"),
        TOOL_BASH: safe("getSectionOrder", "TOOL_BASH"),
        TOOLS_SDK: safe("getSectionOrder", "TOOLS_SDK"),
        STRUCTURED_OUTPUT: safe("getSectionOrder", "STRUCTURED_OUTPUT"),
      },
      context: {
        SANDBOX_POLICY: safe("getContextOrder", "SANDBOX_POLICY"),
        APPROVAL_POLICY: safe("getContextOrder", "APPROVAL_POLICY"),
        SUBAGENT_DELEGATION: safe("getContextOrder", "SUBAGENT_DELEGATION"),
      },
    };
  }

  // ── 校验：保存前挡住明显不合法的东西 ───────────────────────
  function validateBlocks(blocks) {
    const errs = [];
    if (!Array.isArray(blocks)) return ["数据格式不对：blocks 必须是数组"];
    const seen = new Set();
    blocks.forEach((b, i) => {
      const at = `第 ${i + 1} 个块`;
      if (!b || typeof b !== "object") return errs.push(`${at}：不是对象`);
      if (b.type !== "system" && b.type !== "context") return errs.push(`${at}：类型必须是 system 或 context`);
      const title = String(b.title || "").trim();
      if (!title) errs.push(`${at}：标题不能为空`);
      const key = `${b.type}:${title}`;
      if (title) {
        if (seen.has(key)) errs.push(`「${title}」在同类下重复了，段名会撞车导致注册失败`);
        seen.add(key);
      }
      if (b.order !== undefined && b.order !== null && b.order !== "" && !Number.isFinite(Number(b.order))) {
        errs.push(`${at}：排序必须是数字`);
      }
      if (b.enabled === undefined) b.enabled = true;
    });
    return errs;
  }

  // ── 数据通道：webServer 路由（同源）──────────────────────
  function json(res, code, obj) {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(obj));
  }
  function readBody(req) {
    return new Promise((resolve) => {
      let buf = "";
      req.on("data", (c) => {
        buf += c;
        if (buf.length > 4e6) { try { req.destroy(); } catch (e) {} }
      });
      req.on("end", () => resolve(buf));
      req.on("error", () => resolve(""));
    });
  }
  const parseJson = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

  async function handler(req, res) {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const p = url.pathname.slice(ROUTE_PREFIX.length) || "/";
      const q = url.searchParams;

      const snapshot = () => ({
        file: dataFile,
        raw: state.raw,
        blocks: state.blocks,
        history: listHistory(),
        errors: registerErrors,
        minOrder: MIN_ORDER,
        anchors: buildAnchors(),
        defaults: { system: DEFAULT_SYSTEM_ORDER, context: DEFAULT_CONTEXT_ORDER },
      });

      // 读状态
      if (req.method === "GET" && (p === "/state" || p === "/")) return json(res, 200, snapshot());

      // 实时预览：调官方装配
      if (req.method === "POST" && p === "/preview") {
        const body = parseJson(await readBody(req)) || {};
        const out = { ok: true, scopes: [], errors: [...registerErrors] };
        // 全局
        try {
          out.global = await buildPreview(undefined);
          out.scopes.push("global");
        } catch (e) {
          out.ok = false;
          out.errors.push(`全局装配失败：${e?.message || e}`);
        }
        // 当前活跃 agent（可能有 agent 作用域专属的段）
        try {
          // ctx.get 是拿「可选服务」的官方写法。直接写 ctx.agents 会在没声明
          // inject 时抛 'cannot get property "agents" without inject'，
          // 把 agent 作用域的段全漏掉。
          const agentsSvc = ctx.get ? ctx.get("agents") : undefined;
          const agents = agentsSvc?.list?.();
          if (Array.isArray(agents) && agents.length) {
            const scoped = [];
            for (const a of agents) {
              try {
                const r = await buildPreview(a);
                scoped.push({ id: a?.id ?? "agent", ...r });
              } catch (e) {
                out.errors.push(`agent「${a?.id}」装配失败：${e?.message || e}`);
              }
            }
            if (scoped.length) { out.scoped = scoped; out.scopes.push("agent"); }
          }
        } catch (e) {
          out.errors.push(`读取活跃 agent 失败：${e?.message || e}`);
        }
        // 只传作用域里明确要求的那部分（避免把整个 agent 对象序列化出去）
        return json(res, 200, out);
      }

      // 读某份历史原文
      if (req.method === "GET" && p === "/raw") {
        const safe = path.basename(q.get("name") || "");
        if (!safe) return json(res, 400, { error: "缺少 name" });
        try {
          return json(res, 200, { name: safe, raw: fs.readFileSync(path.join(historyDir, safe), "utf8") });
        } catch (e) {
          return json(res, 404, { error: "找不到这份历史" });
        }
      }

      // 某份历史 vs 当前版本的差异
      if (req.method === "GET" && p === "/diff") {
        const safe = path.basename(q.get("name") || "");
        if (!safe) return json(res, 400, { error: "缺少 name" });
        let old = "";
        try {
          old = fs.readFileSync(path.join(historyDir, safe), "utf8");
        } catch (e) {
          return json(res, 404, { error: "找不到这份历史" });
        }
        const baseName = path.basename(q.get("base") || "");
        let base = readRaw();
        let baseLabel = "当前版本";
        if (baseName) {
          try {
            base = fs.readFileSync(path.join(historyDir, baseName), "utf8");
            baseLabel = baseName;
          } catch (e) {}
        }
        return json(res, 200, { name: safe, base: baseLabel, ...diffLines(old, base) });
      }

      // 钉住 / 取消钉住
      if (req.method === "POST" && p === "/pin") {
        const body = parseJson(await readBody(req)) || {};
        const safe = path.basename(String(body.name || ""));
        if (!safe) return json(res, 400, { error: "缺少 name" });
        const pinned = readPinned();
        if (body.pinned === false) pinned.delete(safe);
        else pinned.add(safe);
        writePinned(pinned);
        return json(res, 200, { ok: true, history: listHistory() });
      }

      // 保存（带校验）
      if (req.method === "POST" && p === "/save") {
        const body = parseJson(await readBody(req));
        const blocks = body && body.blocks;
        const errs = validateBlocks(blocks);
        if (errs.length) return json(res, 400, { error: errs[0], errors: errs });
        const raw = serializeBlocks(blocks);
        const backupName = backup();
        try {
          fs.writeFileSync(dataFile, raw, "utf8");
        } catch (e) {
          return json(res, 500, { error: `写入失败：${e?.message}` });
        }
        reload("保存");
        return json(res, 200, { ok: true, backup: backupName, ...snapshot() });
      }

      // 恢复某份历史
      if (req.method === "POST" && p === "/restore") {
        const body = parseJson(await readBody(req)) || {};
        const safe = path.basename(String(body.name || ""));
        if (!safe) return json(res, 400, { error: "缺少 name" });
        let raw = "";
        try {
          raw = fs.readFileSync(path.join(historyDir, safe), "utf8");
        } catch (e) {
          return json(res, 404, { error: "找不到这份历史" });
        }
        backup();
        try {
          fs.writeFileSync(dataFile, raw, "utf8");
        } catch (e) {
          return json(res, 500, { error: `写入失败：${e?.message}` });
        }
        reload("恢复历史");
        return json(res, 200, { ok: true, ...snapshot() });
      }

      return json(res, 404, { error: "未知接口" });
    } catch (e) {
      try { json(res, 500, { error: String(e?.message || e) }); } catch (e2) {}
    }
  }

  let routeDisposer = null;
  try {
    if (ctx.webServer && typeof ctx.webServer.register === "function") {
      routeDisposer = ctx.webServer.register({ kind: "prefix", path: ROUTE_PREFIX, handler });
      log(`[gw-text-inject] 数据端点已注册：${ROUTE_PREFIX}/state`);
    } else {
      warn("[gw-text-inject] 未找到 ctx.webServer，设置页数据通道不可用（注入功能不受影响）");
    }
  } catch (e) {
    warn(`[gw-text-inject] 注册数据端点失败: ${e?.message}`);
  }

  // ── 清理 ───────────────────────────────────────────────────
  function dispose() {
    disposed = true;
    clearTimeout(reloadTimer);
    releaseAll(sysDisposers);
    releaseAll(ctxDisposers);
    release(routeDisposer);
    release(watcher);
  }

  // 这里必须用 ctx.effect 登记清理，**不能**只靠 `return dispose`。
  //
  // 坑：cordis 的 isConstructor() 只看函数有没有 .prototype，而 function 声明天生
  // 带 prototype（箭头函数/async 函数没有）。所以插件导出的 apply 会被判定为「构造
  // 函数」，加载时走的是 `new apply(ctx, config)` —— 而 new 会丢弃返回值。
  // 结果：`return dispose` 在真实加载路径下等于没写，路由永远摘不掉（实测卸载后
  // /gw-text-inject 仍占用，重复注册报 duplicate prefix route）。
  // 官方插件（dsh-time-context 等）同样用 function 声明，一律靠 ctx.effect 收尾。
  //
  // dispose 是幂等的（数组已空、null 直接跳过），万一调用方同时拿到返回值也不会出事。
  if (typeof ctx.effect === "function") {
    ctx.effect(() => dispose, "@gw/dsh-text-inject");
  }
  return dispose;
}

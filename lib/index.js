// lib/index.js — @gw/dsh-text-inject host 半（Node 端，跑在 dsh 主进程）。
//
// 职责：
//   1. 读写用户数据文件（默认 ~/.dsh/text-inject/inject.md，可用 config.file 改）
//   2. [system] 块 → ctx.systemPrompt.section(...)  每轮进系统提示词
//   3. [context] 块 → agent/pre-step 合成 user 消息注入会话（kind 去重 + trigger 门控）
//   4. fs.watch 热加载：改文件保存即生效，不用重启 dsh
//   5. 注册 webServer 路由 /gw-text-inject/*，供设置页前端读写数据 + 历史备份
//
// 依赖：systemPrompt（@deepseek-ai/dsh-base 首包提供）、
//       webServer（@deepseek-ai/dsh-host-webserver 提供）。
// 前端没有本地文件桥，所以数据通道走 host 的 webServer 路由（同源，无 CORS、不额外占端口）。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { parseBlocks, serializeBlocks } from "./parser.js";

/** Cordis plugin name. */
export const name = "@gw/dsh-text-inject";

// 硬依赖声明（cordis 红线：访问 ctx.xxx 必须先 inject，否则 apply 期直接抛错）。
export const inject = ["systemPrompt", "webServer"];

const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../lib
const SEED_FILE = path.resolve(HERE, "..", "inject.md"); // 包内种子模板
const DEFAULT_DATA_FILE = path.join(os.homedir(), ".dsh", "text-inject", "inject.md");
const ROUTE_PREFIX = "/gw-text-inject";
const MAX_HISTORY = 30;
const SEP = "-".repeat(32);

/**
 * Mount the plugin.
 * @param ctx - host cordis context.
 * @param config - `{ file?: string }` 覆盖数据文件路径。
 * @returns disposer 清理所有注册。
 */
export function apply(ctx, config = {}) {
  const dataFile = config.file ? path.resolve(String(config.file)) : DEFAULT_DATA_FILE;
  const dataDir = path.dirname(dataFile);
  const historyDir = path.join(dataDir, "history");

  function log(...args) {
    try {
      if (ctx.logger && typeof ctx.logger.info === "function") ctx.logger.info(...args);
    } catch (e) {}
  }
  function warn(...args) {
    try {
      if (ctx.logger && typeof ctx.logger.warn === "function") ctx.logger.warn(...args);
    } catch (e) {}
  }

  function ensureDirs() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
      if (!fs.existsSync(dataFile)) {
        let seed = "";
        try {
          seed = fs.readFileSync(SEED_FILE, "utf8");
        } catch (e) {}
        if (!seed) seed = "# @gw/dsh-text-inject\n\n## [system] 示例\norder: 40\n\n在这里写注入内容。\n";
        fs.writeFileSync(dataFile, seed, "utf8");
      }
    } catch (e) {
      warn(`[gw-text-inject] 初始化数据目录失败: ${e && e.message}`);
    }
  }

  function readRaw() {
    try {
      return fs.readFileSync(dataFile, "utf8");
    } catch (e) {
      return "";
    }
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
      `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    );
  }

  function listHistory() {
    try {
      return fs
        .readdirSync(historyDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
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
  }

  function backup() {
    try {
      const cur = readRaw();
      if (!cur.trim()) return null;
      const name = `inject-${stamp()}.md`;
      fs.writeFileSync(path.join(historyDir, name), cur, "utf8");
      const all = fs
        .readdirSync(historyDir)
        .filter((f) => f.endsWith(".md"))
        .sort();
      while (all.length > MAX_HISTORY) {
        const old = all.shift();
        try {
          fs.unlinkSync(path.join(historyDir, old));
        } catch (e) {}
      }
      return name;
    } catch (e) {
      warn(`[gw-text-inject] 备份失败: ${e && e.message}`);
      return null;
    }
  }

  // ── 状态 ────────────────────────────────────────────────
  let state = { raw: "", blocks: [] };
  let sysDisposers = [];
  let watcher = null;
  let reloadTimer = null;

  function loadState() {
    const raw = readRaw();
    state = { raw, blocks: parseBlocks(raw) };
    return state;
  }

  function registerSystem() {
    for (const d of sysDisposers) {
      try {
        if (d && typeof d.dispose === "function") d.dispose();
      } catch (e) {}
    }
    sysDisposers = [];
    if (!ctx.systemPrompt || typeof ctx.systemPrompt.section !== "function") return;
    let n = 0;
    for (const b of state.blocks) {
      if (b.type !== "system" || !b.enabled || !b.body) continue;
      try {
        const d = ctx.systemPrompt.section({
          name: `gw-text-inject:${b.name}`,
          order: typeof b.order === "number" ? b.order : 40,
          text: `\n\n${SEP}\n${b.body}\n${SEP}`,
        });
        if (d && typeof d.dispose === "function") sysDisposers.push(d);
        n++;
      } catch (e) {
        warn(`[gw-text-inject] 注册系统块失败(${b.name}): ${e && e.message}`);
      }
    }
    log(`[gw-text-inject] 已注册 ${n} 个系统提示词块`);
  }

  function reload() {
    loadState();
    registerSystem();
    log(`[gw-text-inject] 已热加载：${state.blocks.length} 个块`);
  }

  ensureDirs();
  loadState();
  registerSystem();
  log(
    `[gw-text-inject] 已加载：system ${state.blocks.filter((b) => b.type === "system").length} / ` +
      `context ${state.blocks.filter((b) => b.type === "context").length}；文件 ${dataFile}`
  );

  // ── 热加载 ──────────────────────────────────────────────
  try {
    watcher = fs.watch(dataFile, () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reload, 120);
    });
  } catch (e) {
    warn(`[gw-text-inject] 监听数据文件失败: ${e && e.message}`);
  }

  // ── 上下文注入（agent/pre-step + prepend）────────────────
  let preDisposer = null;
  if (typeof ctx.on === "function") {
    preDisposer = ctx.on(
      "agent/pre-step",
      async (payload, next) => {
        const decision = await next();
        const msgs = (decision && decision.messages) || [];
        const kinds = new Set(
          msgs.filter((m) => m && m.source && m.source.kind).map((m) => m.source.kind)
        );
        const lastUser = [...msgs].reverse().find((m) => m && m.role === "user");
        const userText = lastUser
          ? (lastUser.content || []).map((c) => (c && c.text) || "").join(" ")
          : "";
        const injected = [];
        for (const b of state.blocks) {
          if (b.type !== "context" || !b.enabled || !b.body) continue;
          if (!b.kind) continue; // 没有 kind 无法去重，跳过以免重复烧 token
          if (kinds.has(b.kind)) continue;
          const triggers = String(b.trigger || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (triggers.length && !triggers.some((t) => userText.includes(t))) continue;
          injected.push({
            id: randomUUID(),
            role: "user",
            content: [{ type: "text", text: b.body }],
            source: { kind: b.kind },
          });
        }
        if (!injected.length) return decision;
        return { ...decision, messages: [...msgs, ...injected] };
      },
      { prepend: true }
    );
  }

  // ── 数据通道：webServer 路由（同源）──────────────────────
  function json(res, code, obj) {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(obj));
  }
  function readBody(req) {
    return new Promise((resolve) => {
      let buf = "";
      req.on("data", (c) => {
        buf += c;
        if (buf.length > 4e6) {
          try {
            req.destroy();
          } catch (e) {}
        }
      });
      req.on("end", () => resolve(buf));
      req.on("error", () => resolve(""));
    });
  }

  const handler = async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const p = url.pathname.slice(ROUTE_PREFIX.length) || "/";

      if (req.method === "GET" && (p === "/state" || p === "/")) {
        return json(res, 200, {
          file: dataFile,
          raw: state.raw,
          blocks: state.blocks,
          history: listHistory(),
        });
      }
      if (req.method === "GET" && p === "/raw") {
        const safe = path.basename(url.searchParams.get("name") || "");
        if (!safe) return json(res, 400, { error: "missing name" });
        try {
          const raw = fs.readFileSync(path.join(historyDir, safe), "utf8");
          return json(res, 200, { name: safe, raw });
        } catch (e) {
          return json(res, 404, { error: "history not found" });
        }
      }
      if (req.method === "POST" && p === "/save") {
        const body = await readBody(req);
        let blocks = null;
        try {
          blocks = JSON.parse(body).blocks;
        } catch (e) {}
        if (!Array.isArray(blocks)) return json(res, 400, { error: "bad payload" });
        const raw = serializeBlocks(blocks);
        const backupName = backup();
        try {
          fs.writeFileSync(dataFile, raw, "utf8");
        } catch (e) {
          return json(res, 500, { error: `write failed: ${e && e.message}` });
        }
        reload();
        return json(res, 200, {
          ok: true,
          backup: backupName,
          file: dataFile,
          raw,
          blocks: state.blocks,
          history: listHistory(),
        });
      }
      if (req.method === "POST" && p === "/restore") {
        const body = await readBody(req);
        let name = "";
        try {
          name = JSON.parse(body).name || "";
        } catch (e) {}
        const safe = path.basename(String(name));
        if (!safe) return json(res, 400, { error: "missing name" });
        let raw = "";
        try {
          raw = fs.readFileSync(path.join(historyDir, safe), "utf8");
        } catch (e) {
          return json(res, 404, { error: "history not found" });
        }
        backup();
        try {
          fs.writeFileSync(dataFile, raw, "utf8");
        } catch (e) {
          return json(res, 500, { error: `write failed: ${e && e.message}` });
        }
        reload();
        return json(res, 200, {
          ok: true,
          file: dataFile,
          raw,
          blocks: state.blocks,
          history: listHistory(),
        });
      }
      return json(res, 404, { error: "not found" });
    } catch (e) {
      try {
        json(res, 500, { error: String((e && e.message) || e) });
      } catch (e2) {}
    }
  };

  let routeDisposer = null;
  try {
    if (ctx.webServer && typeof ctx.webServer.register === "function") {
      routeDisposer = ctx.webServer.register({ kind: "prefix", path: ROUTE_PREFIX, handler });
      log(`[gw-text-inject] 数据端点已注册：${ROUTE_PREFIX}/state`);
    } else {
      warn("[gw-text-inject] 未找到 ctx.webServer，设置页数据通道不可用（注入功能不受影响）");
    }
  } catch (e) {
    warn(`[gw-text-inject] 注册数据端点失败: ${e && e.message}`);
  }

  // ── 清理 ────────────────────────────────────────────────
  return function dispose() {
    clearTimeout(reloadTimer);
    for (const d of sysDisposers) {
      try {
        if (d && typeof d.dispose === "function") d.dispose();
      } catch (e) {}
    }
    sysDisposers = [];
    if (preDisposer) {
      try {
        if (typeof preDisposer === "function") preDisposer();
        else if (typeof preDisposer.dispose === "function") preDisposer.dispose();
      } catch (e) {}
    }
    if (routeDisposer) {
      try {
        if (typeof routeDisposer === "function") routeDisposer();
        else if (typeof routeDisposer.dispose === "function") routeDisposer.dispose();
      } catch (e) {}
    }
    if (watcher && typeof watcher.close === "function") {
      try {
        watcher.close();
      } catch (e) {}
    }
  };
}

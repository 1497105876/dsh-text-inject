// lib/client.js — @gw/dsh-text-inject 浏览器半（client plugin bundle）。
//
// 由 dsh-client-modules 在 /plugins/@gw/dsh-text-inject/client.js 加载，经
// 内置 cordis Loader 的 lazy-CJS 模块表（window.__ModuleLoader__.load）执行。
// factory 体是 plain CJS，require() 由 shell 的模块表解析；react 来自平台基础
// （require("react") 取 shell 注入的实例）——与 shipped ui-* 包的 tsdown bundle
// 同形（本文件形状对齐 dsh-notify-me / @linxin666/dsh-client-ui-git-graph）。
//
// 干什么：往官方设置页左侧栏注册一个「文字注入」分区（settings.section slot）。
// 数据经 host 半的 webServer 路由 /gw-text-inject/* 读写（同源 fetch，无 CORS）。
// react / slots / locale 任一缺失时直接跳过设置页，不影响 dsh 其它部分。

window.__ModuleLoader__.load({
  id: "@gw/dsh-text-inject",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // react 由平台基础提供；仅设置页需要，取不到就整段跳过。
    var React = null;
    try {
      React = require("react") || null;
    } catch (e) {
      React = null;
    }

    // ─────────────────────────── 常量 ───────────────────────────
    var NS = "@gw/dsh-text-inject";
    var API = "/gw-text-inject";
    var URL_STATE = API + "/state";
    var URL_SAVE = API + "/save";
    var URL_RESTORE = API + "/restore";
    var URL_RAW = API + "/raw";

    // ─────────────────────────── 词典 ───────────────────────────
    var UI_zh = {
      nav: "文字注入",
      blurb: "把文字注入到系统提示词（每轮生效）或会话上下文。内容存于独立文件，保存即热加载，无需重启 dsh。",
      fileLabel: "数据文件：",
      loading: "加载中…",
      endpointErr: "数据端点不可达（确认插件已加载）：",
      addSystem: "+ 系统提示词",
      addContext: "+ 上下文",
      typeSystem: "系统提示词",
      typeContext: "上下文",
      everyTurn: "每轮注入",
      disabled: "已禁用",
      edit: "编辑",
      del: "删除",
      empty: "还没有块。点上面按钮新增一个。",
      emptyBody: "（正文为空）",
      newBlock: "新增块",
      editBlock: "编辑块",
      type: "类型",
      name: "名称",
      body: "正文",
      triggerPh: "关键词1,关键词2（留空=每轮）",
      ok: "确定",
      cancel: "取消",
      enable: "启用",
      disable: "禁用",
      needName: "请先填写名称",
      saving: "保存中…",
      saved: "已保存 ✓ 已热加载",
      savedBackup: "已保存 ✓ 已热加载，备份 ",
      saveFail: "保存失败：",
      restoring: "恢复中…",
      restored: "已恢复 ✓",
      restoreFail: "恢复失败：",
      history: "历史备份",
      noHistory: "暂无备份（每次保存会自动备份上一版）",
      view: "查看",
      restore: "恢复",
      close: "关闭",
      confirmDel: "确定删除这个块？",
      confirmRestore: "确定用这份备份覆盖当前内容？",
    };
    var UI_en = {
      nav: "Text injection",
      blurb: "Inject text into the system prompt (every turn) or the session context. Content lives in a standalone file and hot-reloads on save — no dsh restart needed.",
      fileLabel: "Data file: ",
      loading: "Loading…",
      endpointErr: "Data endpoint unreachable (is the plugin loaded?): ",
      addSystem: "+ System prompt",
      addContext: "+ Context",
      typeSystem: "System prompt",
      typeContext: "Context",
      everyTurn: "every turn",
      disabled: "disabled",
      edit: "Edit",
      del: "Delete",
      empty: "No blocks yet. Use the buttons above to add one.",
      emptyBody: "(empty body)",
      newBlock: "New block",
      editBlock: "Edit block",
      type: "Type",
      name: "Name",
      body: "Body",
      triggerPh: "kw1,kw2 (empty = every turn)",
      ok: "OK",
      cancel: "Cancel",
      enable: "Enable",
      disable: "Disable",
      needName: "Please enter a name",
      saving: "Saving…",
      saved: "Saved ✓ hot-reloaded",
      savedBackup: "Saved ✓ hot-reloaded, backup ",
      saveFail: "Save failed: ",
      restoring: "Restoring…",
      restored: "Restored ✓",
      restoreFail: "Restore failed: ",
      history: "Backups",
      noHistory: "No backups yet (each save backs up the previous version)",
      view: "View",
      restore: "Restore",
      close: "Close",
      confirmDel: "Delete this block?",
      confirmRestore: "Overwrite current content with this backup?",
    };

    // ─────────────────────── DOM / React 助手 ───────────────────
    function h(tag, props) {
      var args = [tag, props == null ? null : props];
      for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
      return React.createElement.apply(React, args);
    }
    function assign(a, b) {
      var o = {};
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
      for (var k2 in b) if (Object.prototype.hasOwnProperty.call(b, k2)) o[k2] = b[k2];
      return o;
    }
    function fmtTime(ms) {
      try {
        var d = new Date(ms);
        var p = function (n) {
          return String(n).padStart(2, "0");
        };
        return (
          d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
          " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
        );
      } catch (e) {
        return String(ms);
      }
    }
    function sameKindCount(blocks) {
      var m = {};
      for (var i = 0; i < blocks.length; i++) {
        var k = blocks[i] && blocks[i].kind;
        if (k) m[k] = (m[k] || 0) + 1;
      }
      return m;
    }

    // ─────────────────────────── CSS ────────────────────────────
    var UI_CSS =
      ".gti-wrap{width:100%;max-width:820px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));font-size:14px;box-sizing:border-box}" +
      ".gti-title{font-size:20px;font-weight:700;margin:0}" +
      ".gti-blurb{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9))}" +
      ".gti-hint,.gti-file,.gti-msg{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9));margin:0;word-break:break-all}" +
      ".gti-err{font-size:12px;color:#d9534f;margin:0;word-break:break-all}" +
      ".gti-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
      ".gti-btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:transparent;color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:inherit;line-height:1.3}" +
      ".gti-btn:hover{background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.1))}" +
      ".gti-btn[disabled]{opacity:.45;cursor:default}" +
      ".gti-primary{background:var(--dsw-alias-state-business-primary,#3b82f6);border-color:transparent;color:#fff}" +
      ".gti-danger{color:#d9534f;border-color:rgba(217,83,79,.45)}" +
      ".gti-sm{padding:3px 10px;font-size:12px}" +
      ".gti-link{border:0;padding:4px 0;font-weight:600;font-size:13px}" +
      ".gti-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,rgba(128,128,128,.05));border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:6px}" +
      ".gti-off{opacity:.55}" +
      ".gti-cardHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".gti-spacer{flex:1}" +
      ".gti-name{font-weight:600;font-size:14px}" +
      ".gti-badge{font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px}" +
      ".gti-bSys{background:rgba(80,160,255,.16);color:#3b82f6}" +
      ".gti-bCtx{background:rgba(120,220,150,.18);color:#22a06b}" +
      ".gti-bOff{background:rgba(217,83,79,.16);color:#d9534f}" +
      ".gti-meta{font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9));font-family:ui-monospace,Menlo,Consolas,monospace}" +
      ".gti-body{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,rgba(60,60,60,.9));white-space:pre-wrap;word-break:break-word}" +
      ".gti-editor{border:1px solid var(--dsw-alias-state-business-primary,#3b82f6);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.04))}" +
      ".gti-h3{font-size:15px;font-weight:600;margin:0}" +
      ".gti-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}" +
      ".gti-row{display:flex;gap:10px;flex-wrap:wrap}" +
      ".gti-label{font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9))}" +
      ".gti-input,.gti-textarea{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;box-sizing:border-box;width:100%}" +
      ".gti-textarea{min-height:140px;resize:vertical;line-height:20px;font-family:ui-monospace,Menlo,Consolas,monospace}" +
      ".gti-sec{display:flex;flex-direction:column;gap:8px;margin-top:6px}" +
      ".gti-hist{display:flex;flex-direction:column;gap:6px}" +
      ".gti-histRow{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9));border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));padding-bottom:6px}" +
      ".gti-histName{font-family:ui-monospace,Menlo,Consolas,monospace}" +
      ".gti-histView{display:flex;flex-direction:column;gap:8px}" +
      ".gti-pre{max-height:260px;overflow:auto;font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.08));border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-word;margin:0}";
    (function injectStyle() {
      try {
        if (typeof document === "undefined" || typeof document.createElement !== "function") return;
        var tagId = "gw-text-inject/settings";
        if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]")) return;
        var s = document.createElement("style");
        s.dataset.plugin = "gw-text-inject";
        s.dataset.pluginCss = tagId;
        s.textContent = UI_CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    })();

    // ─────────────────────────── 组件 ───────────────────────────
    function View(props) {
      var T = typeof props.t === "function" ? props.t : function (k) { return k; };

      var st = React.useState({ loading: true, error: "", file: "", blocks: [], history: [] });
      var data = st[0];
      var setData = st[1];

      var dft = React.useState(null);
      var draft = dft[0];
      var setDraft = dft[1];

      var ms = React.useState("");
      var msg = ms[0];
      var setMsg = ms[1];

      var bs = React.useState(false);
      var busy = bs[0];
      var setBusy = bs[1];

      var hs = React.useState(false);
      var histOpen = hs[0];
      var setHistOpen = hs[1];

      var hvs = React.useState(null);
      var histView = hvs[0];
      var setHistView = hvs[1];

      function applyState(d) {
        setData({
          loading: false,
          error: "",
          file: (d && d.file) || "",
          blocks: (d && d.blocks) || [],
          history: (d && d.history) || [],
        });
      }

      function load() {
        setBusy(true);
        fetch(URL_STATE, { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (d) { applyState(d); setBusy(false); })
          .catch(function (e) {
            setData({ loading: false, error: String(e), file: "", blocks: [], history: [] });
            setBusy(false);
          });
      }
      React.useEffect(function () { load(); }, []);

      function save(blocks) {
        setBusy(true);
        setMsg(T("saving"));
        fetch(URL_SAVE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: blocks }),
        })
          .then(function (r) {
            return r.json().then(function (d) { return { ok: r.ok, d: d }; });
          })
          .then(function (res) {
            if (!res.ok || (res.d && res.d.error)) {
              setMsg(T("saveFail") + ((res.d && res.d.error) || ""));
              setBusy(false);
              return;
            }
            applyState(res.d);
            setMsg(res.d && res.d.backup ? T("savedBackup") + res.d.backup : T("saved"));
            setDraft(null);
            setBusy(false);
          })
          .catch(function (e) { setMsg(T("saveFail") + e); setBusy(false); });
      }

      function restore(name) {
        setBusy(true);
        setMsg(T("restoring"));
        fetch(URL_RESTORE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name }),
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            applyState(d);
            setMsg(T("restored"));
            setHistView(null);
            setDraft(null);
            setBusy(false);
          })
          .catch(function (e) { setMsg(T("restoreFail") + e); setBusy(false); });
      }

      function viewHist(name) {
        fetch(URL_RAW + "?name=" + encodeURIComponent(name), { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (d) { setHistView({ name: (d && d.name) || name, raw: (d && d.raw) || "" }); })
          .catch(function (e) { setMsg(T("endpointErr") + e); });
      }

      function newDraft(type) {
        setMsg("");
        setDraft({ index: -1, type: type || "system", name: "", order: 40, kind: "", trigger: "", enabled: true, body: "" });
      }
      function editBlock(i) {
        var b = data.blocks[i];
        if (!b) return;
        setMsg("");
        setDraft({
          index: i,
          type: b.type === "context" ? "context" : "system",
          name: b.name || "",
          order: typeof b.order === "number" ? b.order : 40,
          kind: b.kind || "",
          trigger: b.trigger || "",
          enabled: b.enabled !== false,
          body: b.body || "",
        });
      }
      function commitDraft() {
        var d = draft;
        if (!d) return;
        if (!String(d.name || "").trim()) {
          setMsg(T("needName"));
          return;
        }
        var block = {
          type: d.type === "context" ? "context" : "system",
          name: String(d.name).trim(),
          order: parseInt(d.order, 10) || 40,
          kind: d.type === "context" ? String(d.kind || "").trim() : "",
          trigger: d.type === "context" ? String(d.trigger || "").trim() : "",
          enabled: d.enabled !== false,
          body: d.body || "",
        };
        if (block.type === "context" && !block.kind) {
          block.kind = "gw-" + Date.now().toString(36);
        }
        var next = data.blocks.slice();
        if (d.index >= 0) next[d.index] = block;
        else next.push(block);
        save(next);
      }
      function removeBlock(i) {
        try {
          if (typeof window !== "undefined" && window.confirm && !window.confirm(T("confirmDel"))) return;
        } catch (e) {}
        var next = data.blocks.slice();
        next.splice(i, 1);
        save(next);
      }

      function badge(text, cls) {
        return h("span", { className: "gti-badge " + cls }, text);
      }
      function blockCard(b, i) {
        var isSys = b.type !== "context";
        var body = b.body || "";
        var preview = body ? body.slice(0, 160) + (body.length > 160 ? " …" : "") : T("emptyBody");
        return h(
          "div",
          { className: "gti-card" + (b.enabled === false ? " gti-off" : ""), key: "blk" + i },
          h(
            "div",
            { className: "gti-cardHead" },
            badge(isSys ? T("typeSystem") : T("typeContext"), isSys ? "gti-bSys" : "gti-bCtx"),
            h("span", { className: "gti-name" }, b.name || "未命名"),
            b.enabled === false ? badge(T("disabled"), "gti-bOff") : null,
            h("span", { className: "gti-spacer" }),
            h("button", { className: "gti-btn gti-sm", disabled: busy, onClick: function () { editBlock(i); } }, T("edit")),
            h("button", { className: "gti-btn gti-sm gti-danger", disabled: busy, onClick: function () { removeBlock(i); } }, T("del"))
          ),
          h(
            "div",
            { className: "gti-meta" },
            isSys
              ? "order: " + (typeof b.order === "number" ? b.order : 40)
              : "kind: " + (b.kind || "-") + (b.trigger ? "  | trigger: " + b.trigger : "  | " + T("everyTurn"))
          ),
          h("div", { className: "gti-body" }, preview)
        );
      }

      function editor() {
        var d = draft;
        var isSys = d.type !== "context";
        var dupWarn = null;
        try {
          if (!isSys && d.kind && d.index < 0) {
            var cnt = sameKindCount(data.blocks)[d.kind];
            if (cnt) dupWarn = "kind 已存在（" + cnt + " 个），保存后会与已有块冲突去重。";
          }
        } catch (e) {}
        return h(
          "div",
          { className: "gti-editor" },
          h("h3", { className: "gti-h3" }, d.index >= 0 ? T("editBlock") : T("newBlock")),
          h(
            "div",
            { className: "gti-row" },
            h(
              "div",
              { className: "gti-field" },
              h("label", { className: "gti-label" }, T("type")),
              h(
                "select",
                {
                  className: "gti-input",
                  value: d.type,
                  onChange: function (e) { setDraft(assign(d, { type: e.target.value })); },
                },
                h("option", { value: "system" }, T("typeSystem")),
                h("option", { value: "context" }, T("typeContext"))
              )
            ),
            h(
              "div",
              { className: "gti-field" },
              h("label", { className: "gti-label" }, T("name")),
              h("input", {
                className: "gti-input",
                value: d.name,
                onChange: function (e) { setDraft(assign(d, { name: e.target.value })); },
              })
            ),
            isSys
              ? h(
                  "div",
                  { className: "gti-field", style: { maxWidth: "110px" } },
                  h("label", { className: "gti-label" }, "order"),
                  h("input", {
                    className: "gti-input",
                    type: "number",
                    value: d.order,
                    onChange: function (e) { setDraft(assign(d, { order: e.target.value })); },
                  })
                )
              : null
          ),
          !isSys
            ? h(
                "div",
                { className: "gti-row" },
                h(
                  "div",
                  { className: "gti-field" },
                  h("label", { className: "gti-label" }, "kind"),
                  h("input", {
                    className: "gti-input",
                    value: d.kind,
                    placeholder: "gw-xxx",
                    onChange: function (e) { setDraft(assign(d, { kind: e.target.value })); },
                  })
                ),
                h(
                  "div",
                  { className: "gti-field" },
                  h("label", { className: "gti-label" }, "trigger"),
                  h("input", {
                    className: "gti-input",
                    value: d.trigger,
                    placeholder: T("triggerPh"),
                    onChange: function (e) { setDraft(assign(d, { trigger: e.target.value })); },
                  })
                )
              )
            : null,
          dupWarn ? h("p", { className: "gti-hint" }, dupWarn) : null,
          h(
            "div",
            { className: "gti-field" },
            h("label", { className: "gti-label" }, T("body")),
            h("textarea", {
              className: "gti-textarea",
              value: d.body,
              spellCheck: false,
              onChange: function (e) { setDraft(assign(d, { body: e.target.value })); },
            })
          ),
          h(
            "div",
            { className: "gti-bar" },
            h("button", { className: "gti-btn gti-primary", disabled: busy, onClick: commitDraft }, T("ok")),
            h("button", { className: "gti-btn", disabled: busy, onClick: function () { setDraft(null); } }, T("cancel")),
            h(
              "button",
              { className: "gti-btn", onClick: function () { setDraft(assign(d, { enabled: d.enabled === false })); } },
              d.enabled === false ? T("enable") : T("disable")
            )
          )
        );
      }

      function historySection() {
        return h(
          "div",
          { className: "gti-sec" },
          h(
            "button",
            {
              className: "gti-btn gti-link",
              onClick: function () { setHistView(null); setHistOpen(!histOpen); },
            },
            T("history") + " (" + data.history.length + ")"
          ),
          histOpen
            ? data.history.length
              ? h(
                  "div",
                  { className: "gti-hist" },
                  data.history.map(function (it) {
                    return h(
                      "div",
                      { className: "gti-histRow", key: it.name },
                      h("span", { className: "gti-histName" }, fmtTime(it.mtime)),
                      h("span", { className: "gti-spacer" }),
                      h("button", { className: "gti-btn gti-sm", onClick: function () { viewHist(it.name); } }, T("view")),
                      h(
                        "button",
                        {
                          className: "gti-btn gti-sm gti-primary",
                          disabled: busy,
                          onClick: function () {
                            try {
                              if (typeof window !== "undefined" && window.confirm && !window.confirm(T("confirmRestore"))) return;
                            } catch (e) {}
                            restore(it.name);
                          },
                        },
                        T("restore")
                      )
                    );
                  })
                )
              : h("p", { className: "gti-hint" }, T("noHistory"))
            : null,
          histView
            ? h(
                "div",
                { className: "gti-histView" },
                h(
                  "div",
                  { className: "gti-bar" },
                  h("span", { className: "gti-name" }, histView.name),
                  h("span", { className: "gti-spacer" }),
                  h("button", { className: "gti-btn gti-sm", onClick: function () { setHistView(null); } }, T("close"))
                ),
                h("pre", { className: "gti-pre" }, histView.raw)
              )
            : null
        );
      }

      if (data.loading) {
        return h("div", { className: "gti-wrap" }, h("p", { className: "gti-hint" }, T("loading")));
      }

      var sysCount = 0;
      var ctxCount = 0;
      for (var i = 0; i < data.blocks.length; i++) {
        if (data.blocks[i] && data.blocks[i].type === "context") ctxCount++;
        else sysCount++;
      }

      return h(
        "div",
        { className: "gti-wrap" },
        h("h2", { className: "gti-title" }, T("nav")),
        h("p", { className: "gti-blurb" }, T("blurb")),
        data.error ? h("p", { className: "gti-err" }, T("endpointErr") + data.error) : null,
        data.file ? h("p", { className: "gti-file" }, T("fileLabel") + data.file) : null,
        h(
          "div",
          { className: "gti-bar" },
          h("button", { className: "gti-btn gti-primary", disabled: busy, onClick: function () { newDraft("system"); } }, T("addSystem")),
          h("button", { className: "gti-btn", disabled: busy, onClick: function () { newDraft("context"); } }, T("addContext")),
          h("button", { className: "gti-btn", disabled: busy, onClick: load }, "刷新"),
          h("span", { className: "gti-msg" }, msg)
        ),
        h("p", { className: "gti-hint" }, T("typeSystem") + " " + sysCount + " 个 / " + T("typeContext") + " " + ctxCount + " 个"),
        data.blocks.length
          ? h("div", { className: "gti-sec" }, data.blocks.map(function (b, idx) { return blockCard(b, idx); }))
          : h("p", { className: "gti-hint" }, T("empty")),
        draft ? editor() : null,
        historySection()
      );
    }

    // ─────────────────────────── 插件体 ─────────────────────────
    // 硬依赖的服务名（cordis inject）：slots 提供 slot 注册表，locale 提供词典。
    var inject = ["slots", "locale"];

    /**
     * Client plugin body: 往设置页左侧栏注册「文字注入」分区。
     * @param ctx - client root context.
     */
    function apply(ctx) {
      try {
        var ok =
          React &&
          React.createElement &&
          ctx &&
          ctx.slots &&
          ctx.locale &&
          typeof ctx.slots.inject === "function" &&
          typeof ctx.slots.register === "function" &&
          typeof ctx.locale.register === "function" &&
          typeof ctx.locale.bind === "function";
        if (!ok) {
          try { console.warn("[gw-text-inject] react/slots/locale 不全，跳过设置页注册"); } catch (e) {}
          return;
        }
        var registerDict = function () {
          try { ctx.locale.register(NS, { zh: UI_zh, en: UI_en }); } catch (e) {}
        };
        if (typeof ctx.effect === "function") ctx.effect(registerDict, "gw-text-inject: dictionaries");
        else registerDict();
        var t = ctx.locale.bind(NS);
        ctx.slots.inject("settings.section", function () {
          return ctx.slots.register(
            {
              name: "settings.section",
              id: "gw-text-inject",
              order: 60,
              label: function () { return t("nav"); },
              locale: NS,
              inject: function () { return { t: t }; },
            },
            function () { return React.createElement(View, { ctx: ctx, t: t }); }
          );
        });
        try { console.log("[gw-text-inject] 设置页「文字注入」已注册"); } catch (e) {}
      } catch (e) {
        try { console.error("[gw-text-inject] 设置页注册失败", e); } catch (e2) {}
      }
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});

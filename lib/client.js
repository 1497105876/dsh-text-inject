// lib/client.js — @gw/dsh-text-inject 浏览器半（client plugin bundle）。
//
// 由 dsh-client-modules 在 /plugins/@gw/dsh-text-inject/client.js 加载，经内置
// cordis Loader 的 lazy-CJS 模块表（window.__ModuleLoader__.load）执行。
// factory 体是 plain CJS，require() 由 shell 的模块表解析；react 来自平台基础。
// 形状对齐 shipped ui-* 包的 tsdown bundle。
//
// 干什么：往官方设置页左侧栏注册一个「文字注入」分区（settings.section slot）。
// 数据经 host 半的 webServer 路由 /gw-text-inject/* 读写（同源 fetch，无 CORS）。

window.__ModuleLoader__.load({
  id: "@gw/dsh-text-inject",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = null;
    try { React = require("react") || null; } catch (e) { React = null; }

    var NS = "@gw/dsh-text-inject";
    var API = "/gw-text-inject";

    // ───────────────────────── 词典 ─────────────────────────
    var UI_zh = {
      nav: "文字注入",
      title: "文字注入",
      blurb: "把一段文字常驻注入系统提示词或运行时上下文。改完下一轮对话就生效，不用重启。",

      // 列表
      blocks: "块",
      newSystem: "＋ 系统提示词",
      newContext: "＋ 上下文",
      empty: "还没有块。点上面的按钮新建一个。",

      // 类型
      typeSystem: "系统提示词",
      typeContext: "上下文",
      typeSystemHint: "常驻在提示词里，每轮都在。适合人格、硬性约束、输出格式要求。",
      typeContextHint: "作为运行时「快照」注入，内容没变不会重复发。适合背景资料、当前任务上下文。",

      // 字段
      titleLabel: "标题",
      titlePlaceholder: "给这个块起个名字（必填）",
      titleRequired: "标题不能为空",
      descLabel: "描述",
      descOptional: "可选",
      descPlaceholder: "一句话说明它是干嘛的（只有你看得到，不会进提示词）",
      bodyLabel: "正文",
      bodyPlaceholder: "写要注入的内容…",
      positionLabel: "注入位置",
      advanced: "高级",
      advancedHint: "一般不用动",
      orderLabel: "排序值（order）",

      // 开关
      enabled: "启用",
      disabledBadge: "已停用",
      offBar: "这个块已停用，正文不会进提示词。点左边开关可以直接启用。",

      // 位置选项
      posAfterPersona: "人格设定之后",
      posAfterPlan: "计划策略之后",
      posAfterFileRef: "文件引用语法之后",
      posAfterTools: "工具说明之后",
      posLast: "最末尾",
      posCustom: "自定义…",
      fixedZone: "固定区（不可选）",
      posAfterSandbox: "沙箱策略之后",
      posAfterApproval: "审批策略之后",
      posAfterSubagent: "子代理说明之后",
      posCustomTitle: "自定义排序值",
      posMinHint: "最小可用值",

      // 预览
      preview: "模型视角",
      previewHint: "这里显示下一轮请求实际会用到的内容。改动在下一轮生效，不用重启。",
      previewCaveat: "此处显示应用注册接口的装配结果；若别的插件绕过标准接口直接改写请求，可能不在此列出。",
      tabSystem: "系统提示词",
      tabContext: "运行时上下文",
      segOfficial: "官方",
      segMine: "我的",
      chars: "字符",
      myShare: "我的占比",
      refresh: "刷新",
      previewEmpty: "（当前没有内容）",
      previewLoading: "正在装配…",
      previewError: "装配失败",
      noSeg: "这一段当前没有贡献任何内容。",

      // 历史
      history: "历史备份",
      histCount: "共 {n} 份",
      pin: "钉住",
      unpin: "取消钉住",
      pinned: "已钉住",
      pinnedHint: "钉住的不会被自动清理",
      restore: "恢复",
      view: "查看",
      diff: "对比",
      close: "关闭",
      emptyHistory: "还没有历史备份。每次保存都会自动备份一份。",

      // 保存
      save: "保存",
      saving: "保存中…",
      saved: "已保存，下一轮生效",
      unsaved: "有未保存的改动",
      noChange: "没有改动",
      delete: "删除",
      confirmDelete: "确定删除这个块？",
      confirmRestore: "确定恢复这份历史？当前内容会先备份一份。",
      errorPrefix: "出错了：",
      loadFailed: "读取数据失败",
    };

    var UI_en = {
      nav: "Text Inject",
      title: "Text Injection",
      blurb: "Inject text into the system prompt or runtime context. Changes apply on the next turn — no restart needed.",

      blocks: "Blocks",
      newSystem: "+ System prompt",
      newContext: "+ Context",
      empty: "No blocks yet. Use the buttons above to create one.",

      typeSystem: "System prompt",
      typeContext: "Context",
      typeSystemHint: "Always present in the prompt. Good for persona, hard constraints, output format.",
      typeContextHint: "Injected as a runtime snapshot; unchanged content is not re-sent. Good for background info.",

      titleLabel: "Title",
      titlePlaceholder: "Name this block (required)",
      titleRequired: "Title cannot be empty",
      descLabel: "Description",
      descOptional: "optional",
      descPlaceholder: "One line about what this is for (never enters the prompt)",
      bodyLabel: "Body",
      bodyPlaceholder: "Write the text to inject…",
      positionLabel: "Position",
      advanced: "Advanced",
      advancedHint: "usually untouched",
      orderLabel: "Order value",

      enabled: "Enabled",
      disabledBadge: "disabled",
      offBar: "This block is disabled — its text will not reach the prompt. Use the switch to enable it.",

      posAfterPersona: "after persona",
      posAfterPlan: "after plan policy",
      posAfterFileRef: "after file reference",
      posAfterTools: "after tool docs",
      posLast: "at the very end",
      posCustom: "custom…",
      fixedZone: "fixed (not selectable)",
      posAfterSandbox: "after sandbox policy",
      posAfterApproval: "after approval policy",
      posAfterSubagent: "after subagent delegation",
      posCustomTitle: "Custom order",
      posMinHint: "minimum",

      preview: "Model view",
      previewHint: "What the next request will actually use. Changes apply next turn, no restart.",
      previewCaveat: "Shows the result assembled through the app's registration API; plugins that bypass it may not appear here.",
      tabSystem: "System prompt",
      tabContext: "Runtime context",
      segOfficial: "official",
      segMine: "mine",
      chars: "chars",
      myShare: "my share",
      refresh: "Refresh",
      previewEmpty: "(nothing here)",
      previewLoading: "assembling…",
      previewError: "assembly failed",
      noSeg: "This side currently contributes nothing.",

      history: "History",
      histCount: "{n} saved",
      pin: "Pin",
      unpin: "Unpin",
      pinned: "pinned",
      pinnedHint: "Pinned entries are never auto-pruned",
      restore: "Restore",
      view: "View",
      diff: "Diff",
      close: "Close",
      emptyHistory: "No backups yet. Every save creates one.",

      save: "Save",
      saving: "Saving…",
      saved: "Saved — applies next turn",
      unsaved: "Unsaved changes",
      noChange: "No changes",
      delete: "Delete",
      confirmDelete: "Delete this block?",
      confirmRestore: "Restore this version? The current one is backed up first.",
      errorPrefix: "Error: ",
      loadFailed: "Failed to load data",
    };

    var t = function (k, vars) {
      var s = (UI_zh[k] !== undefined ? UI_zh[k] : UI_en[k]) || k;
      if (vars) for (var key in vars) s = s.replace("{" + key + "}", vars[key]);
      return s;
    };

    // ───────────────────────── CSS（浅色）─────────────────────────
    var CSS_ID = "gti-css-v2";
    var CSS = [
      ".gti-root{--gti-bg:#fff;--gti-bg2:#fafafa;--gti-bg3:#f4f5f7;--gti-line:#e8eaed;--gti-line2:#dcdfe4;",
      "--gti-tx:#1f2328;--gti-tx2:#5b6270;--gti-tx3:#8b929e;--gti-acc:#2b6cb0;--gti-acc-soft:#eef4fb;",
      "--gti-sys:#7c5cd6;--gti-sys-soft:#f3effc;--gti-ctx:#1a8a72;--gti-ctx-soft:#eaf7f3;--gti-warn:#b4690e;",
      "display:flex;height:100%;min-height:0;color:var(--gti-tx);font-size:13.5px;line-height:1.6;}",
      ".gti-root *{box-sizing:border-box;}",
      ".gti-root button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;}",
      ".gti-root input,.gti-root textarea{font:inherit;color:inherit;}",
      ".gti-root ::-webkit-scrollbar{width:10px;height:10px;}",
      ".gti-root ::-webkit-scrollbar-thumb{background:#d8dbe0;border-radius:6px;border:3px solid transparent;background-clip:content-box;}",
      ".gti-root ::-webkit-scrollbar-thumb:hover{background:#c3c7cd;background-clip:content-box;}",
      ".gti-root ::-webkit-scrollbar-track{background:transparent;}",

      // 三栏
      ".gti-cols{display:flex;flex:1;min-height:0;width:100%;}",
      ".gti-col{display:flex;flex-direction:column;min-height:0;min-width:0;}",
      ".gti-col-l{width:236px;flex:0 0 236px;border-right:1px solid var(--gti-line);background:var(--gti-bg2);}",
      ".gti-col-m{flex:1 1 auto;min-width:280px;}",
      ".gti-col-r{width:392px;flex:0 0 392px;border-left:1px solid var(--gti-line);background:var(--gti-bg2);}",
      ".gti-head{padding:11px 14px;border-bottom:1px solid var(--gti-line);display:flex;align-items:center;gap:8px;flex:0 0 auto;background:var(--gti-bg);}",
      ".gti-body{flex:1 1 auto;overflow:auto;min-height:0;}",
      ".gti-hd-t{font-weight:600;font-size:12.5px;letter-spacing:.02em;color:var(--gti-tx2);text-transform:uppercase;}",
      ".gti-hd-sub{font-size:12px;color:var(--gti-tx3);font-weight:400;text-transform:none;letter-spacing:0;}",

      // 左栏
      ".gti-ltop{padding:10px 12px;display:flex;flex-direction:column;gap:7px;border-bottom:1px solid var(--gti-line);}",
      ".gti-add{display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:8px;",
      "font-size:12.5px;font-weight:600;border:1px solid var(--gti-line2);background:var(--gti-bg);transition:.13s;}",
      ".gti-add:hover{background:var(--gti-acc-soft);border-color:var(--gti-acc);color:var(--gti-acc);}",
      ".gti-add.sys:hover{border-color:var(--gti-sys);background:var(--gti-sys-soft);color:var(--gti-sys);}",
      ".gti-add.ctx:hover{border-color:var(--gti-ctx);background:var(--gti-ctx-soft);color:var(--gti-ctx);}",
      ".gti-list{padding:6px;display:flex;flex-direction:column;gap:3px;}",
      ".gti-item{display:flex;gap:8px;padding:8px 9px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:.12s;align-items:flex-start;}",
      ".gti-item:hover{background:var(--gti-bg3);}",
      ".gti-item.on{background:var(--gti-bg);border-color:var(--gti-line2);box-shadow:0 1px 3px rgba(16,24,40,.05);}",
      ".gti-item.off .gti-it-t{color:var(--gti-tx3);}",
      ".gti-sw{flex:0 0 auto;width:30px;height:17px;border-radius:9px;background:#cfd3d9;position:relative;transition:.15s;margin-top:3px;}",
      ".gti-sw::after{content:'';position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 2px rgba(0,0,0,.2);}",
      ".gti-sw.on{background:var(--gti-acc);}",
      ".gti-sw.on.sys{background:var(--gti-sys);}",
      ".gti-sw.on.ctx{background:var(--gti-ctx);}",
      ".gti-sw.on::after{left:15px;}",
      ".gti-it-main{flex:1;min-width:0;}",
      ".gti-it-t{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".gti-it-d{font-size:11.5px;color:var(--gti-tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}",
      ".gti-it-meta{display:flex;gap:5px;align-items:center;margin-top:4px;flex-wrap:wrap;}",
      ".gti-bdg{font-size:10.5px;padding:1px 5px;border-radius:4px;font-weight:600;letter-spacing:.01em;}",
      ".gti-bdg.sys{background:var(--gti-sys-soft);color:var(--gti-sys);}",
      ".gti-bdg.ctx{background:var(--gti-ctx-soft);color:var(--gti-ctx);}",
      ".gti-bdg.ord{background:var(--gti-bg3);color:var(--gti-tx3);font-weight:500;}",
      ".gti-empty{padding:24px 16px;text-align:center;color:var(--gti-tx3);font-size:12.5px;line-height:1.7;}",
      ".gti-lfoot{padding:9px 12px;border-top:1px solid var(--gti-line);font-size:11.5px;color:var(--gti-tx3);}",

      // 中栏
      ".gti-ed{display:flex;flex-direction:column;height:100%;min-height:0;}",
      ".gti-edtop{padding:14px 18px;border-bottom:1px solid var(--gti-line);background:var(--gti-bg);}",
      ".gti-fld{margin-bottom:11px;}",
      ".gti-lb{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--gti-tx2);margin-bottom:5px;}",
      ".gti-lb .opt{font-weight:400;color:var(--gti-tx3);font-size:11px;}",
      ".gti-in,.gti-ta{width:100%;padding:8px 10px;border:1px solid var(--gti-line2);border-radius:8px;background:var(--gti-bg);transition:.13s;outline:none;}",
      ".gti-in:focus,.gti-ta:focus{border-color:var(--gti-acc);box-shadow:0 0 0 3px rgba(43,108,176,.11);}",
      ".gti-in.bad{border-color:#d0483a;box-shadow:0 0 0 3px rgba(208,72,58,.1);}",
      ".gti-in::placeholder,.gti-ta::placeholder{color:#adb3bc;}",
      ".gti-row{display:flex;gap:12px;}",
      ".gti-row>.gti-fld{flex:1;}",
      ".gti-bodywrap{padding:14px 18px;flex:1;display:flex;flex-direction:column;min-height:0;}",
      ".gti-ta.main{flex:1;min-height:150px;resize:vertical;font-family:inherit;line-height:1.65;}",
      ".gti-sel{width:100%;padding:8px 10px;border:1px solid var(--gti-line2);border-radius:8px;background:var(--gti-bg);outline:none;transition:.13s;appearance:none;",
      "background-image:linear-gradient(45deg,transparent 50%,#8b929e 50%),linear-gradient(135deg,#8b929e 50%,transparent 50%);",
      "background-position:calc(100% - 15px) 16px,calc(100% - 10px) 16px;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:32px;}",
      ".gti-sel:focus{border-color:var(--gti-acc);box-shadow:0 0 0 3px rgba(43,108,176,.11);}",
      ".gti-adv{border-top:1px dashed var(--gti-line);margin-top:2px;padding-top:9px;}",
      ".gti-advbtn{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--gti-tx3);font-weight:500;padding:2px 0;}",
      ".gti-advbtn:hover{color:var(--gti-tx2);}",
      ".gti-caret{font-size:9px;transition:transform .15s;display:inline-block;}",
      ".gti-caret.open{transform:rotate(90deg);}",
      ".gti-err{background:#fdf2f0;border:1px solid #f3d5d0;color:#a8392c;padding:7px 10px;border-radius:7px;font-size:12px;margin-top:8px;}",
      ".gti-warn{background:#fdf7ec;border:1px solid #f0e0c4;color:var(--gti-warn);padding:7px 10px;border-radius:7px;font-size:12px;margin-top:8px;}",
      ".gti-offbar{display:flex;align-items:center;gap:8px;background:#fdf4e4;border:1px solid #f0dcbc;border-left:3px solid var(--gti-warn);color:#8a5109;padding:9px 11px;border-radius:7px;font-size:12.5px;margin-bottom:12px;font-weight:500;}",
      ".gti-offbar .gti-sw{margin-top:0;}",
      ".gti-edfoot{padding:10px 18px;border-top:1px solid var(--gti-line);display:flex;align-items:center;gap:10px;background:var(--gti-bg);}",
      ".gti-status{font-size:12px;color:var(--gti-tx3);flex:1;}",
      ".gti-status.ok{color:#1a8a72;}.gti-status.dirty{color:var(--gti-warn);}",
      ".gti-btn{padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;border:1px solid var(--gti-line2);background:var(--gti-bg);transition:.13s;}",
      ".gti-btn:hover{background:var(--gti-bg3);}",
      ".gti-btn.pri{background:var(--gti-acc);border-color:var(--gti-acc);color:#fff;}",
      ".gti-btn.pri:hover{background:#245d99;}",
      ".gti-btn.pri:disabled{opacity:.5;cursor:default;background:var(--gti-acc);}",
      ".gti-btn.dgr{color:#b2382b;}",
      ".gti-btn.dgr:hover{background:#fdf2f0;border-color:#f0d2cc;}",
      ".gti-btn.sm{padding:4px 9px;font-size:11.5px;}",

      // 右栏
      ".gti-tabs{display:flex;gap:2px;padding:9px 12px 0;}",
      ".gti-tab{padding:6px 11px;border-radius:7px 7px 0 0;font-size:12.5px;font-weight:500;color:var(--gti-tx3);border:1px solid transparent;border-bottom:0;}",
      ".gti-tab:hover{color:var(--gti-tx2);}",
      ".gti-tab.on{background:var(--gti-bg);border-color:var(--gti-line);color:var(--gti-tx);font-weight:600;}",
      ".gti-tabsbar{border-bottom:1px solid var(--gti-line);padding:0 12px;display:flex;align-items:center;gap:8px;}",
      ".gti-tabsbar .gti-tab{margin-bottom:-1px;}",
      ".gti-rnote{margin:8px 12px 0;padding:8px 10px;background:var(--gti-bg);border:1px solid var(--gti-line);border-radius:7px;font-size:11.5px;color:var(--gti-tx3);line-height:1.6;}",
      ".gti-segs{display:flex;gap:14px;padding:10px 14px 6px;font-size:11.5px;}",
      ".gti-seg{display:flex;align-items:center;gap:5px;color:var(--gti-tx3);}",
      ".gti-dot{width:8px;height:8px;border-radius:2px;flex:0 0 auto;}",
      ".gti-dot.of{background:#c9ced6;}.gti-dot.mi{background:var(--gti-acc);}",
      ".gti-prev{padding:4px 12px 12px;display:flex;flex-direction:column;gap:6px;}",
      ".gti-sec{border:1px solid var(--gti-line);border-radius:8px;background:var(--gti-bg);overflow:hidden;}",
      ".gti-sec.mine{border-left:3px solid var(--gti-acc);}",
      ".gti-sec-hd{display:flex;align-items:center;gap:7px;padding:7px 10px;cursor:pointer;}",
      ".gti-sec-hd:hover{background:var(--gti-bg2);}",
      ".gti-sec-nm{font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".gti-sec.mine .gti-sec-nm{color:var(--gti-acc);}",
      ".gti-sec-nm .fix{font-weight:400;color:var(--gti-tx3);font-size:11px;}",
      ".gti-sec-n{font-size:11px;color:var(--gti-tx3);flex:0 0 auto;}",
      ".gti-sec-tx{padding:0 10px 9px;font-size:11.5px;color:var(--gti-tx2);white-space:pre-wrap;word-break:break-word;",
      "font-family:ui-monospace,Consolas,monospace;line-height:1.6;max-height:190px;overflow:auto;border-top:1px solid var(--gti-line);padding-top:8px;background:var(--gti-bg2);}",
      ".gti-stats{margin:6px 12px 12px;padding:9px 11px;background:var(--gti-bg);border:1px solid var(--gti-line);border-radius:8px;font-size:11.5px;}",
      ".gti-stat{display:flex;justify-content:space-between;padding:2.5px 0;}",
      ".gti-stat .k{color:var(--gti-tx3);}.gti-stat .v{font-weight:600;}",
      ".gti-bar{height:5px;border-radius:3px;background:var(--gti-bg3);overflow:hidden;margin-top:7px;}",
      ".gti-bar>i{display:block;height:100%;background:var(--gti-acc);border-radius:3px;}",
      ".gti-checks{margin-top:8px;padding-top:7px;border-top:1px dashed var(--gti-line);display:flex;flex-direction:column;gap:3px;}",
      ".gti-chk{display:flex;gap:6px;font-size:11.5px;color:var(--gti-tx2);align-items:flex-start;}",
      ".gti-chk.bad{color:#a8392c;}.gti-chk.good{color:#1a8a72;}",
      ".gti-hinti{font-size:11.5px;color:var(--gti-tx3);padding:14px;text-align:center;}",

      // 历史
      ".gti-hist{border-top:1px solid var(--gti-line);flex:0 0 auto;max-height:44%;display:flex;flex-direction:column;background:var(--gti-bg);}",
      ".gti-hh{padding:9px 12px;display:flex;align-items:center;gap:7px;cursor:pointer;border-bottom:1px solid var(--gti-line);}",
      ".gti-hh:hover{background:var(--gti-bg2);}",
      ".gti-hl{flex:1;overflow:auto;padding:4px 8px 8px;min-height:0;}",
      ".gti-hi{padding:7px 9px;border-radius:7px;border:1px solid transparent;display:flex;flex-direction:column;gap:4px;}",
      ".gti-hi:hover{background:var(--gti-bg2);}",
      ".gti-hi.cur{background:var(--gti-acc-soft);border-color:#cfe0f2;}",
      ".gti-hi-r1{display:flex;align-items:center;gap:6px;}",
      ".gti-hi-n{font-size:11.5px;font-family:ui-monospace,Consolas,monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".gti-hi-d{font-size:11px;color:var(--gti-tx3);display:flex;gap:8px;}",
      ".gti-d-add{color:#1a8a72;}.gti-d-del{color:#b2382b;}",
      ".gti-pin{font-size:11px;padding:1px 5px;border-radius:4px;background:#fdf7ec;color:var(--gti-warn);font-weight:600;}",
      ".gti-hi-act{display:flex;gap:5px;margin-left:auto;opacity:0;transition:.13s;}",
      ".gti-hi:hover .gti-hi-act{opacity:1;}",
      ".gti-hi.cur .gti-hi-act{opacity:1;}",

      // 弹层
      ".gti-ov{position:fixed;inset:0;background:rgba(20,24,32,.34);display:flex;align-items:center;justify-content:center;z-index:9999;padding:28px;}",
      ".gti-dlg{background:var(--gti-bg);border-radius:12px;width:min(720px,100%);max-height:100%;display:flex;flex-direction:column;box-shadow:0 16px 44px rgba(16,24,40,.19);overflow:hidden;}",
      ".gti-dlg-hd{padding:13px 16px;border-bottom:1px solid var(--gti-line);display:flex;align-items:center;gap:9px;}",
      ".gti-dlg-hd .t{font-weight:600;font-size:13.5px;flex:1;}",
      ".gti-dlg-bd{padding:14px 16px;overflow:auto;min-height:0;}",
      ".gti-dlg-ft{padding:11px 16px;border-top:1px solid var(--gti-line);display:flex;gap:9px;justify-content:flex-end;}",
      ".gti-df{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;}",
      ".gti-df .a{background:#eefaf3;color:#146b52;}",
      ".gti-df .d{background:#fdf2f0;color:#a8392c;}",
      ".gti-df .c{color:var(--gti-tx3);}",
      ".gti-cl{position:relative;}",
      ".gti-cl-t{position:absolute;top:9px;right:14px;font-size:10.5px;color:#aab0b9;pointer-events:none;}",
      ".gti-mono-wrap{position:relative;}",

      // 小屏
      "@media (max-width:1180px){.gti-col-r{width:320px;flex:0 0 320px;}.gti-col-l{width:200px;flex:0 0 200px;}}",
    ].join("");

    function ensureCss() {
      try {
        if (document.getElementById(CSS_ID)) return;
        var el = document.createElement("style");
        el.id = CSS_ID;
        el.textContent = CSS;
        document.head.appendChild(el);
      } catch (e) {}
    }

    // ───────────────────────── 工具 ─────────────────────────
    var h = React.createElement;

    function post(url, body) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      }).then(function (r) { return r.json().catch(function () { return {}; }); });
    }
    function get(url) {
      return fetch(url, { cache: "no-store" }).then(function (r) { return r.json().catch(function () { return {}; }); });
    }

    /** 已保存内容 → 文本（用于判断有没有改动）。 */
    function norm(b) {
      return JSON.stringify({
        t: b.type, n: String(b.title || "").trim(), d: String(b.desc || "").trim(),
        o: b.order, e: b.enabled !== false, y: String(b.body || ""),
      });
    }

    var TIMESTAMP_RE = /^inject-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$/;
    function prettyTime(name) {
      var m = TIMESTAMP_RE.exec(name || "");
      if (!m) return name;
      return m[4] + ":" + m[5] + ":" + m[6] + "  " + m[2] + "-" + m[3] + (m[7] ? "  (" + m[7] + ")" : "");
    }
    function fmtSize(n) {
      if (!n) return "0 B";
      if (n < 1024) return n + " B";
      return (n / 1024).toFixed(1) + " KB";
    }

    // ───────────────────────── 组件 ─────────────────────────

    /** 开关 */
    function Switch(props) {
      var on = props.on !== false;
      return h("div", {
        className: "gti-sw" + (on ? " on" : "") + (props.kind ? " " + props.kind : ""),
        onClick: function (e) {
          e.stopPropagation();
          if (props.onChange) props.onChange(!on);
        },
        title: on ? t("enabled") : t("disabledBadge"),
      });
    }

    /** 折叠的一段预览 */
    function PreviewSection(props) {
      var s = props.section;
      var open = props.open;
      return h("div", { className: "gti-sec" + (s.mine ? " mine" : "") },
        h("div", { className: "gti-sec-hd", onClick: function () { props.onToggle(s.name); } },
          h("span", { className: "gti-caret" + (open ? " open" : "") }, "\u25B6"),
          h("span", { className: "gti-sec-nm" },
            s.name,
            s.order !== null && s.order !== undefined ? h("span", { className: "fix" }, "  @" + s.order) : null
          ),
          h("span", { className: "gti-sec-n" }, s.chars + " " + t("chars"))
        ),
        open ? h("div", { className: "gti-sec-tx" }, s.text || t("previewEmpty")) : null
      );
    }

    /** 主界面 */
    function View(props) {
      ensureCss();
      var ctx = props.ctx;

      var S = React.useState({
        ready: false, error: "", file: "", blocks: [], history: [], errors: [],
        anchors: null, defaults: { system: 40, context: 125 }, minOrder: 0,
      });
      var st = S[0], setSt = S[1];

      var Sel = React.useState(0);          // 当前选中块索引，-1 = 没选
      var sel = Sel[0], setSel = Sel[1];

      var D = React.useState({});            // 编辑草稿（选中块的副本）
      var draft = D[0], setDraft = D[1];

      var V = React.useState({ mode: "system", loading: false, data: null, err: "", open: {} });
      var pv = V[0], setPv = V[1];

      var T = React.useState("system");      // 右栏 tab
      var tab = T[0], setTab = T[1];

      var Hh = React.useState(false);        // 历史区展开
      var histOpen = Hh[0], setHistOpen = Hh[1];

      var Mod = React.useState(null);        // 弹层 {kind, ...}
      var modal = Mod[0], setModal = Mod[1];

      var Busy = React.useState(false);      // 保存中
      var busy = Busy[0], setBusy = Busy[1];

      var Av = React.useState(false);        // 高级面板展开
      var advOpen = Av[0], setAdvOpen = Av[1];

      var cur = st.blocks[sel] || null;
      var dirty = !!(cur && draft && norm(cur) !== norm(draft));
      var titleBad = !!(draft && !String(draft.title || "").trim());

      // 拉状态
      function load(keepSel) {
        return get(API + "/state").then(function (d) {
          if (d && d.error) {
            setSt(function (p) { return Object.assign({}, p, { ready: true, error: d.error }); });
            return;
          }
          setSt(function (p) {
            return Object.assign({}, p, {
              ready: true, error: "", file: d.file || "", blocks: d.blocks || [],
              history: d.history || [], errors: d.errors || [],
              anchors: d.anchors || p.anchors, defaults: d.defaults || p.defaults,
              minOrder: typeof d.minOrder === "number" ? d.minOrder : 0,
            });
          });
          var next = keepSel === undefined ? sel : keepSel;
          var bl = d.blocks || [];
          if (!bl.length) { setSel(-1); setDraft({}); }
          else {
            var i = Math.min(Math.max(next, 0), bl.length - 1);
            setSel(i); setDraft(Object.assign({}, bl[i]));
          }
        }).catch(function () {
          setSt(function (p) { return Object.assign({}, p, { ready: true, error: t("loadFailed") }); });
        });
      }

      // 装配预览（去抖）
      var pvTimer = React.useRef(null);
      function refreshPreview() {
        setPv(function (p) { return Object.assign({}, p, { loading: true, err: "" }); });
        if (pvTimer.current) clearTimeout(pvTimer.current);
        pvTimer.current = setTimeout(function () {
          post(API + "/preview", {}).then(function (d) {
            if (!d || d.ok === false) {
              setPv(function (p) {
                return Object.assign({}, p, { loading: false, err: (d && (d.errors || [])[0]) || t("previewError"), data: d || null });
              });
              return;
            }
            setPv(function (p) { return Object.assign({}, p, { loading: false, err: "", data: d }); });
          }).catch(function () {
            setPv(function (p) { return Object.assign({}, p, { loading: false, err: t("previewError") }); });
          });
        }, 220);
      }

      React.useEffect(function () {
        load().then(function () { refreshPreview(); });
        return function () { if (pvTimer.current) clearTimeout(pvTimer.current); };
      }, []);

      // 选中项变化 → 同步草稿
      function pick(i) {
        if (dirty && !window.confirm(t("unsaved") + " — 切过去会丢掉，继续？")) return;
        setSel(i);
        setDraft(st.blocks[i] ? Object.assign({}, st.blocks[i]) : {});
        setAdvOpen(false);
      }

      function patch(k, v) {
        setDraft(function (p) { var n = Object.assign({}, p); n[k] = v; return n; });
      }

      // 增
      function addBlock(type) {
        if (dirty && !window.confirm(t("unsaved") + " — 新建会丢掉，继续？")) return;
        var base = type === "system" ? t("typeSystem") : t("typeContext");
        var n = 1;
        var titles = {};
        for (var i = 0; i < st.blocks.length; i++) titles[st.blocks[i].title] = 1;
        var name = base;
        while (titles[name]) { n++; name = base + " " + n; }
        var bl = st.blocks.slice();
        var nb = {
          type: type, title: name, desc: "", order: null, enabled: true, body: "",
        };
        bl.push(nb);
        // 本地先放进去，真正的保存由用户点「保存」
        setSt(function (p) { return Object.assign({}, p, { blocks: bl }); });
        setSel(bl.length - 1);
        setDraft(Object.assign({}, nb));
        setAdvOpen(false);
      }

      // 删
      function delBlock() {
        if (!cur) return;
        if (!window.confirm(t("confirmDelete"))) return;
        var bl = st.blocks.slice();
        bl.splice(sel, 1);
        save({ blocks: bl }, true).then(function () {
          setSt(function (p) { return Object.assign({}, p, { blocks: bl }); });
          var i = bl.length ? Math.min(sel, bl.length - 1) : -1;
          setSel(i);
          setDraft(i >= 0 ? Object.assign({}, bl[i]) : {});
        });
      }

      // 保存
      function save(payload, silent) {
        setBusy(true);
        var body = payload || { blocks: buildBlocks() };
        return post(API + "/save", body).then(function (d) {
          setBusy(false);
          if (!d || d.error) {
            setSt(function (p) { return Object.assign({}, p, { error: (d && d.error) || "save failed", errors: (d && d.errors) || [] }); });
            return d;
          }
          setSt(function (p) {
            return Object.assign({}, p, {
              error: "", errors: d.errors || [], blocks: d.blocks || p.blocks,
              history: d.history || p.history, raw: d.raw || p.raw, file: d.file || p.file,
            });
          });
          // 保存后草稿对齐（可能被校验规范化过）
          var bl = d.blocks || [];
          if (bl.length) {
            var i = Math.min(Math.max(sel, 0), bl.length - 1);
            setSel(i); setDraft(Object.assign({}, bl[i]));
          }
          refreshPreview();
          if (!silent) setModal(null);
          return d;
        }).catch(function () {
          setBusy(false);
          setSt(function (p) { return Object.assign({}, p, { error: "save failed" }); });
        });
      }

      /** 把当前草稿合并回块列表。 */
      function buildBlocks() {
        var bl = st.blocks.slice();
        if (sel >= 0 && draft) {
          var n = Object.assign({}, draft);
          n.order = n.order === null || n.order === undefined || n.order === "" ? null : Number(n.order);
          if (!Number.isFinite(n.order)) n.order = null;
          bl[sel] = n;
        }
        return bl;
      }

      // 开关（直接存，符合「切了就生效」）
      function toggleAt(i) {
        var bl = st.blocks.slice();
        bl[i] = Object.assign({}, bl[i], { enabled: bl[i].enabled === false });
        setSt(function (p) { return Object.assign({}, p, { blocks: bl }); });
        if (i === sel) setDraft(function (p) { return Object.assign({}, p, { enabled: bl[i].enabled }); });
        save({ blocks: bl }, true).then(function () {
          setSt(function (p) { return Object.assign({}, p, { blocks: bl }); });
        });
      }

      // 历史操作
      function pinHist(name, pinned) {
        post(API + "/pin", { name: name, pinned: pinned }).then(function (d) {
          if (d && d.history) setSt(function (p) { return Object.assign({}, p, { history: d.history }); });
        });
      }
      function viewHist(name) {
        get(API + "/raw?name=" + encodeURIComponent(name)).then(function (d) {
          setModal({ kind: "raw", title: name, text: (d && d.raw) || d.error || "" });
        });
      }
      function diffHist(name) {
        get(API + "/diff?name=" + encodeURIComponent(name)).then(function (d) {
          if (!d || d.error) return setModal({ kind: "raw", title: name, text: (d && d.error) || "" });
          setModal({ kind: "diff", title: name, base: d.base, lines: d.lines || [], added: d.added, removed: d.removed });
        });
      }
      function restoreHist(name) {
        if (!window.confirm(t("confirmRestore"))) return;
        post(API + "/restore", { name: name }).then(function (d) {
          if (d && d.error) return setSt(function (p) { return Object.assign({}, p, { error: d.error }); });
          setModal(null);
          load(sel).then(function () { refreshPreview(); });
        });
      }

      // ── 位置选项 ────────────────────────────────────────────
      function posOptions(type) {
        var a = st.anchors || {};
        var out = [];
        if (type === "context") {
          var c = a.context || {};
          var cs = [["SANDBOX_POLICY", t("posAfterSandbox")], ["APPROVAL_POLICY", t("posAfterApproval")], ["SUBAGENT_DELEGATION", t("posAfterSubagent")]];
          for (var i = 0; i < cs.length; i++) {
            var ord = c[cs[i][0]];
            if (typeof ord === "number") out.push({ label: cs[i][1] + "  @" + (ord + 5), value: ord + 5 });
          }
          out.unshift({ label: "最前  @0", value: 0 });
          out.push({ label: t("posLast"), value: 9999 });
        } else {
          var s = a.system || {};
          var ss = [
            ["DEPLOYMENT_PERSONA", t("posAfterPersona"), 40],
            ["PLAN_POLICY", t("posAfterPlan"), 550],
            ["FILE_REFERENCE", t("posAfterFileRef"), 950],
            ["TOOL_BASH", t("posAfterTools"), 4000],
            ["DELIVERABLE_FILE_REFERENCES", null, 9500],
          ];
          var min = typeof st.minOrder === "number" ? st.minOrder : 0;
          // 只有 MIN_ORDER 放开到 0 之前时，这些固定锚点才可选
          if (min < (s.DEPLOYMENT_PERSONA || 0)) {
            var fixed = [
              ["HARNESS_IDENTITY", "固定开场白之后", -999],
              ["HARNESS_SOURCE", "来源信息之后", -890],
              ["WEB_SURFACE", "界面标识之后", -790],
            ];
            for (var k = 0; k < fixed.length; k++) {
              var fo = s[fixed[k][0]];
              if (typeof fo === "number") out.push({ label: fixed[k][1], value: fo + 1 });
            }
          }
          for (var j = 0; j < ss.length; j++) {
            var anchor = s[ss[j][0]];
            var val = ss[j][2];
            if (typeof anchor === "number") val = ss[j][1] ? anchor + 50 : anchor + 50;
            if (val < min) continue;
            out.push({ label: (ss[j][1] || "工具说明之后 / 交付文件之前") + "  @" + val, value: val });
          }
          out.sort(function (x, y) { return x.value - y.value; });
        }
        var dflt = type === "system" ? (st.defaults.system || 40) : (st.defaults.context || 125);
        var hasD = out.some(function (o) { return o.value === dflt; });
        if (!hasD) out.unshift({ label: t("posAfterPersona") + "  @" + dflt, value: dflt });
        return out;
      }

      // ── 预览数据整理 ────────────────────────────────────────
      function pvData(mode) {
        if (!pv.data) return null;
        var g = pv.data.global;
        if (!g) return null;
        return mode === "system" ? g.system : g.context;
      }

      function renderStats(mode) {
        var d = pvData(mode);
        if (!d) return null;
        var mine = 0;
        for (var i = 0; i < d.sections.length; i++) if (d.sections[i].mine) mine += d.sections[i].chars;
        var pct = d.totalChars ? Math.round((mine / d.totalChars) * 1000) / 10 : 0;
        var kids = [
          h("div", { className: "gti-stat", key: "t" }, h("span", { className: "k" }, "总计"), h("span", { className: "v" }, d.totalChars + " " + t("chars"))),
          h("div", { className: "gti-stat", key: "m" }, h("span", { className: "k" }, t("myShare")), h("span", { className: "v" }, mine + " " + t("chars") + " · " + pct + "%")),
          h("div", { className: "gti-bar", key: "b" }, h("i", { style: { width: Math.min(pct, 100) + "%" } })),
        ];
        var checks = [];
        if (st.errors.length) for (var e = 0; e < st.errors.length; e++) checks.push(h("div", { className: "gti-chk bad", key: "e" + e }, "× " + st.errors[e]));
        var onCount = 0, offCount = 0, emptyCount = 0;
        for (var b = 0; b < st.blocks.length; b++) {
          var bl = st.blocks[b];
          if (bl.type !== (mode === "system" ? "system" : "context")) continue;
          if (bl.enabled === false) offCount++;
          else if (!String(bl.body || "").trim()) emptyCount++;
          else onCount++;
        }
        checks.push(h("div", { className: "gti-chk good", key: "on" }, "✓ " + onCount + " 个启用"));
        if (offCount) checks.push(h("div", { className: "gti-chk", key: "off" }, "· " + offCount + " 个已停用"));
        if (emptyCount) checks.push(h("div", { className: "gti-chk", key: "empty" }, "· " + emptyCount + " 个正文为空，未生效"));
        var scopedN = pv.data.scoped ? pv.data.scoped.length : 0;
        if (scopedN) checks.push(h("div", { className: "gti-chk", key: "sc" }, "· 另有 " + scopedN + " 个 agent 作用域装配结果"));
        return h("div", { className: "gti-stats" }, kids,
          h("div", { className: "gti-checks" }, checks));
      }

      // ── 渲染：左栏 ─────────────────────────────────────────
      function renderLeft() {
        var items = st.blocks.map(function (b, i) {
          var on = b.enabled !== false;
          return h("div", {
            key: i,
            className: "gti-item" + (i === sel ? " on" : "") + (on ? "" : " off"),
            onClick: function () { pick(i); },
          },
            h(Switch, { on: on, kind: b.type === "system" ? "sys" : "ctx", onChange: function () { toggleAt(i); } }),
            h("div", { className: "gti-it-main" },
              h("div", { className: "gti-it-t" }, b.title || "（无标题）"),
              b.desc ? h("div", { className: "gti-it-d" }, b.desc) : null,
              h("div", { className: "gti-it-meta" },
                h("span", { className: "gti-bdg " + (b.type === "system" ? "sys" : "ctx") }, b.type === "system" ? t("typeSystem") : t("typeContext")),
                b.order !== null && b.order !== undefined ? h("span", { className: "gti-bdg ord" }, "@" + b.order) : null,
                !on ? h("span", { className: "gti-bdg ord" }, t("disabledBadge")) : null
              )
            )
          );
        });

        return h("div", { className: "gti-col gti-col-l" },
          h("div", { className: "gti-ltop" },
            h("button", { className: "gti-add sys", onClick: function () { addBlock("system"); } }, t("newSystem")),
            h("button", { className: "gti-add ctx", onClick: function () { addBlock("context"); } }, t("newContext"))
          ),
          h("div", { className: "gti-body" },
            st.blocks.length ? h("div", { className: "gti-list" }, items) : h("div", { className: "gti-empty" }, t("empty"))
          ),
          h("div", { className: "gti-lfoot" },
            h("div", null, t("blocks") + "：" + st.blocks.length),
          )
        );
      }

      // ── 渲染：中栏 ─────────────────────────────────────────
      function renderMid() {
        if (!cur) {
          return h("div", { className: "gti-col gti-col-m" },
            h("div", { className: "gti-body" }, h("div", { className: "gti-empty" }, t("empty")))
          );
        }
        var isSys = cur.type === "system";
        var opts = posOptions(cur.type);
        var dflt = isSys ? (st.defaults.system || 40) : (st.defaults.context || 125);
        var curOrder = draft.order === null || draft.order === undefined ? dflt : Number(draft.order);
        var known = opts.filter(function (o) { return o.value === curOrder; }).length > 0;

        var posOpts = opts.map(function (o) {
          return h("option", { key: "o" + o.value, value: String(o.value) }, o.label);
        });
        posOpts.push(h("option", { key: "custom", value: "__custom" }, t("posCustom")));

        return h("div", { className: "gti-col gti-col-m" },
          h("div", { className: "gti-ed" },
            h("div", { className: "gti-edtop" },
              // 停用提示条：选中停用块时明确告知「改了也不进提示词」
              cur.enabled === false || (draft && draft.enabled === false)
                ? h("div", { className: "gti-offbar" },
                    h("span", { className: "gti-sw" , onClick: function () { toggleAt(sel); } }),
                    h("span", null, t("offBar"))
                  )
                : null,
              // 标题
              h("div", { className: "gti-fld" },
                h("div", { className: "gti-lb" }, h("span", null, t("titleLabel")), h("span", { className: "opt" }, "必填")),
                h("input", {
                  className: "gti-in" + (titleBad ? " bad" : ""),
                  value: draft.title || "",
                  placeholder: t("titlePlaceholder"),
                  onChange: function (e) { patch("title", e.target.value); },
                })
              ),
              // 描述
              h("div", { className: "gti-fld", style: { marginBottom: 0 } },
                h("div", { className: "gti-lb" }, h("span", null, t("descLabel")), h("span", { className: "opt" }, t("descOptional"))),
                h("input", {
                  className: "gti-in",
                  value: draft.desc || "",
                  placeholder: t("descPlaceholder"),
                  onChange: function (e) { patch("desc", e.target.value); },
                })
              ),
              // 类型 + 位置
              h("div", { className: "gti-row", style: { marginTop: 11 } },
                h("div", { className: "gti-fld", style: { marginBottom: 0 } },
                  h("div", { className: "gti-lb" }, h("span", null, "类型")),
                  h("div", { style: { fontSize: 12.5, paddingTop: 8 } },
                    h("span", { className: "gti-bdg " + (isSys ? "sys" : "ctx") }, isSys ? t("typeSystem") : t("typeContext")),
                    h("span", { style: { color: "var(--gti-tx3)", marginLeft: 7, fontSize: 11.5 } },
                      isSys ? t("typeSystemHint") : t("typeContextHint"))
                  )
                )
              ),
              h("div", { className: "gti-fld", style: { marginTop: 11, marginBottom: 0 } },
                h("div", { className: "gti-lb" }, h("span", null, t("positionLabel"))),
                h("select", {
                  className: "gti-sel",
                  value: known ? String(curOrder) : "__custom",
                  onChange: function (e) {
                    if (e.target.value === "__custom") { setAdvOpen(true); return; }
                    patch("order", Number(e.target.value));
                  },
                }, posOpts)
              ),
              // 高级
              h("div", { className: "gti-adv" },
                h("button", { className: "gti-advbtn", onClick: function () { setAdvOpen(!advOpen); } },
                  h("span", { className: "gti-caret" + (advOpen ? " open" : "") }, "\u25B6"),
                  t("advanced"), h("span", { style: { color: "var(--gti-tx3)", fontWeight: 400 } }, "— " + t("advancedHint"))
                ),
                advOpen ? h("div", { style: { marginTop: 8 } },
                  h("div", { className: "gti-lb" }, h("span", null, t("orderLabel")), h("span", { className: "opt" }, t("posMinHint") + " " + st.minOrder)),
                  h("input", {
                    className: "gti-in", type: "number", style: { maxWidth: 160 },
                    value: draft.order === null || draft.order === undefined ? dflt : draft.order,
                    onChange: function (e) { patch("order", e.target.value === "" ? null : Number(e.target.value)); },
                  }),
                  curOrder < st.minOrder
                    ? h("div", { className: "gti-warn" }, "低于最小可用值 " + st.minOrder + "，实际会按 " + st.minOrder + " 生效")
                    : null
                ) : null
              )
            ),
            // 正文
            h("div", { className: "gti-bodywrap" },
              h("div", { className: "gti-lb" }, h("span", null, t("bodyLabel")),
                h("span", { className: "opt" }, (draft.body || "").length + " " + t("chars"))),
              h("textarea", {
                className: "gti-ta main",
                value: draft.body || "",
                placeholder: t("bodyPlaceholder"),
                onChange: function (e) { patch("body", e.target.value); },
              })
            ),
            // 底部
            h("div", { className: "gti-edfoot" },
              h("div", { className: "gti-status " + (st.error ? "" : dirty ? "dirty" : "ok") },
                st.error ? t("errorPrefix") + st.error : dirty ? t("unsaved") : t("noChange")
              ),
              h("button", { className: "gti-btn dgr", onClick: delBlock }, t("delete")),
              h("button", {
                className: "gti-btn pri", disabled: busy || titleBad || !dirty,
                onClick: function () { save(); },
              }, busy ? t("saving") : dirty ? t("save") : t("saved"))
            )
          )
        );
      }

      // ── 渲染：右栏 ─────────────────────────────────────────
      function renderRight() {
        var d = pvData(tab);
        var segs = [
          h("div", { className: "gti-seg", key: "of" }, h("span", { className: "gti-dot of" }), t("segOfficial")),
          h("div", { className: "gti-seg", key: "mi" }, h("span", { className: "gti-dot mi" }), t("segMine")),
        ];
        var list = null;
        if (pv.loading) list = h("div", { className: "gti-hinti" }, t("previewLoading"));
        else if (pv.err) list = h("div", { className: "gti-hinti" }, t("previewError") + "：" + pv.err);
        else if (!d || !d.sections.length) list = h("div", { className: "gti-hinti" }, t("noSeg"));
        else {
          var arr = [];
          for (var i = 0; i < d.sections.length; i++) {
            var s = d.sections[i];
            // 我的段排在它自己的 order 位置；官方段用顺序位次表示
            arr.push(h(PreviewSection, {
              key: s.name + ":" + i, section: s, open: !!pv.open[s.name],
              onToggle: function (nm) {
                setPv(function (p) { var o = Object.assign({}, p.open); o[nm] = !o[nm]; return Object.assign({}, p, { open: o }); });
              },
            }));
          }
          list = h("div", { className: "gti-prev" }, arr);
        }

        return h("div", { className: "gti-col gti-col-r" },
          h("div", { className: "gti-head" },
            h("span", { className: "gti-hd-t" }, t("preview")),
            h("button", {
              className: "gti-btn sm", style: { marginLeft: "auto" },
              onClick: refreshPreview,
            }, t("refresh"))
          ),
          h("div", { className: "gti-tabsbar" },
            h("div", { className: "gti-tab" + (tab === "system" ? " on" : ""), onClick: function () { setTab("system"); } }, t("tabSystem")),
            h("div", { className: "gti-tab" + (tab === "context" ? " on" : ""), onClick: function () { setTab("context"); } }, t("tabContext"))
          ),
          h("div", { className: "gti-rnote" }, t("previewHint")),
          h("div", { className: "gti-segs" }, segs),
          h("div", { className: "gti-body" }, list),
          renderStats(tab),
          h("div", { className: "gti-rnote", style: { marginBottom: 10 } }, t("previewCaveat"))
        );
      }

      // ── 渲染：历史 ─────────────────────────────────────────
      function renderHistory() {
        var rows = st.history.map(function (it) {
          var isCur = false;
          return h("div", { key: it.name, className: "gti-hi" + (isCur ? " cur" : "") },
            h("div", { className: "gti-hi-r1" },
              h("span", { className: "gti-hi-n", title: it.name }, prettyTime(it.name)),
              it.pinned ? h("span", { className: "gti-pin" }, t("pinned")) : null,
              h("div", { className: "gti-hi-act" },
                h("button", {
                  className: "gti-btn sm", title: it.pinned ? t("unpin") : t("pin"),
                  onClick: function () { pinHist(it.name, !it.pinned); },
                }, it.pinned ? "★" : "☆"),
                h("button", { className: "gti-btn sm", onClick: function () { diffHist(it.name); } }, t("diff")),
                h("button", { className: "gti-btn sm", onClick: function () { viewHist(it.name); } }, t("view")),
                h("button", { className: "gti-btn sm", onClick: function () { restoreHist(it.name); } }, t("restore"))
              )
            ),
            h("div", { className: "gti-hi-d" },
              h("span", null, fmtSize(it.size)),
              it.added || it.removed
                ? h("span", null,
                    h("span", { className: "gti-d-add" }, "+" + it.added),
                    " ",
                    h("span", { className: "gti-d-del" }, "-" + it.removed),
                    " vs 当前")
                : h("span", null, "与当前一致")
            )
          );
        });

        return h("div", { className: "gti-hist" },
          h("div", { className: "gti-hh", onClick: function () { setHistOpen(!histOpen); } },
            h("span", { className: "gti-caret" + (histOpen ? " open" : "") }, "\u25B6"),
            h("span", { className: "gti-hd-t" }, t("history")),
            h("span", { className: "gti-hd-sub", style: { marginLeft: "auto" } }, t("histCount", { n: st.history.length })),
            h("span", { style: { fontSize: 11, color: "var(--gti-tx3)" } }, t("pinnedHint"))
          ),
          histOpen
            ? (st.history.length
                ? h("div", { className: "gti-hl" }, rows)
                : h("div", { className: "gti-hinti" }, t("emptyHistory")))
            : null
        );
      }

      // ── 渲染：弹层 ─────────────────────────────────────────
      function renderModal() {
        if (!modal) return null;
        var body = null;
        if (modal.kind === "raw") {
          body = h("div", { className: "gti-df" }, modal.text || "");
        } else if (modal.kind === "diff") {
          var ls = modal.lines.map(function (l, i) {
            if (l.k === "c") return h("div", { className: "c", key: i }, "  " + l.t);
            if (l.k === "a") return h("div", { className: "a", key: i }, "+ " + l.t);
            return h("div", { className: "d", key: i }, "- " + l.t);
          });
          body = h("div", null,
            h("div", { style: { fontSize: 12, color: "var(--gti-tx3)", marginBottom: 8 } },
              "对比基准：" + modal.base + "　",
              h("span", { className: "gti-d-add" }, "+" + modal.added), " ",
              h("span", { className: "gti-d-del" }, "-" + modal.removed)),
            h("div", { className: "gti-df" }, ls)
          );
        }
        return h("div", { className: "gti-ov", onClick: function (e) { if (e.target === e.currentTarget) setModal(null); } },
          h("div", { className: "gti-dlg" },
            h("div", { className: "gti-dlg-hd" },
              h("span", { className: "t" }, modal.kind === "diff" ? t("diff") + "　" + prettyTime(modal.title) : prettyTime(modal.title))
            ),
            h("div", { className: "gti-dlg-bd" }, body),
            h("div", { className: "gti-dlg-ft" },
              h("button", { className: "gti-btn", onClick: function () { setModal(null); } }, t("close")),
              modal.kind !== "diff" ? null : null,
              h("button", {
                className: "gti-btn pri",
                onClick: function () { restoreHist(modal.title); },
              }, t("restore"))
            )
          )
        );
      }

      // ── 整体 ───────────────────────────────────────────────
      return h("div", { className: "gti-root" },
        h("div", { style: { display: "flex", flexDirection: "column", width: "100%", minHeight: 0, flex: 1 } },
          h("div", { style: { padding: "14px 18px 12px", borderBottom: "1px solid var(--gti-line)", background: "var(--gti-bg)" } },
            h("div", { style: { fontSize: 16, fontWeight: 600, letterSpacing: "-.01em" } }, t("title")),
            h("div", { style: { fontSize: 12.5, color: "var(--gti-tx2)", marginTop: 3 } }, t("blurb"))
          ),
          h("div", { className: "gti-cols" }, renderLeft(), renderMid(), renderRight()),
          renderHistory()
        ),
        renderModal()
      );
    }

    // ───────────────────────── 插件体 ─────────────────────────
    var inject = ["slots", "locale"];

    function apply(ctx) {
      if (!React) { try { console.warn("[gw-text-inject] react 不可用，跳过设置页"); } catch (e) {} return; }
      if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") {
        try { console.warn("[gw-text-inject] ctx.slots 不可用，跳过设置页"); } catch (e) {}
        return;
      }
      try { console.log("[gw-text-inject] v2 已加载"); } catch (e) {}

      // 词典：拿不到 locale 也能工作（t() 自己兜底走中文）
      try {
        if (ctx.locale && typeof ctx.locale.register === "function") ctx.locale.register(NS, { zh: UI_zh, en: UI_en });
      } catch (e) {
        try { console.warn("[gw-text-inject] 词典注册失败", e); } catch (e2) {}
      }

      try {
        ctx.slots.inject("settings.section", function () {
          return ctx.slots.register({
            name: "settings.section",
            id: "gw-text-inject",
            order: 60,
            label: function () { return t("nav"); },
            locale: NS,
            inject: function () { return { t: t }; },
          }, function () { return React.createElement(View, { ctx: ctx, t: t }); });
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

// lib/client.js — @gw/dsh-text-inject 浏览器半（client plugin bundle）。
//
// 由 dsh-client-modules 在 /plugins/@gw/dsh-text-inject/client.js 加载，经内置
// cordis Loader 的 lazy-CJS 模块表（window.__ModuleLoader__.load）执行。
// factory 体是 plain CJS，require() 由 shell 的模块表解析；react 来自平台基础。
// 形状对齐 shipped ui-* 包的 tsdown bundle。
//
// 干什么：往官方设置页左侧栏注册一个「文字注入」分区（settings.section slot）。
// 数据经 host 半的 webServer 路由 /gw-text-inject/* 读写（同源 fetch，无 CORS）。
//
// 视觉：全部走官方设计令牌（--dsw-alias-*），控件几何照抄官方 primitives 的
// module.css（开关 36×20 r10、按钮胶囊 r18/h28、输入 h32 r8、胶囊 h24、
// disclosure 行高 24+delta），所以看上去和官方控件是同一套。只应官方 token
// 而不 require primitives 模块，是为了避开「bundle 先于依赖 CSS 物化」的加载
// 顺序风险 —— 官方 primitives 的 CSS 由 dsh-web-frontend 静态产物提供，本插件
// 的 bundle 在 nonce revision 下按需加载，复刻几何比引入依赖更稳。
//
// 布局：官方设置面板是 800×800 的弹窗，左侧 nav 占 188px、options 内边距 24px
// → 本插件实际可用宽只有 564px。所以：不写死三栏像素、用 @container 容器查询
// 按面板自身宽度自适应；纵向滚动交给官方 .MI-_Aa_options（它本身 overflow-y:auto），
// 本插件不设 height:100% 去盖掉它。

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

      newSystem: "＋ 系统提示词",
      newContext: "＋ 上下文",
      blocks: "块",
      empty: "还没有块。点上面的按钮新建一个。",

      typeSystem: "系统提示词",
      typeSystemShort: "系统",
      typeContext: "上下文",
      typeContextShort: "上下文",

      titleLabel: "标题",
      titlePlaceholder: "给这个块起个名字（必填）",
      titleRequired: "标题不能为空",
      descLabel: "描述",
      descOptional: "可选",
      descPlaceholder: "一句话说明它是干嘛的（只有你看得到，不进提示词）",
      bodyLabel: "正文",
      bodyPlaceholder: "写要注入的内容…",
      positionLabel: "注入位置",
      positionHint: "决定这段文字拼在提示词里的位置",
      advanced: "高级",
      orderLabel: "排序值",

      enabled: "启用",
      disabledBadge: "已停用",
      offBar: "这个块已停用，正文不会进提示词。点左边的开关可以直接启用。",

      expand: "展开",
      collapse: "收起",
      done: "完成",
      delete: "删除",
      confirmDelete: "确定删除这个块？",

      // 位置预设（值来自 host 读到的官方段序常量）
      posFirst: "最前",
      posAfterPersona: "人格设定之后",
      posAfterPlan: "计划策略之后",
      posAfterFileRef: "文件引用之后",
      posAfterTools: "工具说明之后",
      posLast: "最末尾",
      posAfterSandbox: "沙箱策略之后",
      posAfterApproval: "审批策略之后",
      posAfterSubagent: "子代理说明之后",
      posCustom: "自定义",
      posDefault: "默认位置",
      posMinHint: "最小可用值",
      titleEmptyBlock: "有块的标题是空的，补上再保存",
      emptyBodyMark: "空正文",
      totalLabel: "总计",
      onCount: "启用",

      pageSys: "系统提示词",
      pageCtx: "上下文",
      pageViewSys: "模型视角·系统",
      pageViewCtx: "模型视角·上下文",

      preview: "模型视角",
      previewHint: "下一轮请求实际会用到的内容。改动下一轮生效，不用重启。",
      previewCaveat: "显示的是通过应用注册接口装配的结果；若别的插件绕过标准接口直接改写请求，可能不在这里。",
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
      confirmRestore: "确定恢复这份历史？当前内容会先备份一份。",

      saving: "保存中…",
      saved: "已保存，下一轮生效",
      unsaved: "有未保存的改动",
      loadFailed: "读取数据失败",
      errorPrefix: "出错了：",
    };

    var UI_en = {
      nav: "Text Inject",
      title: "Text Injection",
      blurb: "Inject text into the system prompt or runtime context. Changes apply next turn — no restart needed.",

      newSystem: "+ System prompt",
      newContext: "+ Context",
      blocks: "Blocks",
      empty: "No blocks yet. Use the buttons above to create one.",

      typeSystem: "System prompt",
      typeSystemShort: "System",
      typeContext: "Context",
      typeContextShort: "Context",

      titleLabel: "Title",
      titlePlaceholder: "Name this block (required)",
      titleRequired: "Title cannot be empty",
      descLabel: "Description",
      descOptional: "optional",
      descPlaceholder: "One line about what this is for (never enters the prompt)",
      bodyLabel: "Body",
      bodyPlaceholder: "Write the text to inject…",
      positionLabel: "Position",
      positionHint: "Where this text lands in the prompt",
      advanced: "Advanced",
      orderLabel: "Order value",

      enabled: "Enabled",
      disabledBadge: "disabled",
      offBar: "This block is disabled — its text does not reach the prompt. Use the switch to enable it.",

      expand: "Expand",
      collapse: "Collapse",
      done: "Done",
      delete: "Delete",
      confirmDelete: "Delete this block?",

      posFirst: "very first",
      posAfterPersona: "after persona",
      posAfterPlan: "after plan policy",
      posAfterFileRef: "after file reference",
      posAfterTools: "after tool docs",
      posLast: "at the very end",
      posAfterSandbox: "after sandbox policy",
      posAfterApproval: "after approval policy",
      posAfterSubagent: "after subagent delegation",
      posCustom: "custom",
      posDefault: "default",
      posMinHint: "minimum",
      titleEmptyBlock: "A block has an empty title — fill it in before saving",
      emptyBodyMark: "empty body",
      totalLabel: "total",
      onCount: "enabled",

      pageSys: "System prompt",
      pageCtx: "Context",
      pageViewSys: "Model·system",
      pageViewCtx: "Model·context",

      preview: "Model view",
      previewHint: "What the next request will actually use. Applies next turn, no restart.",
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
      confirmRestore: "Restore this version? The current one is backed up first.",

      saving: "Saving…",
      saved: "Saved — applies next turn",
      unsaved: "Unsaved changes",
      loadFailed: "Failed to load data",
      errorPrefix: "Error: ",
    };

    var t = function (k, vars) {
      var s = (UI_zh[k] !== undefined ? UI_zh[k] : UI_en[k]) || k;
      if (vars) for (var key in vars) s = s.replace("{" + key + "}", vars[key]);
      return s;
    };

    // ───────────────────────── CSS ─────────────────────────
    // 全部颜色走官方令牌（--dsw-alias-*），控件几何照抄官方 primitives。
    var CSS_ID = "gti-css-v3";
    var CSS = [
      ".gti-root{--gti-srf:var(--dsw-alias-bg-layer-2,#fff);",
      "--gti-srf2:var(--dsw-alias-bg-layer-1,#fafafa);",
      "--gti-bd:var(--dsw-alias-border-l3,#e6e8eb);",
      "--gti-bd2:var(--dsw-alias-border-l4,#dcdfe4);",
      "--gti-tx:var(--dsw-alias-label-primary,#1f2328);",
      "--gti-tx2:var(--dsw-alias-label-secondary,#5b6270);",
      "--gti-tx3:var(--dsw-alias-label-tertiary,#8b929e);",
      "--gti-dim:var(--dsw-alias-label-dimmed,#adb3bc);",
      "--gti-br:var(--dsw-alias-brand-primary,#2b6cb0);",
      "--gti-err:var(--dsw-alias-label-error,#a8392c);",
      "--gti-hover:var(--dsw-alias-interactive-bg-hover,#f2f3f5);",
      "--gti-active:var(--dsw-alias-interactive-bg-active,#e9ebee);",
      "--gti-prifill:var(--dsw-alias-button-primary-fill,#2b6cb0);",
      "--gti-prifillh:var(--dsw-alias-button-primary-hover,#245d99);",
      "--gti-prifg:var(--dsw-alias-label-primary-foreground,#fff);",
      "display:block;container-type:inline-size;color:var(--gti-tx);",
      "font-size:14px;line-height:22px;}",
      ".gti-root *{box-sizing:border-box;}",
      ".gti-root button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0;text-align:left;}",
      ".gti-root input,.gti-root textarea{font:inherit;color:inherit;}",

      // 顶部：标题 + 添加按钮（添加按钮在最上面）
      ".gti-hd{padding:2px 0 14px;}",
      ".gti-hd-t{font-size:16px;line-height:24px;font-weight:500;}",
      ".gti-hd-s{font-size:12.5px;line-height:1.6;color:var(--gti-tx3);margin-top:3px;}",
      ".gti-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 0 12px;}",
      ".gti-top .gti-count{margin-left:auto;font-size:12px;color:var(--gti-tx3);white-space:nowrap;}",

      // 顶部四页页签（最上面切页）
      ".gti-pages{display:flex;gap:4px;margin:0 0 14px;padding:4px;border-radius:14px;",
      "background:var(--gti-srf2);border:.5px solid var(--gti-bd);}",
      ".gti-pg{flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;",
      "height:32px;padding:0 10px;border-radius:10px;font-size:13px;line-height:20px;color:var(--gti-tx2);",
      "white-space:nowrap;overflow:hidden;transition:background .12s,color .12s;}",
      ".gti-pg:hover{background:var(--gti-hover);}",
      ".gti-pg.on{background:var(--gti-srf);color:var(--gti-tx);font-weight:600;",
      "box-shadow:0 1px 3px rgba(16,24,40,.10);}",
      ".gti-pg .n{flex:0 0 auto;min-width:16px;height:16px;padding:0 4px;border-radius:8px;font-size:11px;line-height:16px;",
      "text-align:center;font-weight:600;background:var(--gti-bd);color:var(--gti-tx2);}",
      ".gti-pg.on .n{background:var(--gti-br);color:var(--gti-prifg);}",
      ".gti-page{animation:gti-in .16s ease-out;}",
      "@keyframes gti-in{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:none;}}",

      // 官方 Button 胶囊几何
      ".gti-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;",
      "height:36px;padding:0 14px;border-radius:18px;font-size:14px;line-height:22px;",
      "transition:background .12s;white-space:nowrap;}",
      ".gti-btn.sm{height:28px;padding:0 10px;border-radius:14px;font-size:12px;line-height:18px;}",
      ".gti-btn:hover{background:var(--gti-hover);}",
      ".gti-btn:active{background:var(--gti-active);}",
      ".gti-btn:disabled{cursor:not-allowed;opacity:.4;}",
      ".gti-btn.pr{background:var(--gti-prifill);color:var(--gti-prifg);}",
      ".gti-btn.pr:hover:not(:disabled){background:var(--gti-prifillh);}",
      ".gti-btn.ol{border:.5px solid var(--gti-bd);}",
      ".gti-btn.dg{color:var(--gti-err);}",
      ".gti-btn.dg:hover{background:var(--gti-hover);}",

      // 主体：左（列表+内联编辑） | 右（模型视角）
      ".gti-cols{display:flex;gap:16px;align-items:flex-start;}",
      ".gti-main{flex:1 1 auto;min-width:0;}",
      ".gti-side{flex:0 0 190px;min-width:150px;}",
      ".gti-sec-hd{display:flex;align-items:center;gap:8px;margin-bottom:7px;}",
      ".gti-sec-t{font-size:12px;font-weight:600;color:var(--gti-tx2);letter-spacing:.02em;text-transform:uppercase;}",
      ".gti-sec-s{font-size:12px;color:var(--gti-tx3);font-weight:400;text-transform:none;letter-spacing:0;}",

      // 块卡片
      ".gti-list{display:flex;flex-direction:column;gap:6px;}",
      ".gti-row{border:.5px solid var(--gti-bd);border-radius:14px;background:var(--gti-srf);overflow:hidden;transition:border-color .12s;}",
      ".gti-row:hover{border-color:var(--gti-bd2);}",
      ".gti-row.open{border-color:var(--gti-br);}",
      ".gti-row.off{background:var(--gti-srf2);}",
      // 官方 disclosure 行高 24 + 字体 delta
      ".gti-rh{display:flex;align-items:center;gap:9px;padding:11px 12px;cursor:pointer;min-width:0;}",
      ".gti-rh:hover{background:var(--gti-hover);}",
      ".gti-rt{flex:1;min-width:0;}",
      ".gti-rtitle{font-size:14px;line-height:22px;font-weight:500;overflow-wrap:anywhere;}",
      ".gti-row.off .gti-rtitle{color:var(--gti-tx3);}",
      ".gti-rdesc{font-size:12px;line-height:18px;color:var(--gti-tx3);margin-top:1px;overflow-wrap:anywhere;",
      "display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}",
      ".gti-rmeta{display:flex;gap:6px;align-items:center;margin-top:5px;flex-wrap:wrap;}",
      ".gti-rchev{flex:0 0 auto;color:var(--gti-tx3);font-size:15px;line-height:1;transition:transform .15s;transform:rotate(0);}",
      ".gti-rchev.open{transform:rotate(90deg);}",
      ".gti-empty{padding:26px 14px;text-align:center;color:var(--gti-tx3);font-size:13px;line-height:1.7;}",

      // 胶囊（官方 Pill 几何）
      ".gti-pill{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border-radius:12px;",
      "font-size:12px;line-height:18px;color:var(--gti-tx2);background:var(--gti-srf2);white-space:nowrap;border:.5px solid transparent;}",
      ".gti-pill.sys{color:var(--gti-tx2);}",
      ".gti-pill b{font-weight:600;color:var(--gti-tx3);}",
      ".gti-pill.off{color:var(--gti-tx3);}",
      "button.gti-pill{cursor:pointer;border-color:var(--gti-bd);}",
      "button.gti-pill:hover{background:var(--gti-hover);}",
      ".gti-pill .cv{color:var(--gti-tx3);font-size:10px;line-height:1;}",

      // 行内开关（官方 role=switch 几何：36×20 r10，thumb 16，位移 16）
      ".gti-sw{flex:0 0 auto;width:36px;height:20px;padding:2px;border-radius:10px;",
      "background:var(--gti-bd);transition:background .15s;position:relative;}",
      ".gti-sw::after{content:'';display:block;width:16px;height:16px;border-radius:50%;background:var(--gti-prifg);",
      "box-shadow:0 1px 2px rgba(0,0,0,.18);transition:transform .12s;}",
      ".gti-sw.on{background:var(--gti-br);}",
      ".gti-sw.on::after{transform:translateX(16px);}",
      ".gti-sw:focus-visible{outline:2px solid var(--gti-br);outline-offset:2px;}",

      // 内联编辑区
      ".gti-ed{padding:2px 12px 12px;border-top:.5px solid var(--gti-bd);}",
      ".gti-offbar{display:flex;align-items:center;gap:9px;margin:11px 0 0;padding:9px 11px;border-radius:10px;",
      "background:var(--gti-srf2);border:.5px solid var(--gti-bd);font-size:12.5px;color:var(--gti-tx2);}",
      ".gti-fld{margin-top:11px;}",
      ".gti-lb{display:flex;align-items:center;gap:6px;font-size:12px;line-height:18px;font-weight:600;color:var(--gti-tx2);margin-bottom:5px;}",
      ".gti-lb .opt{font-weight:400;color:var(--gti-tx3);font-size:11px;}",
      // 官方 Input 几何：h32 r8，0.5px 边，focus 换品牌色
      ".gti-in{width:100%;height:32px;padding:0 9px;border:.5px solid var(--gti-bd2);border-radius:8px;",
      "background:var(--gti-srf);outline:none;transition:border-color .12s;}",
      ".gti-in:focus{border-color:var(--gti-br);}",
      ".gti-in.bad{border-color:var(--gti-err);}",
      ".gti-in::placeholder,.gti-ta::placeholder{color:var(--gti-dim);}",
      ".gti-ta{width:100%;padding:9px;border:.5px solid var(--gti-bd2);border-radius:8px;background:var(--gti-srf);",
      "outline:none;resize:vertical;min-height:150px;line-height:1.65;transition:border-color .12s;font-family:inherit;}",
      ".gti-ta:focus{border-color:var(--gti-br);}",
      ".gti-edrow{display:flex;align-items:center;gap:8px;margin-top:11px;flex-wrap:wrap;}",
      ".gti-warn{font-size:12px;color:var(--gti-err);margin-top:6px;}",
      ".gti-edfoot{display:flex;align-items:center;gap:8px;margin-top:13px;}",
      ".gti-status{flex:1;font-size:12px;color:var(--gti-tx3);}",
      ".gti-status.hot{color:var(--gti-tx2);}",

      // 位置选择（官方 pill + 弹出列表）
      ".gti-mnwrap{position:relative;display:inline-flex;}",
      ".gti-mn{position:absolute;top:calc(100% + 4px);left:0;z-index:1100;min-width:210px;padding:4px;",
      "display:flex;flex-direction:column;border-radius:20px;background:var(--dsw-specific-menu,var(--gti-srf));",
      "box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(16,24,40,.16));}",
      ".gti-mni{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border-radius:12px;font-size:13px;}",
      ".gti-mni:hover{background:var(--gti-hover);}",
      ".gti-mnl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".gti-mnc{flex:0 0 auto;color:var(--gti-br);font-size:12px;}",

      // 右栏
      ".gti-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--gti-bd);margin-bottom:9px;overflow:hidden;}",
      ".gti-tab{flex:0 1 auto;min-width:0;padding:6px 9px;border-radius:8px 8px 0 0;font-size:12px;line-height:18px;",
      "color:var(--gti-tx3);border:.5px solid transparent;border-bottom:0;margin-bottom:-.5px;",
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".gti-tab:hover{color:var(--gti-tx2);}",
      ".gti-tab.on{background:var(--gti-srf);border-color:var(--gti-bd);color:var(--gti-tx);font-weight:600;}",
      ".gti-rnote{margin-bottom:9px;padding:8px 10px;border:.5px solid var(--gti-bd);border-radius:10px;",
      "background:var(--gti-srf2);font-size:11.5px;line-height:1.6;color:var(--gti-tx3);}",
      ".gti-segs{display:flex;gap:11px;margin-bottom:7px;font-size:11.5px;flex-wrap:wrap;}",
      ".gti-seg{display:flex;align-items:center;gap:5px;color:var(--gti-tx3);white-space:nowrap;}",
      ".gti-dot{width:8px;height:8px;border-radius:2px;flex:0 0 auto;}",
      ".gti-dot.of{background:var(--gti-bd2);}",
      ".gti-dot.mi{background:var(--gti-br);}",
      ".gti-prev{display:flex;flex-direction:column;gap:5px;}",
      ".gti-sec{border:.5px solid var(--gti-bd);border-radius:10px;background:var(--gti-srf);overflow:hidden;}",
      ".gti-sec.mine{border-left:3px solid var(--gti-br);}",
      ".gti-sec-hdr{display:flex;align-items:center;gap:7px;width:100%;padding:7px 9px;min-width:0;}",
      ".gti-sec-hdr:hover{background:var(--gti-hover);}",
      ".gti-sec-nm{font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".gti-sec.mine .gti-sec-nm{color:var(--gti-br);}",
      ".gti-sec-nm .fix{font-weight:400;color:var(--gti-tx3);font-size:11px;}",
      ".gti-sec-n{font-size:11px;color:var(--gti-tx3);flex:0 0 auto;}",
      ".gti-sec-tx{padding:8px 9px 9px;border-top:.5px solid var(--gti-bd);background:var(--gti-srf2);",
      "font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.6;color:var(--gti-tx2);",
      "white-space:pre-wrap;word-break:break-word;max-height:190px;overflow:auto;}",
      ".gti-stats{margin-top:9px;padding:9px 10px;border:.5px solid var(--gti-bd);border-radius:10px;background:var(--gti-srf2);font-size:11.5px;}",
      ".gti-stat{display:flex;justify-content:space-between;gap:8px;padding:2px 0;}",
      ".gti-stat .k{color:var(--gti-tx3);}",
      ".gti-stat .v{font-weight:600;}",
      ".gti-bar{height:5px;border-radius:3px;background:var(--gti-bd);overflow:hidden;margin-top:7px;}",
      ".gti-bar>i{display:block;height:100%;background:var(--gti-br);border-radius:3px;}",
      ".gti-checks{margin-top:8px;padding-top:7px;border-top:.5px solid var(--gti-bd);display:flex;flex-direction:column;gap:3px;}",
      ".gti-chk{font-size:11.5px;color:var(--gti-tx2);}",
      ".gti-chk.bad{color:var(--gti-err);}",
      ".gti-hinti{padding:14px;text-align:center;font-size:11.5px;color:var(--gti-tx3);}",

      // 历史（在最下面，展开时往下推，不遮任何东西）
      ".gti-hist{margin-top:18px;border-top:.5px solid var(--gti-bd);padding-top:9px;}",
      ".gti-hh{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border-radius:10px;}",
      ".gti-hh:hover{background:var(--gti-hover);}",
      ".gti-hh-t{font-size:12px;font-weight:600;color:var(--gti-tx2);letter-spacing:.02em;text-transform:uppercase;}",
      ".gti-hh-s{font-size:12px;color:var(--gti-tx3);}",
      ".gti-hl{display:flex;flex-direction:column;gap:2px;margin-top:5px;padding-left:8px;}",
      ".gti-hi{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:10px;}",
      ".gti-hi:hover{background:var(--gti-srf2);}",
      ".gti-hi-r1{display:flex;align-items:center;gap:6px;}",
      ".gti-hi-n{flex:1;min-width:0;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;",
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".gti-hi-d{font-size:11px;color:var(--gti-tx3);display:flex;gap:8px;}",
      ".gti-d-add{color:#1a8a72;}",
      ".gti-d-del{color:var(--gti-err);}",
      ".gti-pin{font-size:11px;padding:1px 5px;border-radius:4px;background:var(--gti-srf2);color:var(--gti-tx2);font-weight:600;}",
      ".gti-hi-act{display:flex;gap:4px;margin-left:auto;opacity:0;transition:opacity .12s;}",
      ".gti-hi:hover .gti-hi-act,.gti-hi.fix .gti-hi-act{opacity:1;}",

      // 弹层（查看/对比历史）
      ".gti-ov{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:28px;",
      "background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24));}",
      ".gti-dlg{display:flex;flex-direction:column;width:min(660px,100%);max-height:100%;overflow:hidden;",
      "border-radius:24px;background:var(--gti-srf);box-shadow:var(--dsw-elevation-prominent,0 16px 44px rgba(16,24,40,.19));}",
      ".gti-dlg-hd{padding:16px 18px 10px;font-size:16px;line-height:24px;font-weight:500;}",
      ".gti-dlg-bd{padding:0 18px 8px;overflow:auto;min-height:0;}",
      ".gti-dlg-ft{display:flex;justify-content:flex-end;gap:8px;padding:8px 18px 18px;}",
      ".gti-df{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;}",
      ".gti-df .a{background:#eefaf3;color:#146b52;}",
      ".gti-df .d{background:#fdf2f0;color:var(--gti-err);}",
      ".gti-df .c{color:var(--gti-tx3);}",

      // 面板真实可用宽 = 800 - 188(nav) - 48(padding) = 564px：窄了就把右栏挪下去
      "@container (max-width:470px){",
      ".gti-cols{flex-direction:column;gap:14px;}",
      ".gti-side{flex:1 1 auto;width:100%;min-width:0;}",
      ".gti-sec-tx{max-height:150px;}",
      "}",
      "@container (max-width:330px){",
      ".gti-top .gti-count{display:none;}",
      ".gti-rmeta{display:none;}",
      "}",
    ].join("");

    function ensureCss() {
      try {
        if (typeof document === "undefined") return;
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
        o: b.order === undefined ? null : b.order, e: b.enabled !== false, y: String(b.body || ""),
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

    /** 我的段在预览里叫 gw-text-inject:标题，前缀是给框架去重的，界面上没必要露。 */
    function shortName(n) {
      return String(n || "").replace(/^gw-text-inject:/, "");
    }

    // ───────────────────────── 组件 ─────────────────────────

    /** 开关：官方惯用写法 button[role=switch][aria-checked]。 */
    function Switch(props) {
      var on = props.on !== false;
      return h("button", {
        type: "button",
        role: "switch",
        "aria-checked": on,
        "aria-label": on ? t("enabled") : t("disabledBadge"),
        className: "gti-sw" + (on ? " on" : ""),
        onClick: function (e) {
          e.stopPropagation();
          if (props.onChange) props.onChange(!on);
        },
      });
    }

    /** 官方风格的胶囊按钮。 */
    function Btn(props) {
      var cls = "gti-btn" + (props.size === "sm" ? " sm" : "") + (props.variant ? " " + props.variant : "");
      return h("button", {
        type: "button", className: cls, disabled: props.disabled,
        onClick: props.onClick, title: props.title,
      }, props.children);
    }

    /** 位置胶囊 + 弹出列表（官方 pill + menu 的形态）。 */
    function PosPicker(props) {
      var open = props.open;
      return h("div", { className: "gti-mnwrap", onClick: function (e) { e.stopPropagation(); } },
        h("button", {
          type: "button", className: "gti-pill", "aria-haspopup": "menu", "aria-expanded": open,
          onClick: function (e) { e.stopPropagation(); props.onToggle(); },
        }, props.label, h("span", { className: "cv" }, "\u25BE")),
        open
          ? h("div", { className: "gti-mn", role: "menu" },
              props.options.map(function (o) {
                return h("button", {
                  key: "o" + o.value, type: "button", role: "menuitem",
                  className: "gti-mni",
                  onClick: function (e) { e.stopPropagation(); props.onSelect(o.value); },
                },
                  h("span", { className: "gti-mnl" }, o.label),
                  o.value === props.value ? h("span", { className: "gti-mnc" }, "\u2713") : null
                );
              })
            )
          : null
      );
    }

    /** 折叠的一段预览（官方 DisclosureRow 的形态）。 */
    function PreviewSection(props) {
      var s = props.section;
      var open = props.open;
      return h("div", { className: "gti-sec" + (s.mine ? " mine" : "") },
        h("button", {
          type: "button", className: "gti-sec-hdr", "aria-expanded": open,
          onClick: function () { props.onToggle(s.name); },
        },
          h("span", { className: "gti-sec-nm", title: shortName(s.name) },
            shortName(s.name),
            s.order !== null && s.order !== undefined ? h("span", { className: "fix" }, "  @" + s.order) : null
          ),
          h("span", { className: "gti-sec-n" }, s.chars + " " + t("chars"))
        ),
        open ? h("div", { className: "gti-sec-tx" }, s.text || t("previewEmpty")) : null
      );
    }

    // ───────────────────────── 主界面 ─────────────────────────
    function View() {
      ensureCss();

      var S = React.useState({
        ready: false, error: "", file: "", blocks: [], history: [], errors: [],
        anchors: null, defaults: { system: 40, context: 125 }, minOrder: 0,
      });
      var st = S[0], setSt = S[1];
      // st 的镜像 ref：保存回调用 setTimeout 触发，闭包里的 st 可能是旧的（比如刚新建完
      // 就切开关，旧闭包还拿着新建前的块数组，保存回去会把新块抹掉）。读一律走 ref。
      var stRef = React.useRef(st);
      stRef.current = st;

      var O = React.useState(-1);                 // 展开着编辑器的块索引，-1 = 全收起
      var openIdx = O[0], setOpenIdx = O[1];

      var D = React.useState({});                  // 未保存的改动：{ [索引]: {字段} }
      var drafts = D[0], setDrafts = D[1];
      // drafts 的镜像 ref：开关/输入触发的保存走 setTimeout，那时闭包里捕获的是**旧**的
      // drafts，直接读会把老值写回服务器 —— 「点开关没反应」就是这么来的。读一律走 ref
      // （同步就是最新），state 只负责触发重渲染。
      var draftsRef = React.useRef({});
      function putDrafts(next) { draftsRef.current = next; setDrafts(next); }
      function clearDrafts() { putDrafts({}); }

      var Busy = React.useState(false);
      var busy = Busy[0], setBusy = Busy[1];

      var Saved = React.useState("");              // "" | "saving" | "saved"
      var saveState = Saved[0], setSaveState = Saved[1];

      var V = React.useState({ loading: false, data: null, err: "", open: {} });
      var pv = V[0], setPv = V[1];

      var T = React.useState("sys");                 // 顶部四页：sys / ctx / vsys / vctx
      var page = T[0], setPage = T[1];

      var Hh = React.useState(false);
      var histOpen = Hh[0], setHistOpen = Hh[1];

      var Mod = React.useState(null);
      var modal = Mod[0], setModal = Mod[1];

      var Mn = React.useState(false);              // 位置菜单
      var menuOpen = Mn[0], setMenuOpen = Mn[1];

      var pvTimer = React.useRef(null);
      var saveTimer = React.useRef(null);

      /** 服务器上的块 + 本地草稿 = 当前真实内容。 */
      function merged(i) {
        var b = stRef.current.blocks[i];
        if (!b) return null;
        var d = draftsRef.current[i];
        if (!d) return b;
        return Object.assign({}, b, d);
      }
      function mergedAll() {
        var out = [];
        var arr = stRef.current.blocks;
        for (var i = 0; i < arr.length; i++) out.push(merged(i));
        return out;
      }
      function dirtyAt(i) {
        return !!(draftsRef.current[i] && stRef.current.blocks[i] && norm(stRef.current.blocks[i]) !== norm(merged(i)));
      }
      function countType(type) {
        var n = 0;
        var arr = stRef.current.blocks;
        for (var i = 0; i < arr.length; i++) if (arr[i].type === type) n++;
        return n;
      }
      var dirtyCount = 0;
      for (var di = 0; di < st.blocks.length; di++) if (dirtyAt(di)) dirtyCount++;

      // ── 读状态 ────────────────────────────────────────────
      function load() {
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
          clearDrafts();
        }).catch(function () {
          setSt(function (p) { return Object.assign({}, p, { ready: true, error: t("loadFailed") }); });
        });
      }

      // ── 装配预览（去抖）────────────────────────────────────
      function refreshPreview() {
        setPv(function (p) { return Object.assign({}, p, { loading: true, err: "" }); });
        if (pvTimer.current) clearTimeout(pvTimer.current);
        pvTimer.current = setTimeout(function () {
          post(API + "/preview", {}).then(function (d) {
            if (!d || d.ok === false) {
              setPv(function (p) {
                return Object.assign({}, p, {
                  loading: false, data: d || null,
                  err: (d && (d.errors || [])[0]) || t("previewError"),
                });
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
        return function () {
          if (pvTimer.current) clearTimeout(pvTimer.current);
          if (saveTimer.current) clearTimeout(saveTimer.current);
        };
      }, []);

      React.useEffect(function () {
        if (!menuOpen) return undefined;
        function close() { setMenuOpen(false); }
        document.addEventListener("mousedown", close);
        return function () { document.removeEventListener("mousedown", close); };
      }, [menuOpen]);

      // ── 保存：草稿合并后整份提交，官方接口会校验并热加载 ────
      function saveAll(silent) {
        var st = stRef.current;
        var blocks = mergedAll();
        if (!blocks.length && !st.blocks.length) return Promise.resolve(null);
        // 标题是段名的来源，空的会让 host 拒收整份；本地先拦，别白跑一趟
        for (var v = 0; v < blocks.length; v++) {
          if (!String(blocks[v].title || "").trim()) {
            setSaveState("");
            setSt(function (p) { return Object.assign({}, p, { error: t("titleEmptyBlock") }); });
            return Promise.resolve(null);
          }
        }
        setBusy(true);
        setSaveState("saving");
        for (var i = 0; i < blocks.length; i++) {
          var n = Number(blocks[i].order);
          blocks[i] = Object.assign({}, blocks[i], {
            order: blocks[i].order === null || blocks[i].order === undefined || blocks[i].order === "" || !Number.isFinite(n) ? null : n,
          });
        }
        return post(API + "/save", { blocks: blocks }).then(function (d) {
          setBusy(false);
          if (!d || d.error) {
            setSaveState("");
            setSt(function (p) {
              return Object.assign({}, p, { error: (d && d.error) || "save failed", errors: (d && d.errors) || [] });
            });
            return d;
          }
          clearDrafts();
          setSt(function (p) {
            return Object.assign({}, p, {
              error: "", errors: d.errors || [], blocks: d.blocks || p.blocks,
              history: d.history || p.history, file: d.file || p.file,
            });
          });
          if (silent !== true) setSaveState("saved");
          setTimeout(function () { setSaveState(""); }, 1800);
          refreshPreview();
          return d;
        }).catch(function () {
          setBusy(false);
          setSaveState("");
          setSt(function (p) { return Object.assign({}, p, { error: "save failed" }); });
        });
      }

      /** 输入框失焦后自动保存（合并去抖，避免每敲一个字符都写盘）。 */
      function autoSave() {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(function () { saveAll(true); }, 350);
      }

      function patch(i, k, v) {
        var n = Object.assign({}, draftsRef.current);
        n[i] = Object.assign({}, n[i]);
        n[i][k] = v;
        putDrafts(n);
      }

      // ── 操作 ─────────────────────────────────────────────
      function toggleOpen(i) {
        setMenuOpen(false);
        if (openIdx === i) {
          setOpenIdx(-1);
          if (dirtyCount) saveAll(true);       // 收起时落盘
          return;
        }
        if (openIdx >= 0 && dirtyCount) saveAll(true);   // 换块前先把上一个落盘
        setOpenIdx(i);
      }

      /** 新建：默认「不启用」，并立刻落盘，免得刚建完就被丢掉。 */
      function addBlock(type) {
        var base = type === "system" ? t("typeSystem") : t("typeContext");
        var n = 1, used = {};
        for (var i = 0; i < st.blocks.length; i++) used[st.blocks[i].title] = 1;
        var title = base;
        while (used[title]) { n++; title = base + " " + n; }
        var nb = { type: type, title: title, desc: "", order: null, enabled: false, body: "" };
        var bl = mergedAll();
        bl.push(nb);
        setBusy(true);
        setMenuOpen(false);
        post(API + "/save", { blocks: bl }).then(function (d) {
          setBusy(false);
          if (!d || d.error) {
            setSt(function (p) { return Object.assign({}, p, { error: (d && d.error) || "save failed" }); });
            return;
          }
          var arr = d.blocks || bl;
          clearDrafts();
          setSt(function (p) {
            return Object.assign({}, p, {
              error: "", errors: d.errors || [], blocks: arr,
              history: d.history || p.history, file: d.file || p.file,
            });
          });
          setOpenIdx(arr.length - 1);
          refreshPreview();
        });
      }

      function delBlock(i) {
        if (!window.confirm(t("confirmDelete"))) return;
        var bl = mergedAll();
        bl.splice(i, 1);
        setBusy(true);
        post(API + "/save", { blocks: bl }).then(function (d) {
          setBusy(false);
          if (!d || d.error) {
            setSt(function (p) { return Object.assign({}, p, { error: (d && d.error) || "save failed" }); });
            return;
          }
          setOpenIdx(-1);
          clearDrafts();
          setSt(function (p) {
            return Object.assign({}, p, {
              error: "", errors: d.errors || [], blocks: d.blocks || [],
              history: d.history || p.history, file: d.file || p.file,
            });
          });
          refreshPreview();
        });
      }

      // 开关切换：先写 ref（同步最新），再触发保存。两条路径分开，别靠 state 回流。
      function toggleAt(i) {
        var base = merged(i) || {};
        var d = Object.assign({}, draftsRef.current[i] || {});
        d.enabled = base.enabled === false;
        var n = Object.assign({}, draftsRef.current);
        n[i] = d;
        putDrafts(n);
        // 开关要立刻生效：直接提交（走 ref，读到的就是刚写的值）
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(function () { saveAll(true); }, 60);
      }

      // ── 历史 ─────────────────────────────────────────────
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
          load().then(function () { refreshPreview(); });
        });
      }

      // ── 位置选项：参照物取自 host 读到的官方段序常量 ──────
      function posOptions(type) {
        var st = stRef.current;
        var a = st.anchors || {};
        var out = [];
        var min = typeof st.minOrder === "number" ? st.minOrder : 0;
        if (type === "context") {
          var c = a.context || {};
          var cs = [
            ["SANDBOX_POLICY", t("posAfterSandbox")],
            ["APPROVAL_POLICY", t("posAfterApproval")],
            ["SUBAGENT_DELEGATION", t("posAfterSubagent")],
          ];
          out.push({ label: t("posFirst"), value: 0 });
          for (var i = 0; i < cs.length; i++) {
            var ord = c[cs[i][0]];
            if (typeof ord === "number") out.push({ label: cs[i][1] + "  @" + (ord + 5), value: ord + 5 });
          }
          out.push({ label: t("posLast"), value: 9999 });
        } else {
          var s = a.system || {};
          var ss = [
            ["DEPLOYMENT_PERSONA", t("posAfterPersona"), 50],
            ["PLAN_POLICY", t("posAfterPlan"), 550],
            ["FILE_REFERENCE", t("posAfterFileRef"), 950],
            ["TOOL_BASH", t("posAfterTools"), 4000],
            ["DELIVERABLE_FILE_REFERENCES", t("posLast"), 9500],
          ];
          for (var j = 0; j < ss.length; j++) {
            var anchor = s[ss[j][0]];
            var val = ss[j][2];
            if (typeof anchor === "number") val = anchor + 50;
            if (val < min) continue;
            out.push({ label: ss[j][1] + "  @" + val, value: val });
          }
          out.sort(function (x, y) { return x.value - y.value; });
        }
        var dflt = type === "system" ? (st.defaults.system || 40) : (st.defaults.context || 125);
        if (!out.some(function (o) { return o.value === dflt; })) {
          out.push({ label: t("posDefault") + "  @" + dflt, value: dflt });
        }
        out.sort(function (x, y) { return x.value - y.value; });
        return out;
      }

      /** 当前值对应的中文说明；没有对上的就是自定义。 */
      function posLabel(type, order) {
        var st = stRef.current;
        var eff = order;
        if (eff === null || eff === undefined || eff === "") {
          eff = type === "system" ? (st.defaults.system || 40) : (st.defaults.context || 125);
        }
        var opts = posOptions(type);
        for (var i = 0; i < opts.length; i++) if (opts[i].value === eff) return opts[i].label;
        return t("posCustom") + "  @" + eff;
      }

      // ── 预览数据 ─────────────────────────────────────────
      function pvData(mode) {
        if (!pv.data) return null;
        var g = pv.data.global;
        if (!g) return null;
        return mode === "system" ? g.system : g.context;
      }

      function renderStats(mode) {
        var st = stRef.current;
        var d = pvData(mode);
        if (!d) return null;
        var mine = 0;
        for (var i = 0; i < d.sections.length; i++) if (d.sections[i].mine) mine += d.sections[i].chars;
        var pct = d.totalChars ? Math.round((mine / d.totalChars) * 1000) / 10 : 0;
        var onCount = 0, offCount = 0, emptyCount = 0;
        for (var b = 0; b < st.blocks.length; b++) {
          var bl = merged(b);
          if (!bl || bl.type !== (mode === "system" ? "system" : "context")) continue;
          if (bl.enabled === false) offCount++;
          else if (!String(bl.body || "").trim()) emptyCount++;
          else onCount++;
        }
        var checks = [];
        for (var e = 0; e < st.errors.length; e++) {
          checks.push(h("div", { className: "gti-chk bad", key: "e" + e }, "\u00d7 " + st.errors[e]));
        }
        checks.push(h("div", { className: "gti-chk", key: "on" }, "\u2713 " + onCount + " " + t("onCount")));
        if (offCount) checks.push(h("div", { className: "gti-chk", key: "off" }, "\u00b7 " + offCount + " " + t("disabledBadge")));
        if (emptyCount) checks.push(h("div", { className: "gti-chk", key: "em" }, "\u00b7 " + emptyCount + " " + t("emptyBodyMark")));
        return h("div", { className: "gti-stats" },
          h("div", { className: "gti-stat", key: "t" },
            h("span", { className: "k" }, t("totalLabel")),
            h("span", { className: "v" }, d.totalChars + " " + t("chars"))),
          h("div", { className: "gti-stat", key: "m" },
            h("span", { className: "k" }, t("myShare")),
            h("span", { className: "v" }, mine + " \u00b7 " + pct + "%")),
          h("div", { className: "gti-bar", key: "b" }, h("i", { style: { width: Math.min(pct, 100) + "%" } })),
          h("div", { className: "gti-checks" }, checks)
        );
      }

      // ── 渲染：顶部（添加按钮在最上面）──────────────────────
      function renderTop() {
        var pages = [
          ["sys", t("pageSys"), "system"],
          ["ctx", t("pageCtx"), "context"],
          ["vsys", t("pageViewSys"), ""],
          ["vctx", t("pageViewCtx"), ""],
        ];
        var tabs = [];
        for (var i = 0; i < pages.length; i++) {
          (function (p) {
            var n = p[2] ? countType(p[2]) : 0;
            tabs.push(h("button", {
              key: p[0], type: "button", role: "tab", "aria-selected": page === p[0],
              className: "gti-pg" + (page === p[0] ? " on" : ""),
              onClick: function () { setMenuOpen(false); setOpenIdx(-1); setPage(p[0]); },
            }, h("span", null, p[1]), p[2] ? h("span", { className: "n" }, n) : null));
          })(pages[i]);
        }
        return h("div", { className: "gti-pages", role: "tablist" }, tabs);
      }

      // ── 渲染：某一页的添加按钮条（只在编辑页出现）──────────
      function renderAdd(type) {
        return h("div", { className: "gti-top" },
          h(Btn, { variant: "ol", onClick: function () { addBlock(type); } },
            type === "system" ? t("newSystem") : t("newContext")),
          h("span", { className: "gti-count" }, t("blocks") + " " + countType(type))
        );
      }

      // ── 渲染：一个块的编辑器（点开就地在下面展开）──────────
      function renderEditor(i) {
        var b = merged(i) || {};
        var isSys = b.type === "system";
        var titleBad = !String(b.title || "").trim();
        var effOrder = b.order;
        if (effOrder === null || effOrder === undefined || effOrder === "") {
          effOrder = isSys ? (stRef.current.defaults.system || 40) : (stRef.current.defaults.context || 125);
        }
        var min = typeof stRef.current.minOrder === "number" ? stRef.current.minOrder : 0;

        return h("div", { className: "gti-ed", onClick: function (e) { e.stopPropagation(); } },
          b.enabled === false
            ? h("div", { className: "gti-offbar" },
                h(Switch, { on: false, onChange: function () { toggleAt(i); } }),
                h("span", null, t("offBar"))
              )
            : null,

          h("div", { className: "gti-fld" },
            h("div", { className: "gti-lb" }, h("span", null, t("titleLabel")), h("span", { className: "opt" }, t("titleRequired"))),
            h("input", {
              className: "gti-in" + (titleBad ? " bad" : ""),
              value: b.title || "",
              placeholder: t("titlePlaceholder"),
              onChange: function (e) { patch(i, "title", e.target.value); },
              onBlur: autoSave,
            })
          ),

          h("div", { className: "gti-fld" },
            h("div", { className: "gti-lb" }, h("span", null, t("descLabel")), h("span", { className: "opt" }, t("descOptional"))),
            h("input", {
              className: "gti-in",
              value: b.desc || "",
              placeholder: t("descPlaceholder"),
              onChange: function (e) { patch(i, "desc", e.target.value); },
              onBlur: autoSave,
            })
          ),

          h("div", { className: "gti-edrow" },
            h("span", { className: "gti-lb", style: { marginBottom: 0 } }, t("positionLabel")),
            h(PosPicker, {
              open: menuOpen,
              value: effOrder,
              label: posLabel(b.type, b.order),
              options: posOptions(b.type),
              onToggle: function () { setMenuOpen(!menuOpen); },
              onSelect: function (v) {
                setMenuOpen(false);
                patch(i, "order", v);
                autoSave();
              },
            }),
            h("span", { style: { fontSize: 11.5, color: "var(--gti-tx3)" } }, t("positionHint"))
          ),
          effOrder < min
            ? h("div", { className: "gti-warn" }, t("posMinHint") + " " + min + " \u2014 \u5c0f\u4e8e\u5b83\u4f1a\u6309 " + min + " \u751f\u6548")
            : null,

          h("div", { className: "gti-fld" },
            h("div", { className: "gti-lb" },
              h("span", null, t("bodyLabel")),
              h("span", { className: "opt" }, String(b.body || "").length + " " + t("chars"))
            ),
            h("textarea", {
              className: "gti-ta",
              value: b.body || "",
              placeholder: t("bodyPlaceholder"),
              onChange: function (e) { patch(i, "body", e.target.value); },
              onBlur: autoSave,
            })
          ),

          h("div", { className: "gti-edfoot" },
            h("span", { className: "gti-status" + (dirtyCount ? " hot" : "") },
              stRef.current.error ? t("errorPrefix") + stRef.current.error
                : saveState === "saving" ? t("saving")
                : saveState === "saved" ? t("saved")
                : dirtyCount ? t("unsaved") : ""),
            h(Btn, { size: "sm", variant: "dg", onClick: function () { delBlock(i); } }, t("delete")),
            h(Btn, { size: "sm", onClick: function () { toggleOpen(i); } }, t("done"))
          )
        );
      }

      // ── 渲染：块列表 ──────────────────────────────────────
      function renderList(type) {
        var all = stRef.current.blocks;
        var items = [];
        for (var i = 0; i < all.length; i++) {
          if (type && all[i].type !== type) continue;
          (function (i) {
            var b = merged(i) || {};
            var on = b.enabled !== false;
            var open = openIdx === i;
            var effOrder = b.order;
            if (effOrder === null || effOrder === undefined || effOrder === "") {
              effOrder = b.type === "system" ? (stRef.current.defaults.system || 40) : (stRef.current.defaults.context || 125);
            }
            items.push(h("div", {
              key: "b" + i,
              className: "gti-row" + (open ? " open" : "") + (on ? "" : " off"),
            },
              h("div", { className: "gti-rh", onClick: function () { toggleOpen(i); } },
                h(Switch, { on: on, onChange: function () { toggleAt(i); } }),
                h("div", { className: "gti-rt" },
                  h("div", { className: "gti-rtitle" }, b.title || "\uff08\u65e0\u6807\u9898\uff09"),
                  b.desc ? h("div", { className: "gti-rdesc" }, b.desc) : null,
                  h("div", { className: "gti-rmeta" },
                    h("span", { className: "gti-pill" }, b.type === "system" ? t("typeSystemShort") : t("typeContextShort")),
                    h("span", { className: "gti-pill" }, h("b", null, "@" + effOrder)),
                    !on ? h("span", { className: "gti-pill off" }, t("disabledBadge")) : null
                  )
                ),
                h("span", { className: "gti-rchev" + (open ? " open" : "") }, "\u203a")
              ),
              open ? renderEditor(i) : null
            ));
          })(i);
        }
        if (!items.length) return h("div", { className: "gti-empty" }, t("empty"));
        return h("div", { className: "gti-list" }, items);
      }

      // ── 渲染：右栏（模型视角）──────────────────────────────
      function renderSide(mode) {
        var st = stRef.current;
        var d = pvData(mode);
        var list;
        if (pv.loading) list = h("div", { className: "gti-hinti" }, t("previewLoading"));
        else if (pv.err) list = h("div", { className: "gti-hinti" }, t("previewError") + "：" + pv.err);
        else if (!d || !d.sections.length) list = h("div", { className: "gti-hinti" }, t("noSeg"));
        else {
          var arr = [];
          for (var i = 0; i < d.sections.length; i++) {
            var s = d.sections[i];
            arr.push(h(PreviewSection, {
              key: shortName(s.name) + ":" + i, section: s, open: !!pv.open[s.name],
              onToggle: function (nm) {
                setPv(function (p) {
                  var o = Object.assign({}, p.open);
                  o[nm] = !o[nm];
                  return Object.assign({}, p, { open: o });
                });
              },
            }));
          }
          list = h("div", { className: "gti-prev" }, arr);
        }

        return h("div", { className: "gti-side" },
          h("div", { className: "gti-sec-hd" },
            h("span", { className: "gti-sec-t" }, t("preview")),
            h(Btn, { size: "sm", onClick: refreshPreview }, t("refresh"))
          ),
          h("div", { className: "gti-rnote" }, t("previewHint")),
          h("div", { className: "gti-segs" },
            h("div", { className: "gti-seg" }, h("span", { className: "gti-dot of" }), t("segOfficial")),
            h("div", { className: "gti-seg" }, h("span", { className: "gti-dot mi" }), t("segMine"))
          ),
          list,
          renderStats(mode),
          h("div", { className: "gti-rnote", style: { marginTop: 9, marginBottom: 0 } }, t("previewCaveat"))
        );
      }

      // ── 渲染：历史（最下面就成，展开往下推）────────────────
      function renderHistory() {
        var st = stRef.current;
        var rows = [];
        for (var i = 0; i < st.history.length; i++) {
          (function (it) {
            rows.push(h("div", { key: it.name, className: "gti-hi" + (it.pinned ? " fix" : "") },
              h("div", { className: "gti-hi-r1" },
                h("span", { className: "gti-hi-n", title: it.name }, prettyTime(it.name)),
                it.pinned ? h("span", { className: "gti-pin" }, t("pinned")) : null,
                h("div", { className: "gti-hi-act" },
                  h(Btn, {
                    size: "sm", title: it.pinned ? t("unpin") : t("pin"),
                    onClick: function () { pinHist(it.name, !it.pinned); },
                  }, it.pinned ? "\u2605" : "\u2606"),
                  h(Btn, { size: "sm", onClick: function () { diffHist(it.name); } }, t("diff")),
                  h(Btn, { size: "sm", onClick: function () { viewHist(it.name); } }, t("view")),
                  h(Btn, { size: "sm", onClick: function () { restoreHist(it.name); } }, t("restore"))
                )
              ),
              h("div", { className: "gti-hi-d" },
                h("span", null, fmtSize(it.size)),
                it.added || it.removed
                  ? h("span", null,
                      h("span", { className: "gti-d-add" }, "+" + it.added), " ",
                      h("span", { className: "gti-d-del" }, "-" + it.removed))
                  : h("span", null, t("noChange"))
              )
            ));
          })(st.history[i]);
        }

        return h("div", { className: "gti-hist" },
          h("button", { type: "button", className: "gti-hh", onClick: function () { setHistOpen(!histOpen); } },
            h("span", { className: "gti-rchev" + (histOpen ? " open" : "") }, "\u203a"),
            h("span", { className: "gti-hh-t" }, t("history")),
            h("span", { className: "gti-hh-s", style: { marginLeft: "auto" } }, t("histCount", { n: st.history.length })),
            h("span", { className: "gti-hh-s" }, t("pinnedHint"))
          ),
          histOpen
            ? (st.history.length ? h("div", { className: "gti-hl" }, rows) : h("div", { className: "gti-hinti" }, t("emptyHistory")))
            : null
        );
      }

      // ── 渲染：弹层 ────────────────────────────────────────
      function renderModal() {
        if (!modal) return null;
        var body = null;
        if (modal.kind === "raw") {
          body = h("div", { className: "gti-df" }, modal.text || "");
        } else {
          var ls = [];
          for (var i = 0; i < modal.lines.length; i++) {
            var l = modal.lines[i];
            ls.push(h("div", { className: l.k === "c" ? "c" : l.k === "a" ? "a" : "d", key: i },
              (l.k === "a" ? "+ " : l.k === "d" ? "- " : "  ") + l.t));
          }
          body = h("div", null,
            h("div", { style: { fontSize: 12, color: "var(--gti-tx3)", marginBottom: 8 } },
              "\u5bf9\u6bd4\u57fa\u51c6\uff1a" + modal.base + "  ",
              h("span", { className: "gti-d-add" }, "+" + modal.added), " ",
              h("span", { className: "gti-d-del" }, "-" + modal.removed)),
            h("div", { className: "gti-df" }, ls)
          );
        }
        return h("div", {
          className: "gti-ov",
          onClick: function (e) { if (e.target === e.currentTarget) setModal(null); },
        },
          h("div", { className: "gti-dlg" },
            h("div", { className: "gti-dlg-hd" },
              modal.kind === "diff" ? t("diff") + "  " + prettyTime(modal.title) : prettyTime(modal.title)),
            h("div", { className: "gti-dlg-bd" }, body),
            h("div", { className: "gti-dlg-ft" },
              h(Btn, { onClick: function () { setModal(null); } }, t("close")),
              modal.kind === "diff"
                ? h(Btn, { variant: "ol", onClick: function () { restoreHist(modal.title); } }, t("restore"))
                : null
            )
          )
        );
      }

      // ── 整体 ──────────────────────────────────────────────
      var body = null;
      if (page === "sys" || page === "ctx") {
        var ty = page === "sys" ? "system" : "context";
        body = h("div", { key: "p-" + page, className: "gti-page" },
          renderAdd(ty),
          renderList(ty)
        );
      } else {
        body = h("div", { key: "p-" + page, className: "gti-page" },
          renderSide(page === "vsys" ? "system" : "context")
        );
      }

      return h("div", { className: "gti-root" },
        h("div", { className: "gti-hd" },
          h("div", { className: "gti-hd-t" }, t("title")),
          h("div", { className: "gti-hd-s" }, t("blurb"))
        ),
        renderTop(),
        body,
        renderHistory(),
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
      try { console.log("[gw-text-inject] v3 已加载"); } catch (e) {}

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
          }, function () { return React.createElement(View, null); });
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

/* global ChromeUtils, Services */

"use strict";

let ExtensionCommon;
try {
  ({ ExtensionCommon } = ChromeUtils.importESModule(
    "resource://gre/modules/ExtensionCommon.sys.mjs"
  ));
} catch (e) {
  ExtensionCommon = globalThis.ExtensionCommon;
  if (!ExtensionCommon) {
    throw e;
  }
}
const { ThreadPaneColumns } = ChromeUtils.importESModule(
  "chrome://messenger/content/ThreadPaneColumns.mjs"
);

let MailServices;
function getMailServices() {
  if (!MailServices) {
    ({ MailServices } = ChromeUtils.importESModule(
      "resource:///modules/MailServices.sys.mjs"
    ));
  }
  return MailServices;
}

const COLUMN_ID = "irDateCol";

let gOptions = {
  monthStyle: "2-digit",
  weekDayStyle: "hidden",
  numbersStyle: "arabext",
};

let gColumnRegistered = false;

/** @type {{ observe: (subject: any, topic: string) => void } | null} */
let gDomWindowOpenedObserver = null;

/** Bumped on uninstall so late retry timeouts do nothing. */
let gPatchGeneration = 0;

/**
 * The mail UI lives in tabmail inner browsers, not the top-level messenger window.
 *
 * @param {Window} outerWin - Top-level messenger window (windowtype mail:3pane)
 * @param {(inner: Window) => void} callback
 */
function forEachAbout3PaneInnerWindow(outerWin, callback) {
  try {
    const tabmail = outerWin.document?.getElementById("tabmail");
    if (!tabmail?.tabInfo) {
      return;
    }
    for (const tab of tabmail.tabInfo) {
      const inner = tab.chromeBrowser?.contentWindow;
      if (!inner?.document) {
        continue;
      }
      // Prefer stable UI markers over tab mode names (they differ by locale/version).
      if (
        tab?.mode?.name === "mail3PaneTab" ||
        inner.document.getElementById("threadTree")
      ) {
        callback(inner);
      }
    }
  } catch (e) {
    console.error("IranianDateColumn forEachAbout3PaneInnerWindow", e);
  }
}

/** @type {{ cw: Window; listener: object }[]} */
const gMessageListenerHooks = [];

/**
 * Resolve nsIMsgDBHdr for a thread row index (table column).
 *
 * @param {Window} paneWin - about3Pane inner window
 * @param {number} rowIndex
 * @returns {nsIMsgDBHdr|null}
 */
function getMsgHdrForRow(paneWin, rowIndex) {
  if (rowIndex == null || rowIndex < 0) {
    return null;
  }
  let dbView = paneWin.gViewWrapper?.dbView || paneWin.gDBView;
  if (!dbView && paneWin.threadTree?.view) {
    const twv = paneWin.threadTree.view;
    if (twv?.dbView) {
      dbView = twv.dbView;
    } else if (typeof twv.getMsgHdrAt === "function") {
      dbView = twv;
    }
  }
  if (!dbView) {
    return null;
  }
  try {
    const h = dbView.getMsgHdrAt(rowIndex);
    if (h) {
      return h;
    }
  } catch (e) {
    /* fall through */
  }
  try {
    if (typeof dbView.getURIForViewIndex == "function") {
      const uri = dbView.getURIForViewIndex(rowIndex);
      if (uri) {
        return getMailServices().messageServiceFromURI(uri).messageURIToMsgHdr(uri);
      }
    }
  } catch (e2) {
    console.error("IranianDateColumn getMsgHdrForRow", e2);
  }
  return null;
}

function removeJalaliMessageDateRow(doc) {
  doc?.getElementById("iranianJalaliMessageDateRow")?.remove();
}

/**
 * Show Jalali line under the main header date (about:message / msgHdrView).
 *
 * @param {Window} msgCw - messageBrowser.contentWindow
 */
function updateMessagePaneJalaliLine(msgCw) {
  if (!msgCw?.document) {
    return;
  }
  const hdr = msgCw.gMessage;
  const doc = msgCw.document;
  if (!hdr) {
    removeJalaliMessageDateRow(doc);
    return;
  }
  let text;
  try {
    text = formatCellForMsgHdr(hdr);
  } catch (e) {
    console.error("IranianDateColumn message header format", e);
    return;
  }
  const anchor =
    doc.getElementById("expandedtoRow") ||
    doc.getElementById("dateLabel")?.parentElement;
  if (!anchor) {
    return;
  }
  let row = doc.getElementById("iranianJalaliMessageDateRow");
  if (!row) {
    row = doc.createElement("div");
    row.id = "iranianJalaliMessageDateRow";
    row.className = "message-header-row";
    row.style.fontSize = "0.92em";
    row.style.lineHeight = "1.35";
    row.style.opacity = "0.95";
    row.setAttribute("dir", "rtl");
    anchor.insertAdjacentElement("afterend", row);
  }
  row.textContent = text;
}

/**
 * @param {Window} msgCw - about:message content window
 */
function registerMessageHeaderListener(msgCw) {
  if (!msgCw || msgCw.__iranianDateMsgListener) {
    return;
  }
  if (!Array.isArray(msgCw.gMessageListeners)) {
    return;
  }
  const listener = {
    onStartHeaders() {
      removeJalaliMessageDateRow(msgCw.document);
    },
    onEndHeaders() {
      updateMessagePaneJalaliLine(msgCw);
    },
    onEndAttachments() {},
  };
  msgCw.gMessageListeners.push(listener);
  msgCw.__iranianDateMsgListener = listener;
  gMessageListenerHooks.push({ cw: msgCw, listener });
}

function installMessageBrowserHooks(innerWin) {
  const mb = innerWin.messageBrowser;
  if (!mb || mb.__iranianDateLoadHooked) {
    return;
  }
  mb.__iranianDateLoadHooked = true;
  let attempts = 0;
  const bindOrRetry = () => {
    try {
      const cw = mb.contentWindow;
      if (!cw) {
        if (attempts < 30) {
          attempts++;
          innerWin.setTimeout(bindOrRetry, 100);
        }
        return;
      }
      registerMessageHeaderListener(cw);
      updateMessagePaneJalaliLine(cw);
    } catch (e) {
      console.error("IranianDateColumn messageBrowser load", e);
    }
  };
  const onLoad = () => {
    attempts = 0;
    bindOrRetry();
  };
  mb.addEventListener("load", onLoad, true);
  mb.__iranianDateLoadHandler = onLoad;
  onLoad();
}

function installMessageHeaderInStandaloneWindow(outerWin) {
  const mb = outerWin.document?.getElementById("messageBrowser");
  if (!mb || mb.__iranianDateLoadHooked) {
    return;
  }
  mb.__iranianDateLoadHooked = true;
  let attempts = 0;
  const bindOrRetry = () => {
    try {
      const cw = mb.contentWindow;
      if (!cw) {
        if (attempts < 30) {
          attempts++;
          outerWin.setTimeout(bindOrRetry, 100);
        }
        return;
      }
      registerMessageHeaderListener(cw);
      updateMessagePaneJalaliLine(cw);
    } catch (e) {
      console.error("IranianDateColumn standalone msg load", e);
    }
  };
  const onLoad = () => {
    attempts = 0;
    bindOrRetry();
  };
  mb.addEventListener("load", onLoad, true);
  mb.__iranianDateLoadHandler = onLoad;
  onLoad();
}

function uninstallMessageHeaderHooks() {
  for (const { cw, listener } of gMessageListenerHooks) {
    try {
      const arr = cw.gMessageListeners;
      if (Array.isArray(arr)) {
        const i = arr.indexOf(listener);
        if (i >= 0) {
          arr.splice(i, 1);
        }
      }
      delete cw.__iranianDateMsgListener;
      removeJalaliMessageDateRow(cw.document);
    } catch (e) {
      console.error("IranianDateColumn uninstall msg listener", e);
    }
  }
  gMessageListenerHooks.length = 0;

  for (const outerWin of Services.wm.getEnumerator("mail:3pane")) {
    forEachAbout3PaneInnerWindow(outerWin, innerWin => {
      const mb = innerWin.messageBrowser;
      if (mb?.__iranianDateLoadHandler) {
        mb.removeEventListener("load", mb.__iranianDateLoadHandler, true);
        delete mb.__iranianDateLoadHandler;
        delete mb.__iranianDateLoadHooked;
      }
    });
  }
  for (const outerWin of Services.wm.getEnumerator("mail:messageWindow")) {
    const mb = outerWin.document?.getElementById("messageBrowser");
    if (mb?.__iranianDateLoadHandler) {
      mb.removeEventListener("load", mb.__iranianDateLoadHandler, true);
      delete mb.__iranianDateLoadHandler;
      delete mb.__iranianDateLoadHooked;
    }
  }
}

function unpatchThreadCardPrototypes() {
  for (const outerWin of Services.wm.getEnumerator("mail:3pane")) {
    forEachAbout3PaneInnerWindow(outerWin, innerWin => {
      try {
        const TC = innerWin.customElements?.get("thread-card");
        if (!TC) {
          return;
        }
        if (TC.prototype._iranianDateOrigFillRow) {
          TC.prototype.fillRow = TC.prototype._iranianDateOrigFillRow;
          delete TC.prototype._iranianDateOrigFillRow;
        }
        if (TC.prototype._iranianDateOrigIndexSet) {
          const cur = Object.getOwnPropertyDescriptor(TC.prototype, "index");
          Object.defineProperty(TC.prototype, "index", {
            configurable: true,
            enumerable: cur?.enumerable ?? true,
            get: cur?.get,
            set: TC.prototype._iranianDateOrigIndexSet,
          });
          delete TC.prototype._iranianDateOrigIndexSet;
        }
      } catch (e) {
        console.error("IranianDateColumn unpatch thread-card", e);
      }
    });
  }
}

function patchOpenMailWindows() {
  for (const outerWin of Services.wm.getEnumerator("mail:3pane")) {
    forEachAbout3PaneInnerWindow(outerWin, innerWin => {
      try {
        installMessageBrowserHooks(innerWin);
      } catch (e) {
        console.error("IranianDateColumn patch inner window", e);
      }
    });
  }
  for (const msgOuter of Services.wm.getEnumerator("mail:messageWindow")) {
    try {
      installMessageHeaderInStandaloneWindow(msgOuter);
    } catch (e2) {
      console.error("IranianDateColumn patch message window", e2);
    }
  }
}

/**
 * Inner about3Pane can load after the extension; retry a few times.
 */
function schedulePatchRetries() {
  const gen = ++gPatchGeneration;
  const outer = Services.wm.getMostRecentWindow("mail:3pane");
  if (!outer?.setTimeout) {
    return;
  }
  for (const ms of [0, 400, 1200, 3500]) {
    outer.setTimeout(() => {
      if (gen !== gPatchGeneration) {
        return;
      }
      patchOpenMailWindows();
    }, ms);
  }
}

/** Hooks message pane / standalone reader (no card-view Jalali). */
function installCardViewPatch() {
  patchOpenMailWindows();
  schedulePatchRetries();
  if (gDomWindowOpenedObserver) {
    return;
  }
  gDomWindowOpenedObserver = {
    observe(subject, topic) {
      if (topic !== "domwindowopened") {
        return;
      }
      const win = subject;
      if (!win?.setTimeout || win.closed) {
        return;
      }
      win.setTimeout(() => {
        try {
          const wt =
            win.document?.documentElement?.getAttribute("windowtype") || "";
          if (wt === "mail:3pane" || wt === "mail:messageWindow") {
            schedulePatchRetries();
          }
        } catch (err) {
          console.error("IranianDateColumn domwindowopened", err);
        }
      }, 0);
    },
  };
  Services.obs.addObserver(gDomWindowOpenedObserver, "domwindowopened", false);
}

function uninstallCardViewPatch() {
  gPatchGeneration++;
  const scrollOpts = { passive: true };
  for (const outerWin of Services.wm.getEnumerator("mail:3pane")) {
    forEachAbout3PaneInnerWindow(outerWin, innerWin => {
      try {
        if (innerWin.__iranianDateCardPaintOuterRaf) {
          innerWin.cancelAnimationFrame(innerWin.__iranianDateCardPaintOuterRaf);
          innerWin.__iranianDateCardPaintOuterRaf = 0;
        }
        if (innerWin.__iranianDateCardMutationObserver) {
          try {
            innerWin.__iranianDateCardMutationObserver.disconnect();
          } catch (e) {
            /* ignore */
          }
          delete innerWin.__iranianDateCardMutationObserver;
        }
        innerWin.document
          ?.querySelectorAll?.(".iranian-jalali-card")
          ?.forEach(n => n.remove());
        innerWin.threadTree?.shadowRoot
          ?.querySelectorAll?.(".iranian-jalali-card")
          ?.forEach(n => n.remove());
        const tp = innerWin.threadPane;
        if (tp?.__iranianDateOrigUpdateThreadView) {
          tp.updateThreadView = tp.__iranianDateOrigUpdateThreadView;
          delete tp.__iranianDateOrigUpdateThreadView;
          delete tp.__iranianDateWrapUpdate;
        }
        const tt = innerWin.threadTree;
        if (tt?.__iranianDateOrigInvalidate) {
          tt.invalidate = tt.__iranianDateOrigInvalidate;
          delete tt.__iranianDateOrigInvalidate;
          delete tt.__iranianDateWrapInvalidate;
        }
        if (innerWin.__iranianDateScrollTargets?.length) {
          for (const { el, fn } of innerWin.__iranianDateScrollTargets) {
            try {
              el.removeEventListener("scroll", fn, scrollOpts);
            } catch (e3) {
              /* ignore */
            }
          }
          delete innerWin.__iranianDateScrollTargets;
        }
        delete innerWin.__iranianDateScrollPaintInstalled;
      } catch (e) {
        console.error("IranianDateColumn uninstall pane hooks", e);
      }
    });
  }
  if (gDomWindowOpenedObserver) {
    try {
      Services.obs.removeObserver(
        gDomWindowOpenedObserver,
        "domwindowopened"
      );
    } catch (e) {
      console.error("IranianDateColumn removeObserver", e);
    }
    gDomWindowOpenedObserver = null;
  }
  unpatchThreadCardPrototypes();
  uninstallMessageHeaderHooks();
}

function refreshOpenMessageJalali() {
  for (const outerWin of Services.wm.getEnumerator("mail:3pane")) {
    forEachAbout3PaneInnerWindow(outerWin, innerWin => {
      try {
        const cw = innerWin.messageBrowser?.contentWindow;
        if (cw?.gMessage) {
          updateMessagePaneJalaliLine(cw);
        }
      } catch (e) {
        console.error("IranianDateColumn refresh msg pane", e);
      }
    });
  }
  for (const msgOuter of Services.wm.getEnumerator("mail:messageWindow")) {
    try {
      const cw =
        msgOuter.document?.getElementById("messageBrowser")?.contentWindow;
      if (cw?.gMessage) {
        updateMessagePaneJalaliLine(cw);
      }
    } catch (e2) {
      console.error("IranianDateColumn refresh standalone msg", e2);
    }
  }
}

function refreshMailViews() {
  patchOpenMailWindows();
  refreshOpenMessageJalali();
  for (const win of Services.wm.getEnumerator("mail:3pane")) {
    try {
      win.threadPane?.updateThreadView?.();
    } catch (e) {
      console.error("IranianDateColumn updateThreadView", e);
    }
  }
}

function sanitizeOptions(input) {
  let monthStyle = input?.monthStyle ?? gOptions.monthStyle;
  let weekDayStyle = input?.weekDayStyle ?? gOptions.weekDayStyle;
  let numbersStyle = input?.numbersStyle ?? gOptions.numbersStyle;

  if (monthStyle != "2-digit" && monthStyle != "long") {
    monthStyle = "2-digit";
  }
  if (weekDayStyle != "hidden" && weekDayStyle != "long") {
    weekDayStyle = "hidden";
  }
  if (numbersStyle != "arabext" && numbersStyle != "latn") {
    numbersStyle = "arabext";
  }
  return { monthStyle, weekDayStyle, numbersStyle };
}

/**
 * nsIMsgDBHdr.date is PRTime (usually microseconds). Prefer dateInSeconds when set.
 *
 * @param {nsIMsgDBHdr} hdr
 * @returns {number} milliseconds since epoch, or NaN
 */
function hdrDateMillis(hdr) {
  if (!hdr) {
    return NaN;
  }
  try {
    const sec = hdr.dateInSeconds;
    if (sec != null && sec !== undefined) {
      const s = Number(sec);
      if (Number.isFinite(s) && s > 0) {
        return s * 1000;
      }
    }
  } catch (e) {
    /* ignore */
  }
  let raw;
  try {
    raw = hdr.date;
  } catch (e2) {
    return NaN;
  }
  const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return NaN;
  }
  // PRTime is usually ~1e15 (µs). JS ms since 1970 is ~1e12.
  if (n > 1e14) {
    return Math.floor(n / 1000);
  }
  if (n > 1e9) {
    return Math.floor(n);
  }
  return Math.floor(n * 1000);
}

/**
 * Format a calendar field; tolerate missing ICU Persian extensions.
 */
function formatPartPersian(date, numbersStyle, options) {
  const nu = numbersStyle === "latn" ? "latn" : "arabext";
  const localeTag = `fa-IR-u-nu-${nu}-ca-persian`;
  try {
    const s = date.toLocaleString(localeTag, options);
    if (s && !s.includes("Invalid")) {
      return s;
    }
  } catch (e) {
    /* fall through */
  }
  try {
    const dtf = new Intl.DateTimeFormat("fa-IR", {
      ...options,
      calendar: "persian",
      numberingSystem: nu,
    });
    const t = dtf.format(date);
    if (t) {
      return t;
    }
  } catch (e2) {
    /* fall through */
  }
  return date.toLocaleString("en-GB", options);
}

function formatCellForMsgHdr(msgHdr) {
  const ms = hdrDateMillis(msgHdr);
  if (!Number.isFinite(ms)) {
    return "—";
  }
  const date = new Date(ms);
  const currentDate = new Date();
  const opts = gOptions;

  const yearStyle = "2-digit";
  const dayStyle = "2-digit";

  const year = formatPartPersian(date, opts.numbersStyle, { year: yearStyle });
  const month = formatPartPersian(date, opts.numbersStyle, {
    month: opts.monthStyle,
  });
  const day = formatPartPersian(date, opts.numbersStyle, { day: dayStyle });
  const weekDay =
    opts.weekDayStyle != "hidden"
      ? formatPartPersian(date, opts.numbersStyle, {
          weekday: opts.weekDayStyle,
        })
      : "";

  const localeForCompare = `fa-IR-u-nu-${opts.numbersStyle}-ca-persian`;
  let curYearStr;
  try {
    curYearStr = currentDate.toLocaleString(localeForCompare, { year: yearStyle });
  } catch (e) {
    curYearStr = formatPartPersian(currentDate, opts.numbersStyle, {
      year: yearStyle,
    });
  }

  const isCurrentYear = curYearStr == year;

  const isCurrentDay = date.toDateString() === currentDate.toDateString();

  const yesterdayDate = new Date();
  yesterdayDate.setDate(currentDate.getDate() - 1);
  const isYesterday = date.toDateString() === yesterdayDate.toDateString();

  let placeholder;
  if (opts.monthStyle === "long") {
    placeholder = "\u202BWD DD MM YY\u202C";
  } else {
    placeholder = "YY/MM/DD WD";
  }

  if (isCurrentYear) {
    placeholder = placeholder.replace(/YY./, "");
  }
  if (isCurrentDay) {
    placeholder = "امروز";
  } else if (isYesterday) {
    placeholder = "دیروز";
  }

  return placeholder
    .replace("YY", year)
    .replace("MM", month)
    .replace("DD", day)
    .replace("WD", weekDay);
}

function textCallback(msgHdr) {
  try {
    return formatCellForMsgHdr(msgHdr);
  } catch (e) {
    console.error("IranianDateColumn textCallback", e);
    return "—";
  }
}

function sortCallback(msgHdr) {
  const ms = hdrDateMillis(msgHdr);
  if (!Number.isFinite(ms)) {
    return 0;
  }
  return Math.floor(ms / 1000) >>> 0;
}

function registerColumn() {
  if (gColumnRegistered) {
    return;
  }
  try {
    ThreadPaneColumns.addCustomColumn(COLUMN_ID, {
      name: "تاریخ",
      sortable: true,
      resizable: true,
      hidden: false,
      textCallback,
      sortCallback,
    });
    gColumnRegistered = true;
  } catch (e) {
    if (!String(e.message || e).includes("already used")) {
      console.error("IranianDateColumn addCustomColumn", e);
      throw e;
    }
    gColumnRegistered = true;
  }
  installCardViewPatch();
}

function removeColumn() {
  uninstallCardViewPatch();
  if (!gColumnRegistered) {
    return;
  }
  try {
    ThreadPaneColumns.removeCustomColumn(COLUMN_ID);
  } catch (e) {
    console.error("IranianDateColumn removeCustomColumn", e);
  }
  gColumnRegistered = false;
}

var IranianDateColumn = class extends ExtensionCommon.ExtensionAPI {
  getAPI() {
    return {
      IranianDateColumn: {
        async register(options) {
          gOptions = sanitizeOptions({ ...gOptions, ...options });
          if (gColumnRegistered) {
            ThreadPaneColumns.refreshCustomColumn(COLUMN_ID);
            installCardViewPatch();
            refreshMailViews();
            return;
          }
          registerColumn();
        },

        async setOptions(options) {
          gOptions = sanitizeOptions({ ...gOptions, ...options });
          if (gColumnRegistered) {
            ThreadPaneColumns.refreshCustomColumn(COLUMN_ID);
            refreshMailViews();
          }
        },
      },
    };
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) {
      return;
    }
    removeColumn();
  }
};

// Some loaders resolve the experiment class from globalThis.
globalThis.IranianDateColumn = IranianDateColumn;

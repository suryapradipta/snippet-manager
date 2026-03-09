import { app as o, nativeImage as k, Tray as v, Menu as F, ipcMain as c, clipboard as P, dialog as R, systemPreferences as j, BrowserWindow as b, globalShortcut as w } from "electron";
import r from "path";
import { fileURLToPath as x } from "url";
import { exec as S } from "child_process";
import i from "fs";
const f = r.dirname(x(import.meta.url));
let e = null, g = null;
const E = !o.isPackaged, y = r.join(o.getPath("userData"), "snippets.json"), h = r.join(o.getPath("userData"), "settings.json"), d = {
  launchAtLogin: !0,
  hideOnBlur: !0,
  hotkey: process.platform === "darwin" ? "Command+Shift+Space" : "Control+Shift+Space"
};
function p() {
  try {
    if (i.existsSync(h)) {
      const a = i.readFileSync(h, "utf-8");
      return { ...d, ...JSON.parse(a) };
    }
  } catch (a) {
    console.error("[Electron] Error loading settings:", a);
  }
  return d;
}
function _() {
  i.existsSync(y) || i.writeFileSync(y, JSON.stringify([])), i.existsSync(h) || i.writeFileSync(h, JSON.stringify(d));
}
function T() {
  e = new b({
    width: 750,
    height: 520,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    hasShadow: !0,
    show: !1,
    webPreferences: {
      preload: r.join(f, "preload.js"),
      sandbox: !1
    }
  }), process.platform === "darwin" ? (e.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), e.setAlwaysOnTop(!0, "screen-saver")) : e.setAlwaysOnTop(!0), process.env.VITE_DEV_SERVER_URL ? e.loadURL(process.env.VITE_DEV_SERVER_URL + "app.html") : e.loadFile(r.join(f, "../dist/app.html")), p(), e.on("blur", () => {
    p().hideOnBlur && (e == null || e.hide());
  });
}
o.whenReady().then(() => {
  _(), T();
  const a = E ? r.join(f, "../public/logo-tray.png") : r.join(f, "../dist/logo-tray.png");
  try {
    const t = k.createFromPath(a).resize({ width: 18, height: 18 });
    g = new v(t);
    const s = F.buildFromTemplate([
      { label: "Quit Echo", click: () => {
        o.quit();
      } }
    ]);
    g.setToolTip("Echo Snippet Manager"), g.setContextMenu(s), g.on("click", () => {
      e != null && e.isVisible() ? e.hide() : (e == null || e.show(), e == null || e.focus());
    });
  } catch (t) {
    console.error("[Electron] Failed to create tray:", t);
  }
  function u(t) {
    w.unregisterAll();
    try {
      w.register(t, () => {
        e && (e.isVisible() ? e.hide() : (e.show(), e.focus()));
      }) ? console.log(`[Electron] Registered shortcut: ${t}`) : console.error(`[Electron] Failed to register shortcut: ${t}`);
    } catch (s) {
      console.error(`[Electron] Error registering shortcut ${t}:`, s);
      const l = d.hotkey;
      t !== l && (console.log(`[Electron] Falling back to default shortcut: ${l}`), u(l));
    }
  }
  const O = p();
  try {
    u(O.hotkey);
  } catch (t) {
    console.error("[Electron] Error registering initial hotkey from settings, falling back to default:", t), u(d.hotkey);
  }
  c.handle("get-snippets", () => {
    const t = i.readFileSync(y, "utf-8");
    return console.log("[Electron] get-snippets returning:", t.substring(0, 100) + "..."), JSON.parse(t);
  }), c.handle("save-snippets", (t, s) => {
    console.log("[Electron] save-snippets called with", s.length, "items"), i.writeFileSync(y, JSON.stringify(s, null, 2)), console.log("[Electron] File written successfully");
  }), c.handle("get-settings", () => p()), c.handle("save-settings", (t, s) => {
    console.log("[Electron] save-settings called:", s);
    const l = p();
    if (i.writeFileSync(h, JSON.stringify(s, null, 2)), s.hotkey !== l.hotkey && u(s.hotkey), !E)
      try {
        o.setLoginItemSettings({
          openAtLogin: s.launchAtLogin,
          path: o.getPath("exe")
        });
      } catch (m) {
        console.error("[Electron] Failed to set login item settings:", m);
      }
    return s;
  }), c.handle("hide-window", () => {
    e && (e.hide(), process.platform === "darwin" && o.hide());
  }), c.handle("paste-snippet", async (t, s) => {
    console.log("[Electron] paste-snippet IPC received with text length:", s.length), e && (process.platform === "win32" && (e.setAlwaysOnTop(!1), e.minimize()), e.hide(), process.platform === "darwin" && o.hide()), P.writeText(s), setTimeout(() => {
      console.log("[Electron] Attempting auto-paste simulation..."), process.platform === "darwin" ? S(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, (n) => {
        n && (console.error("[Electron] Mac Paste Error:", n), (n.message.includes("1002") || n.message.includes("not allowed")) && R.showMessageBox({
          type: "warning",
          title: "Accessibility Permission Required",
          message: 'Echo needs Accessibility permission to "autopaste" snippets.',
          detail: `To fix this, please go to:
System Settings > Privacy & Security > Accessibility
and ensure your Terminal (in development) or the Echo app is enabled.`,
          buttons: ["Open Settings", "OK"],
          cancelId: 1,
          defaultId: 0
        }).then(({ response: A }) => {
          A === 0 && j.isTrustedAccessibilityClient(!0);
        }));
      }) : process.platform === "win32" && S(`powershell -WindowStyle Hidden -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`, (n) => {
        n && console.error("[Electron] Windows Paste Error:", n), e && e.setAlwaysOnTop(!0);
      });
    }, 0);
  }), o.on("activate", () => {
    b.getAllWindows().length === 0 && T();
  });
});
o.on("window-all-closed", () => {
});
o.on("will-quit", () => {
  w.unregisterAll();
});

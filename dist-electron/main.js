import { app as t, globalShortcut as f, ipcMain as n, clipboard as g, BrowserWindow as w } from "electron";
import r from "path";
import { fileURLToPath as E } from "url";
import { exec as c } from "child_process";
import l from "fs";
const p = r.dirname(E(import.meta.url));
let e = null;
process.env.NODE_ENV;
const a = r.join(t.getPath("userData"), "snippets.json");
function S() {
  l.existsSync(a) || l.writeFileSync(a, JSON.stringify([]));
}
function d() {
  e = new w({
    width: 750,
    height: 520,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    hasShadow: !0,
    show: !1,
    webPreferences: {
      preload: r.join(p, "preload.js"),
      sandbox: !1
    }
  }), process.platform === "darwin" ? (e.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), e.setAlwaysOnTop(!0, "screen-saver")) : e.setAlwaysOnTop(!0), process.env.VITE_DEV_SERVER_URL ? e.loadURL(process.env.VITE_DEV_SERVER_URL) : e.loadFile(r.join(p, "../dist/index.html")), e.on("blur", () => {
    e == null || e.hide();
  });
}
t.whenReady().then(() => {
  S(), d();
  const m = process.platform === "darwin" ? "Command+Shift+Space" : "Control+Shift+Space";
  f.register(m, () => {
    e && (e.isVisible() ? e.hide() : (e.show(), e.focus()));
  }), n.handle("get-snippets", () => {
    const i = l.readFileSync(a, "utf-8");
    return console.log("[Electron] get-snippets returning:", i.substring(0, 100) + "..."), JSON.parse(i);
  }), n.handle("save-snippets", (i, s) => {
    console.log("[Electron] save-snippets called with", s.length, "items"), l.writeFileSync(a, JSON.stringify(s, null, 2)), console.log("[Electron] File written successfully");
  }), n.handle("hide-window", () => {
    e && (e.hide(), process.platform === "darwin" && t.hide());
  }), n.handle("paste-snippet", async (i, s) => {
    console.log("[Electron] paste-snippet IPC received with text length:", s.length), e && (process.platform === "win32" && (e.setAlwaysOnTop(!1), e.minimize()), e.hide(), process.platform === "darwin" && t.hide()), g.writeText(s);
    const h = process.platform === "darwin" ? 200 : 500;
    setTimeout(() => {
      console.log("[Electron] Attempting auto-paste simulation..."), process.platform === "darwin" ? c(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, (o) => {
        o && console.error("[Electron] Mac Paste Error:", o);
      }) : process.platform === "win32" && c(`powershell -WindowStyle Hidden -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`, (o) => {
        o && console.error("[Electron] Windows Paste Error:", o), e && e.setAlwaysOnTop(!0);
      });
    }, h);
  }), t.on("activate", () => {
    w.getAllWindows().length === 0 && d();
  });
});
t.on("window-all-closed", () => {
  process.platform !== "darwin" && t.quit();
});
t.on("will-quit", () => {
  f.unregisterAll();
});

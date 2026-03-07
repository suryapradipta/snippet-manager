import { app, globalShortcut, ipcMain, clipboard, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import fs from "fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
process.env.NODE_ENV !== "development";
const STORE_PATH = path.join(app.getPath("userData"), "snippets.json");
function initStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify([]));
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 520,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      sandbox: false
    }
  });
  if (process.platform === "darwin") {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, "screen-saver");
  } else {
    mainWindow.setAlwaysOnTop(true);
  }
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.on("blur", () => {
    mainWindow == null ? void 0 : mainWindow.hide();
  });
}
app.whenReady().then(() => {
  initStore();
  createWindow();
  const shortcut = process.platform === "darwin" ? "Command+Shift+Space" : "Control+Shift+Space";
  globalShortcut.register(shortcut, () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  ipcMain.handle("get-snippets", () => {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    console.log("[Electron] get-snippets returning:", raw.substring(0, 100) + "...");
    return JSON.parse(raw);
  });
  ipcMain.handle("save-snippets", (e, snippets) => {
    console.log("[Electron] save-snippets called with", snippets.length, "items");
    fs.writeFileSync(STORE_PATH, JSON.stringify(snippets, null, 2));
    console.log("[Electron] File written successfully");
  });
  ipcMain.handle("paste-snippet", async (e, text) => {
    console.log("[Electron] paste-snippet IPC received with text length:", text.length);
    if (mainWindow) {
      mainWindow.hide();
      if (process.platform === "darwin") {
        app.hide();
      }
    }
    clipboard.writeText(text);
    const delay = process.platform === "darwin" ? 200 : 100;
    setTimeout(() => {
      console.log("[Electron] Attempting auto-paste simulation...");
      if (process.platform === "darwin") {
        const script = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
        exec(script, (error, stdout, stderr) => {
          if (error) console.error("[Electron] Paste script error:", error);
          if (stderr) console.error("[Electron] Paste script stderr:", stderr);
          console.log("[Electron] Auto-paste simulation complete");
        });
      } else if (process.platform === "win32") {
        const script = `powershell -c "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`;
        exec(script, (error) => {
          if (error) console.error("[Electron] Paste script error:", error);
          console.log("[Electron] Auto-paste simulation complete");
        });
      }
    }, delay);
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

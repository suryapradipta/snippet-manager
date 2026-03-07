import { app, globalShortcut, ipcMain, BrowserWindow } from "electron";
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
    width: 600,
    height: 450,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      sandbox: false
    }
  });
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
    return JSON.parse(raw);
  });
  ipcMain.handle("save-snippets", (e, snippets) => {
    fs.writeFileSync(STORE_PATH, JSON.stringify(snippets, null, 2));
  });
  ipcMain.handle("paste-snippet", async (e, text) => {
    if (mainWindow) {
      mainWindow.hide();
    }
    const { clipboard } = require("electron");
    clipboard.writeText(text);
    setTimeout(() => {
      if (process.platform === "darwin") {
        const script = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
        exec(script);
      } else if (process.platform === "win32") {
        const script = `powershell -c "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`;
        exec(script);
      }
    }, 50);
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

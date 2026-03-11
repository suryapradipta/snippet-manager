import { app, nativeImage, Tray, Menu, ipcMain, clipboard, dialog, systemPreferences, BrowserWindow, globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;
const STORE_PATH = path.join(app.getPath("userData"), "snippets.json");
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
const DEFAULT_SETTINGS = {
  launchAtLogin: true,
  hideOnBlur: true,
  hotkey: process.platform === "darwin" ? "Command+Shift+Space" : "Control+Shift+Space",
  hasSeenOnboarding: false
};
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error("[Electron] Error loading settings:", err);
  }
  return DEFAULT_SETTINGS;
}
function initStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify([]));
  }
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS));
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 520,
    frame: false,
    transparent: true,
    resizable: false,
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
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL + "app.html");
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/app.html"));
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  });
  loadSettings();
  mainWindow.on("blur", () => {
    if (loadSettings().hideOnBlur) {
      mainWindow == null ? void 0 : mainWindow.hide();
    }
  });
}
app.whenReady().then(() => {
  initStore();
  createWindow();
  const iconPath = isDev ? path.join(__dirname$1, "../public/logo-tray.png") : path.join(__dirname$1, "../dist/logo-tray.png");
  try {
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Quit Echo", click: () => {
        app.quit();
      } }
    ]);
    tray.setToolTip("Echo Snippet Manager");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
      if (mainWindow == null ? void 0 : mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        if (mainWindow == null ? void 0 : mainWindow.isMinimized()) mainWindow.restore();
        mainWindow == null ? void 0 : mainWindow.show();
        mainWindow == null ? void 0 : mainWindow.focus();
      }
    });
  } catch (err) {
    console.error("[Electron] Failed to create tray:", err);
  }
  function registerGlobalShortcut(accelerator) {
    globalShortcut.unregisterAll();
    try {
      const success = globalShortcut.register(accelerator, () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
      if (!success) console.error(`[Electron] Failed to register shortcut: ${accelerator}`);
      else console.log(`[Electron] Registered shortcut: ${accelerator}`);
    } catch (err) {
      console.error(`[Electron] Error registering shortcut ${accelerator}:`, err);
      const defaultHotkey = DEFAULT_SETTINGS.hotkey;
      if (accelerator !== defaultHotkey) {
        console.log(`[Electron] Falling back to default shortcut: ${defaultHotkey}`);
        registerGlobalShortcut(defaultHotkey);
      }
    }
  }
  const initialSettings = loadSettings();
  try {
    registerGlobalShortcut(initialSettings.hotkey);
  } catch (err) {
    console.error("[Electron] Error registering initial hotkey from settings, falling back to default:", err);
    registerGlobalShortcut(DEFAULT_SETTINGS.hotkey);
  }
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
  ipcMain.handle("get-settings", () => {
    return loadSettings();
  });
  ipcMain.handle("get-version", () => {
    return app.getVersion();
  });
  ipcMain.handle("save-settings", (e, settings) => {
    console.log("[Electron] save-settings called:", settings);
    const oldSettings = loadSettings();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    if (settings.hotkey !== oldSettings.hotkey) {
      registerGlobalShortcut(settings.hotkey);
    }
    if (!isDev) {
      try {
        app.setLoginItemSettings({
          openAtLogin: settings.launchAtLogin,
          path: app.getPath("exe")
        });
      } catch (err) {
        console.error("[Electron] Failed to set login item settings:", err);
      }
    }
    return settings;
  });
  ipcMain.handle("hide-window", () => {
    if (mainWindow) {
      mainWindow.hide();
      if (process.platform === "darwin") {
        app.hide();
      }
    }
  });
  ipcMain.handle("paste-snippet", async (e, text) => {
    if (text) clipboard.writeText(text);
    if (mainWindow) {
      if (process.platform === "win32") {
        mainWindow.setAlwaysOnTop(false);
      }
      mainWindow.hide();
      if (process.platform === "darwin") {
        app.hide();
      }
    }
    const delay = process.platform === "darwin" ? 30 : 150;
    setTimeout(() => {
      if (process.platform === "darwin") {
        const script = 'tell application "System Events" to keystroke "v" using command down';
        const child = spawn("osascript", ["-e", script], {
          detached: true,
          stdio: "ignore"
        });
        child.on("error", (error) => {
          var _a, _b;
          console.error("[Electron] Mac Paste Error:", error);
          if (((_a = error.message) == null ? void 0 : _a.includes("1002")) || ((_b = error.message) == null ? void 0 : _b.includes("not allowed"))) {
            showAccessibilityDialog();
          }
        });
        child.unref();
      } else if (process.platform === "win32") {
        const psCommand = "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('^v')";
        spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", psCommand], {
          shell: true,
          detached: true,
          stdio: "ignore"
        }).unref();
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(true);
        }
      }
    }, delay);
  });
  function showAccessibilityDialog() {
    dialog.showMessageBox({
      type: "warning",
      title: "Accessibility Permission Required",
      message: 'Echo needs Accessibility permission to "autopaste" snippets.',
      detail: "To fix this, please go to:\nSystem Settings > Privacy & Security > Accessibility\nand ensure your Terminal (in development) or the Echo app is enabled.",
      buttons: ["Open Settings", "OK"],
      cancelId: 1,
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        systemPreferences.isTrustedAccessibilityClient(true);
      }
    });
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

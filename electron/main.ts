import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV !== 'development';

const STORE_PATH = path.join(app.getPath('userData'), 'snippets.json');

// Initialize store if it doesn't exist
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
      preload: path.join(__dirname, 'preload.mjs'),
      sandbox: false,
    },
  });

  // Load Vite dev server URL in dev, else load built index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('blur', () => {
    mainWindow?.hide();
  });
}

app.whenReady().then(() => {
  initStore();
  createWindow();

  // Register Global Shortcut (Cmd+Shift+Space or Ctrl+Shift+Space)
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space';
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

  // Handle IPCs
  ipcMain.handle('get-snippets', () => {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  });

  ipcMain.handle('save-snippets', (e, snippets) => {
    fs.writeFileSync(STORE_PATH, JSON.stringify(snippets, null, 2));
  });

  ipcMain.handle('paste-snippet', async (e, text) => {
    // 1. Hide the window first to return focus to underlying app
    
    // In dev, the window might not hide fast enough, so we wait briefly.
    if (mainWindow) {
      mainWindow.hide();
    }
    
    // Copy the snippet to clipboard
    const { clipboard } = require('electron');
    clipboard.writeText(text);

    // Wait a tiny bit for the window to fully hide and yield focus
    setTimeout(() => {
      // 2. Simulate paste keystroke based on OS
      if (process.platform === 'darwin') {
        const script = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
        exec(script);
      } else if (process.platform === 'win32') {
        // Simple powershell paste simulation
        const script = `powershell -c "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`;
        exec(script);
      }
    }, 50);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

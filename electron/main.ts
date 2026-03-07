import { app, BrowserWindow, globalShortcut, ipcMain, clipboard } from 'electron';
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
    width: 750,
    height: 520,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
  });

  // Support for showing over full-screen apps on macOS
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setAlwaysOnTop(true);
  }

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
    console.log('[Electron] get-snippets returning:', raw.substring(0, 100) + '...');
    return JSON.parse(raw);
  });

  ipcMain.handle('save-snippets', (e, snippets) => {
    console.log('[Electron] save-snippets called with', snippets.length, 'items');
    fs.writeFileSync(STORE_PATH, JSON.stringify(snippets, null, 2));
    console.log('[Electron] File written successfully');
  });

  ipcMain.handle('hide-window', () => {
    if (mainWindow) {
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.hide();
      }
    }
  });

  ipcMain.handle('paste-snippet', async (e, text) => {
    console.log('[Electron] paste-snippet IPC received with text length:', text.length);
    
    // 1. Hide the window first to return focus to underlying app
    if (mainWindow) {
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.hide(); // On Mac, this is more reliable for yielding focus back
      }
    }
    
    // Copy the snippet to clipboard
    clipboard.writeText(text);

    // Wait a tiny bit for the window to fully hide and yield focus
    const delay = process.platform === 'darwin' ? 200 : 100; // Reduced Mac delay for faster paste transition
    setTimeout(() => {
      console.log('[Electron] Attempting auto-paste simulation...');
      
      // 2. Simulate paste keystroke based on OS
      if (process.platform === 'darwin') {
        // Use a more specific AppleScript that ensures System Events is ready
        const script = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
        exec(script, (error, stdout, stderr) => {
          if (error) console.error('[Electron] Paste script error:', error);
          if (stderr) console.error('[Electron] Paste script stderr:', stderr);
          console.log('[Electron] Auto-paste simulation complete');
        });
      } else if (process.platform === 'win32') {
        const script = `powershell -c "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`;
        exec(script, (error) => {
          if (error) console.error('[Electron] Paste script error:', error);
          console.log('[Electron] Auto-paste simulation complete');
        });
      }
    }, delay);
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

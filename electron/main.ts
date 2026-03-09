import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
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
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL + 'app.html');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/app.html'));
  }

  mainWindow.on('blur', () => {
    mainWindow?.hide();
  });
}

app.whenReady().then(() => {
  initStore();
  createWindow();

  // Create System Tray / Menu Bar Icon
  const iconPath = isDev 
    ? path.join(__dirname, '../public/logo.png') 
    : path.join(__dirname, '../dist/logo.png');

  try {
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Quit Echo', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Echo Snippet Manager');
    tray.setContextMenu(contextMenu);
    
    // Toggle window on tray click
    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  } catch (err) {
    console.error('[Electron] Failed to create tray:', err);
  }

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
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(false); // Temporarily drop always-on-top to yield focus
        mainWindow.minimize(); // Minimizing is often more effective on Windows for focus return
      }
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.hide(); 
      }
    }
    
    // Copy the snippet to clipboard
    clipboard.writeText(text);

    // Wait for the OS to switch focus back to the target app
    const delay = process.platform === 'darwin' ? 200 : 500; 
    setTimeout(() => {
      console.log('[Electron] Attempting auto-paste simulation...');
      
      if (process.platform === 'darwin') {
        const script = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
        exec(script, (error) => {
          if (error) console.error('[Electron] Mac Paste Error:', error);
        });
      } else if (process.platform === 'win32') {
        // More resilient Windows approach: Use a temporary VBScript or direct PowerShell with priority
        const script = `powershell -WindowStyle Hidden -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`;
        exec(script, (error) => {
          if (error) console.error('[Electron] Windows Paste Error:', error);
          
          // Restore alwaysOnTop for next time
          if (mainWindow) {
            mainWindow.setAlwaysOnTop(true);
          }
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
  // Keep app running in the tray even when all windows are closed
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

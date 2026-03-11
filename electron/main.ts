import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const isDev = !app.isPackaged;

const STORE_PATH = path.join(app.getPath('userData'), 'snippets.json');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  launchAtLogin: true,
  hideOnBlur: true,
  hotkey: process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space',
  hasSeenOnboarding: false
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('[Electron] Error loading settings:', err);
  }
  return DEFAULT_SETTINGS;
}

// Initialize store if it doesn't exist
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

  // Show window when ready to confirm app is running
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  const settings = loadSettings();

  mainWindow.on('blur', () => {
    if (loadSettings().hideOnBlur) {
      mainWindow?.hide();
    }
  });
}

app.whenReady().then(() => {
  initStore();
  createWindow();

  // Create System Tray / Menu Bar Icon
  const iconPath = isDev
    ? path.join(__dirname, '../public/logo-tray.png')
    : path.join(__dirname, '../dist/logo-tray.png');

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
        if (mainWindow?.isMinimized()) mainWindow.restore();
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  } catch (err) {
    console.error('[Electron] Failed to create tray:', err);
  }


  function registerGlobalShortcut(accelerator: string) {
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
      // If it fails and it's not the default, try registering the default as a fallback
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
    console.error('[Electron] Error registering initial hotkey from settings, falling back to default:', err);
    registerGlobalShortcut(DEFAULT_SETTINGS.hotkey);
  }

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

  ipcMain.handle('get-settings', () => {
    return loadSettings();
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('save-settings', (e, settings) => {
    console.log('[Electron] save-settings called:', settings);
    const oldSettings = loadSettings();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

    // Apply Hotkey if changed
    if (settings.hotkey !== oldSettings.hotkey) {
      registerGlobalShortcut(settings.hotkey);
    }

    // Apply Launch at Login
    if (!isDev) {
      try {
        app.setLoginItemSettings({
          openAtLogin: settings.launchAtLogin,
          path: app.getPath('exe'),
        });
      } catch (err) {
        console.error('[Electron] Failed to set login item settings:', err);
      }
    }

    return settings;
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
    // 1. Prepare clipboard content immediately
    if (text) clipboard.writeText(text);

    // 2. Hide window quickly to return focus to the target application
    if (mainWindow) {
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(false);
      }
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.hide();
      }
    }

    // 3. Trigger paste simulation
    // Windows transition animations take longer than macOS, so we give it more breathing room
    const delay = process.platform === 'darwin' ? 30 : 150; 
    
    setTimeout(() => {
      if (process.platform === 'darwin') {
        const script = 'tell application "System Events" to keystroke "v" using command down';
        const child = spawn('osascript', ['-e', script], {
          detached: true,
          stdio: 'ignore'
        });
        
        child.on('error', (error: any) => {
          console.error('[Electron] Mac Paste Error:', error);
          if (error.message?.includes('1002') || error.message?.includes('not allowed')) {
            showAccessibilityDialog();
          }
        });
        child.unref();
      } else if (process.platform === 'win32') {
        // Use .NET SendKeys via PowerShell for better reliability on Windows
        // -NoProfile significantly speeds up PowerShell startup
        const psCommand = "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('^v')";
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psCommand], {
          shell: true,
          detached: true,
          stdio: 'ignore'
        }).unref();

        // Restore alwaysOnTop for next time
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(true);
        }
      }
    }, delay);
  });

  function showAccessibilityDialog() {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Permission Required',
      message: 'Echo needs Accessibility permission to "autopaste" snippets.',
      detail: 'To fix this, please go to:\nSystem Settings > Privacy & Security > Accessibility\nand ensure your Terminal (in development) or the Echo app is enabled.',
      buttons: ['Open Settings', 'OK'],
      cancelId: 1,
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        systemPreferences.isTrustedAccessibilityClient(true);
      }
    });
  }

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

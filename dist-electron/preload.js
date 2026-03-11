import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  getSnippets: () => ipcRenderer.invoke("get-snippets"),
  saveSnippets: (snippets) => ipcRenderer.invoke("save-snippets", snippets),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  pasteSnippet: (text) => ipcRenderer.invoke("paste-snippet", text),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  getPlatform: () => process.platform,
  getVersion: () => ipcRenderer.invoke("get-version")
});

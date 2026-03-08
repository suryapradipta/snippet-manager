import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  getSnippets: () => ipcRenderer.invoke("get-snippets"),
  saveSnippets: (snippets) => ipcRenderer.invoke("save-snippets", snippets),
  pasteSnippet: (text) => ipcRenderer.invoke("paste-snippet", text),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  getPlatform: () => process.platform
});

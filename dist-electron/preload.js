import { contextBridge as i, ipcRenderer as e } from "electron";
i.exposeInMainWorld("electronAPI", {
  getSnippets: () => e.invoke("get-snippets"),
  saveSnippets: (t) => e.invoke("save-snippets", t),
  getSettings: () => e.invoke("get-settings"),
  saveSettings: (t) => e.invoke("save-settings", t),
  pasteSnippet: (t) => e.invoke("paste-snippet", t),
  hideWindow: () => e.invoke("hide-window"),
  getPlatform: () => process.platform
});

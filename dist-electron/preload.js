import { contextBridge as i, ipcRenderer as e } from "electron";
i.exposeInMainWorld("electronAPI", {
  getSnippets: () => e.invoke("get-snippets"),
  saveSnippets: (p) => e.invoke("save-snippets", p),
  pasteSnippet: (p) => e.invoke("paste-snippet", p),
  hideWindow: () => e.invoke("hide-window"),
  getPlatform: () => process.platform
});

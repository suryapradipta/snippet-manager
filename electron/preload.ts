import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSnippets: () => ipcRenderer.invoke('get-snippets'),
  saveSnippets: (snippets: any) => ipcRenderer.invoke('save-snippets', snippets),
  pasteSnippet: (text: string) => ipcRenderer.invoke('paste-snippet', text),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  getPlatform: () => process.platform
});

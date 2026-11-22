const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  defaultFolder: () => ipcRenderer.invoke('default-folder'),
  close: () => ipcRenderer.invoke('win:close'),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  startDownload: (opts) => ipcRenderer.invoke('download:start', opts),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  onProgress: (cb) => ipcRenderer.on('download:progress', (_e, d) => cb(d))
});

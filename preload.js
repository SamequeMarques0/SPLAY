const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  defaultFolder: () => ipcRenderer.invoke('default-folder'),
  close: () => ipcRenderer.invoke('win:close'),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  binStatus: () => ipcRenderer.invoke('bin:status'),
  startDownload: (opts) => ipcRenderer.invoke('download:start', opts),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  onProgress: (cb) => {
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  }
});

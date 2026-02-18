import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('elenweaveDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:get-runtime-info'),
  getConfig: () => ipcRenderer.invoke('desktop:get-config'),
  updateConfig: (config) => ipcRenderer.invoke('desktop:update-config', config),
  restartServer: () => ipcRenderer.invoke('desktop:restart-server'),
  openDataDir: () => ipcRenderer.invoke('desktop:open-data-dir'),
  openDesktopConfig: () => ipcRenderer.invoke('desktop:open-desktop-config')
});

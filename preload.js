const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isElectron: true,
  exportChampionship: (jsonString, defaultName) =>
    ipcRenderer.invoke('championship:export', jsonString, defaultName),
  importChampionship: () =>
    ipcRenderer.invoke('championship:import'),
  openImagesFolder: (subFolder) =>
    ipcRenderer.invoke('images:openFolder', subFolder),
  listLocalImages: () =>
    ipcRenderer.invoke('images:listLocal'),
  saveImageToLocal: (category, safeBaseName, dataUri) =>
    ipcRenderer.invoke('images:saveToLocal', category, safeBaseName, dataUri)
});

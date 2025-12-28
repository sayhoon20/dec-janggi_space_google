const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startEngine: () => ipcRenderer.send('engine-start'),
  stopEngine: () => ipcRenderer.send('engine-stop'),
  sendCommand: (command) => ipcRenderer.send('engine-command', command),
  onEngineOutput: (callback) => ipcRenderer.on('engine-output', (event, value) => callback(value)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

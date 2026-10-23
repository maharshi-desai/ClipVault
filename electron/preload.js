const { contextBridge, ipcRenderer } = require('electron')
const { createRendererApi } = require('./renderer-api')

// Expose named capabilities only. Never pass ipcRenderer itself across the bridge.
contextBridge.exposeInMainWorld('clipVault', createRendererApi(ipcRenderer))

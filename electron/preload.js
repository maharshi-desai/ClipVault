const { contextBridge } = require('electron')

// Keep the renderer API intentionally small. Add capabilities here as features are built.
contextBridge.exposeInMainWorld('clipVault', {
  getAppVersion: () => process.env.npm_package_version || '1.0.0',
})

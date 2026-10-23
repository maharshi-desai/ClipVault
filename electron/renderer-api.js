const { IPC_CHANNELS, isWindowStatePayload } = require('./ipc-contract')

function createRendererApi(ipcRenderer) {
  return Object.freeze({
    getAppInfo() {
      return ipcRenderer.invoke(IPC_CHANNELS.getAppInfo)
    },

    onWindowStateChanged(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('A callback function is required.')
      }

      let active = true
      const listener = (_event, payload) => {
        if (active && isWindowStatePayload(payload)) callback(payload.state)
      }

      ipcRenderer.on(IPC_CHANNELS.windowStateChanged, listener)

      return () => {
        if (!active) return
        active = false
        ipcRenderer.removeListener(IPC_CHANNELS.windowStateChanged, listener)
      }
    },
  })
}

module.exports = { createRendererApi }

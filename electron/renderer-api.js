const {
  IPC_CHANNELS,
  isCaptureStatusPayload,
  isClipboardEntryPayload,
  isWindowStatePayload,
} = require('./ipc-contract')

function createRendererApi(ipcRenderer) {
  function subscribe(channel, callback, isValid, selectValue = (value) => value) {
    if (typeof callback !== 'function') {
      throw new TypeError('A callback function is required.')
    }

    let active = true
    const listener = (_event, payload) => {
      if (active && isValid(payload)) callback(selectValue(payload))
    }

    ipcRenderer.on(channel, listener)
    return () => {
      if (!active) return
      active = false
      ipcRenderer.removeListener(channel, listener)
    }
  }

  return Object.freeze({
    getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
    getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.getHistory),
    searchHistory: (query) => ipcRenderer.invoke(IPC_CHANNELS.searchHistory, query),
    copyHistoryEntry: (id) => ipcRenderer.invoke(IPC_CHANNELS.copyHistoryEntry, id),
    deleteHistoryEntry: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteHistoryEntry, id),
    clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.clearHistory),
    pauseCapture: () => ipcRenderer.invoke(IPC_CHANNELS.pauseCapture),
    resumeCapture: () => ipcRenderer.invoke(IPC_CHANNELS.resumeCapture),
    getCaptureStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getCaptureStatus),
    onClipboardEntry: (callback) => subscribe(
      IPC_CHANNELS.clipboardEntry,
      callback,
      isClipboardEntryPayload,
      (entry) => ({ id: entry.id, text: entry.text, timestamp: entry.timestamp }),
    ),
    onCaptureStatusChanged: (callback) => subscribe(
      IPC_CHANNELS.captureStatusChanged,
      callback,
      isCaptureStatusPayload,
      (status) => ({
        enabled: status.enabled,
        pollIntervalMs: status.pollIntervalMs,
        historyLimit: status.historyLimit,
        maxClipboardTextChars: status.maxClipboardTextChars,
        storageAvailable: status.storageAvailable,
      }),
    ),
    onWindowStateChanged: (callback) => subscribe(
      IPC_CHANNELS.windowStateChanged,
      callback,
      isWindowStatePayload,
      (payload) => payload.state,
    ),
  })
}

module.exports = { createRendererApi }

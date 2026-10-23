const IPC_CHANNELS = Object.freeze({
  getAppInfo: 'clipvault:app:get-info',
  windowStateChanged: 'clipvault:window:state-changed',
  getHistory: 'clipvault:history:get',
  searchHistory: 'clipvault:history:search',
  copyHistoryEntry: 'clipvault:history:copy',
  deleteHistoryEntry: 'clipvault:history:delete',
  clearHistory: 'clipvault:history:clear',
  pauseCapture: 'clipvault:capture:pause',
  resumeCapture: 'clipvault:capture:resume',
  getCaptureStatus: 'clipvault:capture:get-status',
  clipboardEntry: 'clipvault:history:new-entry',
  captureStatusChanged: 'clipvault:capture:status-changed',
})

function isWindowStatePayload(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (payload.state === 'focused' || payload.state === 'blurred'),
  )
}

function isClipboardEntryPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof payload.id === 'string' &&
      payload.id.length > 0 &&
      payload.id.length <= 128 &&
      typeof payload.text === 'string' &&
      payload.text.length > 0 &&
      typeof payload.timestamp === 'string' &&
      Number.isFinite(Date.parse(payload.timestamp)),
  )
}

function isCaptureStatusPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof payload.enabled === 'boolean' &&
      Number.isSafeInteger(payload.pollIntervalMs) &&
      payload.pollIntervalMs > 0 &&
      Number.isSafeInteger(payload.historyLimit) &&
      payload.historyLimit > 0 &&
      Number.isSafeInteger(payload.maxClipboardTextChars) &&
      payload.maxClipboardTextChars > 0 &&
      typeof payload.storageAvailable === 'boolean',
  )
}

function isTrustedMainFrameEvent(event, BrowserWindow, trustedWebContents) {
  if (!event || !event.sender || !event.senderFrame) return false
  if (event.senderFrame !== event.sender.mainFrame) return false
  if (!trustedWebContents || !trustedWebContents.has(event.sender)) return false

  const window = BrowserWindow.fromWebContents(event.sender)
  return Boolean(window && !window.isDestroyed())
}

module.exports = {
  IPC_CHANNELS,
  isCaptureStatusPayload,
  isClipboardEntryPayload,
  isTrustedMainFrameEvent,
  isWindowStatePayload,
}

const IPC_CHANNELS = Object.freeze({
  getAppInfo: 'clipvault:app:get-info',
  windowStateChanged: 'clipvault:window:state-changed',
})

function isWindowStatePayload(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (payload.state === 'focused' || payload.state === 'blurred'),
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
  isTrustedMainFrameEvent,
  isWindowStatePayload,
}

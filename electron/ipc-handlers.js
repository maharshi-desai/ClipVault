const { IPC_CHANNELS, isTrustedMainFrameEvent } = require('./ipc-contract')

function createGetAppInfoHandler({ app, BrowserWindow, platform, trustedWebContents }) {
  return (event, ...args) => {
    if (!isTrustedMainFrameEvent(event, BrowserWindow, trustedWebContents)) {
      throw new Error('IPC request came from an untrusted renderer.')
    }
    if (args.length !== 0) throw new TypeError('This IPC request does not accept arguments.')

    return {
      name: app.getName(),
      version: app.getVersion(),
      platform,
    }
  }
}

function assertArgumentCount(args, expected, operation) {
  if (args.length !== expected) {
    throw new TypeError(`${operation} received an invalid number of arguments.`)
  }
}

function validateEntryId(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function registerIpcHandlers({
  ipcMain,
  app,
  BrowserWindow,
  trustedWebContents,
  historyStore,
  clipboardMonitor,
  clipboard,
}) {
  function register(channel, operation) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedMainFrameEvent(event, BrowserWindow, trustedWebContents)) {
        throw new Error('IPC request came from an untrusted renderer.')
      }
      return operation(...args)
    })
  }

  ipcMain.handle(
    IPC_CHANNELS.getAppInfo,
    createGetAppInfoHandler({ app, BrowserWindow, platform: process.platform, trustedWebContents }),
  )

  register(IPC_CHANNELS.getHistory, (...args) => {
    assertArgumentCount(args, 0, 'getHistory')
    return historyStore.getHistory()
  })

  register(IPC_CHANNELS.searchHistory, (...args) => {
    assertArgumentCount(args, 1, 'searchHistory')
    const [query] = args
    if (typeof query !== 'string' || query.length > 256) {
      throw new TypeError('Search query must be text no longer than 256 characters.')
    }
    return historyStore.search(query.trim())
  })

  register(IPC_CHANNELS.copyHistoryEntry, async (...args) => {
    assertArgumentCount(args, 1, 'copyHistoryEntry')
    const [id] = args
    if (!validateEntryId(id)) throw new TypeError('Clipboard entry ID is invalid.')
    const entry = await historyStore.getById(id)
    if (!entry) return false
    clipboard.writeText(entry.text)
    return true
  })

  register(IPC_CHANNELS.deleteHistoryEntry, (...args) => {
    assertArgumentCount(args, 1, 'deleteHistoryEntry')
    const [id] = args
    if (!validateEntryId(id)) throw new TypeError('Clipboard entry ID is invalid.')
    return historyStore.delete(id)
  })

  register(IPC_CHANNELS.clearHistory, (...args) => {
    assertArgumentCount(args, 0, 'clearHistory')
    return historyStore.clear()
  })

  register(IPC_CHANNELS.pauseCapture, (...args) => {
    assertArgumentCount(args, 0, 'pauseCapture')
    return clipboardMonitor.pause()
  })

  register(IPC_CHANNELS.resumeCapture, (...args) => {
    assertArgumentCount(args, 0, 'resumeCapture')
    return clipboardMonitor.resume()
  })

  register(IPC_CHANNELS.getCaptureStatus, (...args) => {
    assertArgumentCount(args, 0, 'getCaptureStatus')
    return clipboardMonitor.getStatus()
  })
}

module.exports = {
  createGetAppInfoHandler,
  registerIpcHandlers,
  validateEntryId,
}

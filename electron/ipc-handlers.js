const { IPC_CHANNELS, isTrustedMainFrameEvent } = require('./ipc-contract')
const { confirmAndClearHistory } = require('./history-clear-confirmation')
const { THEMES, isValidHistoryLimit } = require('./preferences-store')
const { MAX_CONTENT_CHARS, MAX_TITLE_CHARS } = require('./snippet-store')
const { PROJECT_DOCUMENTATION_URL } = require('./approved-links')

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
  dialog,
  shell,
  notifySnippetSaved = () => {},
  onHistoryCleared = () => {},
  snippetStore,
  preferencesStore,
  readAppearance = () => ({ theme: 'system', dark: false }),
  onPreferencesUpdated = async () => {},
}) {
  function registerWithEvent(channel, operation) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedMainFrameEvent(event, BrowserWindow, trustedWebContents)) {
        throw new Error('IPC request came from an untrusted renderer.')
      }
      return operation(event, ...args)
    })
  }

  function register(channel, operation) {
    registerWithEvent(channel, (_event, ...args) => operation(...args))
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
    await clipboard.writeText(entry.text)
    return true
  })

  register(IPC_CHANNELS.deleteHistoryEntry, (...args) => {
    assertArgumentCount(args, 1, 'deleteHistoryEntry')
    const [id] = args
    if (!validateEntryId(id)) throw new TypeError('Clipboard entry ID is invalid.')
    return historyStore.delete(id)
  })

  registerWithEvent(IPC_CHANNELS.clearHistory, async (event, ...args) => {
    assertArgumentCount(args, 0, 'clearHistory')
    const result = await confirmAndClearHistory({
      dialog,
      parentWindow: BrowserWindow.fromWebContents(event.sender),
      historyStore,
    })
    if (result.cleared) onHistoryCleared(result)
    return result
  })

  register(IPC_CHANNELS.getSnippets, (...args) => {
    assertArgumentCount(args, 1, 'getSnippets')
    const [query] = args
    if (typeof query !== 'string' || query.length > 256) throw new TypeError('Snippet search query is invalid.')
    return snippetStore.list(query)
  })

  register(IPC_CHANNELS.saveSnippet, async (...args) => {
    assertArgumentCount(args, 1, 'saveSnippet')
    const [snippet] = args
    if (!snippet || typeof snippet !== 'object' || Array.isArray(snippet)) throw new TypeError('Snippet is invalid.')
    const allowedKeys = new Set(['id', 'title', 'content'])
    if (Object.keys(snippet).some((key) => !allowedKeys.has(key))) throw new TypeError('Snippet contains unsupported fields.')
    if (snippet.id !== undefined && !validateEntryId(snippet.id)) throw new TypeError('Snippet ID is invalid.')
    if (
      typeof snippet.title !== 'string' || snippet.title.trim().length === 0 || snippet.title.length > MAX_TITLE_CHARS ||
      typeof snippet.content !== 'string' || snippet.content.trim().length === 0 || snippet.content.length > MAX_CONTENT_CHARS
    ) throw new TypeError('Snippet title or content is invalid.')
    const savedSnippet = await snippetStore.save({ id: snippet.id, title: snippet.title, content: snippet.content })
    notifySnippetSaved()
    return savedSnippet
  })

  register(IPC_CHANNELS.deleteSnippet, (...args) => {
    assertArgumentCount(args, 1, 'deleteSnippet')
    if (!validateEntryId(args[0])) throw new TypeError('Snippet ID is invalid.')
    return snippetStore.delete(args[0])
  })

  register(IPC_CHANNELS.copySnippet, async (...args) => {
    assertArgumentCount(args, 1, 'copySnippet')
    const [id] = args
    if (!validateEntryId(id)) throw new TypeError('Snippet ID is invalid.')
    const snippet = await snippetStore.getById(id)
    if (!snippet) return false
    await clipboard.writeText(snippet.content)
    return true
  })

  register(IPC_CHANNELS.setSnippetPinned, (...args) => {
    assertArgumentCount(args, 2, 'setSnippetPinned')
    if (!validateEntryId(args[0]) || typeof args[1] !== 'boolean') throw new TypeError('Snippet pin request is invalid.')
    return snippetStore.setPinned(args[0], args[1])
  })

  register(IPC_CHANNELS.getPreferences, (...args) => {
    assertArgumentCount(args, 0, 'getPreferences')
    return preferencesStore.get()
  })

  registerWithEvent(IPC_CHANNELS.updatePreferences, async (_event, ...args) => {
    assertArgumentCount(args, 1, 'updatePreferences')
    const [patch] = args
    const allowedKeys = new Set(['theme', 'historyLimit', 'captureOnStartup'])
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
      throw new TypeError('Preferences update is invalid.')
    }
    if (Object.keys(patch).some((key) => !allowedKeys.has(key))) throw new TypeError('Preferences contain unsupported fields.')
    if (patch.theme !== undefined && !THEMES.includes(patch.theme)) throw new TypeError('Theme setting is invalid.')
    if (patch.historyLimit !== undefined && !isValidHistoryLimit(patch.historyLimit)) throw new TypeError('History limit is invalid.')
    if (patch.captureOnStartup !== undefined && typeof patch.captureOnStartup !== 'boolean') {
      throw new TypeError('Capture-on-startup setting is invalid.')
    }
    const preferences = await preferencesStore.update(patch)
    await onPreferencesUpdated(preferences)
    return { preferences, appearance: readAppearance() }
  })

  register(IPC_CHANNELS.getAppearance, (...args) => {
    assertArgumentCount(args, 0, 'getAppearance')
    return readAppearance()
  })

  registerWithEvent(IPC_CHANNELS.closePopup, (event, ...args) => {
    assertArgumentCount(args, 0, 'closePopup')
    BrowserWindow.fromWebContents(event.sender)?.hide()
    return true
  })

  register(IPC_CHANNELS.openProjectDocumentation, async (...args) => {
    assertArgumentCount(args, 0, 'openProjectDocumentation')
    await shell.openExternal(PROJECT_DOCUMENTATION_URL)
    return true
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

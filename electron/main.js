const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  screen,
  dialog,
  Notification,
  shell,
  nativeTheme,
  clipboard,
  ipcMain,
} = require('electron')
const path = require('node:path')
const { IPC_CHANNELS } = require('./ipc-contract')
const { registerIpcHandlers } = require('./ipc-handlers')
const { ClipboardHistoryStore } = require('./clipboard-history-store')
const { ClipboardMonitor } = require('./clipboard-monitor')
const { createMenuBarController } = require('./menu-bar-controller')
const { installAppQuitLifecycle } = require('./app-lifecycle')
const { PreferencesStore } = require('./preferences-store')
const { SnippetStore } = require('./snippet-store')
const { createNativeNotifications } = require('./native-notifications')
const { HISTORY_LIMIT, MAX_CLIPBOARD_TEXT_CHARS, POLL_INTERVAL_MS } = require('./config')

const hasSingleInstanceLock = app.requestSingleInstanceLock()
const isDevelopment = !app.isPackaged
const trustedWebContents = new Set()
let clipboardMonitor
let menuBarController
let preferencesStore

function sendToRenderers(channel, payload) {
  for (const webContents of trustedWebContents) {
    if (!webContents.isDestroyed()) webContents.send(channel, payload)
  }
}

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    menuBarController?.showPopup()
  })

  app.whenReady().then(async () => {
    if (process.platform === 'darwin') app.dock?.hide()

    preferencesStore = new PreferencesStore({
      filePath: path.join(app.getPath('userData'), 'preferences.json'),
      defaults: { theme: 'system', historyLimit: HISTORY_LIMIT, captureOnStartup: true },
    })
    const snippetStore = new SnippetStore({
      filePath: path.join(app.getPath('userData'), 'snippets.json'),
    })
    const preferences = await preferencesStore.load()
    nativeTheme.themeSource = preferences.theme

    const historyStore = new ClipboardHistoryStore({
      filePath: path.join(app.getPath('userData'), 'clipboard-history.json'),
      maxEntries: preferences.historyLimit,
      maxTextChars: MAX_CLIPBOARD_TEXT_CHARS,
    })

    clipboardMonitor = new ClipboardMonitor({
      clipboard,
      historyStore,
      pollIntervalMs: POLL_INTERVAL_MS,
      maxTextChars: MAX_CLIPBOARD_TEXT_CHARS,
      historyLimit: preferences.historyLimit,
      onEntry: (entry) => sendToRenderers(IPC_CHANNELS.clipboardEntry, entry),
      onStatusChange: (status) => {
        sendToRenderers(IPC_CHANNELS.captureStatusChanged, status)
        menuBarController?.rebuildTrayMenu()
      },
    })

    await historyStore.initialize()
    await snippetStore.list()
    if (preferences.captureOnStartup) await clipboardMonitor.start()

    menuBarController = createMenuBarController({
      app,
      BrowserWindow,
      Tray,
      Menu,
      nativeImage,
      globalShortcut,
      screen,
      dialog,
      clipboardMonitor,
      historyStore,
      trustedWebContents,
      isDevelopment,
      platform: process.platform,
      onHistoryCleared: (result) => {
        sendToRenderers(IPC_CHANNELS.historyCleared, { count: result.count })
      },
    })

    const notifications = createNativeNotifications({
      Notification,
      onSnippetSaved: () => menuBarController?.showPopup(),
    })

    registerIpcHandlers({
      ipcMain,
      app,
      BrowserWindow,
      trustedWebContents,
      historyStore,
      clipboardMonitor,
      clipboard,
      dialog,
      shell,
      notifySnippetSaved: notifications.showSnippetSaved,
      snippetStore,
      preferencesStore,
      onHistoryCleared: (result) => {
        sendToRenderers(IPC_CHANNELS.historyCleared, { count: result.count })
      },
      readAppearance: () => ({
        theme: preferencesStore.get().theme,
        dark: nativeTheme.shouldUseDarkColors,
      }),
      onPreferencesUpdated: async (nextPreferences) => {
        if (nextPreferences.historyLimit !== historyStore.maxEntries) {
          await historyStore.setMaxEntries(nextPreferences.historyLimit)
          clipboardMonitor.historyLimit = nextPreferences.historyLimit
          clipboardMonitor.emitStatus()
        }
        nativeTheme.themeSource = nextPreferences.theme
      },
    })

    menuBarController.initialize()
    menuBarController.showPopup()

    nativeTheme.on('updated', () => {
      sendToRenderers(IPC_CHANNELS.appearanceChanged, {
        theme: preferencesStore.get().theme,
        dark: nativeTheme.shouldUseDarkColors,
      })
    })

    app.on('activate', () => menuBarController?.showPopup())
  })
}

installAppQuitLifecycle({
  app,
  globalShortcut,
  getClipboardMonitor: () => clipboardMonitor,
  getMenuBarController: () => menuBarController,
})

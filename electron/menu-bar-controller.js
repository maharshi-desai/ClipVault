const path = require('node:path')
const { IPC_CHANNELS } = require('./ipc-contract')
const { confirmAndClearHistory } = require('./history-clear-confirmation')

const GLOBAL_SHORTCUT = 'CommandOrControl+Shift+V'
const POPUP_WIDTH = 480
const POPUP_HEIGHT = 640

function createMenuBarController({
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
  preloadPath = path.join(__dirname, 'preload.js'),
  rendererPath = path.join(__dirname, '..', 'dist', 'index.html'),
  devServerUrl = 'http://127.0.0.1:5173',
  iconPath = path.join(__dirname, 'assets', 'clipvault-template.png'),
  platform = process.platform,
  onHistoryCleared = () => {},
}) {
  let popupWindow = null
  let tray = null
  let shortcutRegistered = false
  let quitting = false

  function positionPopup() {
    if (!popupWindow || popupWindow.isDestroyed() || !tray) return
    const trayBounds = tray.getBounds()
    const point = {
      x: trayBounds.x + Math.round(trayBounds.width / 2),
      y: trayBounds.y + Math.round(trayBounds.height / 2),
    }
    const { workArea } = screen.getDisplayNearestPoint(point)
    const x = Math.max(
      workArea.x,
      Math.min(point.x - Math.round(POPUP_WIDTH / 2), workArea.x + workArea.width - POPUP_WIDTH),
    )
    const belowTray = trayBounds.y + trayBounds.height + 4
    const maxY = workArea.y + workArea.height - POPUP_HEIGHT
    const y = Math.max(workArea.y, Math.min(belowTray, maxY))
    popupWindow.setPosition(x, y, false)
  }

  function createPopupWindow() {
    if (popupWindow && !popupWindow.isDestroyed()) return popupWindow

    popupWindow = new BrowserWindow({
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      minWidth: 420,
      minHeight: 520,
      maxWidth: POPUP_WIDTH,
      maxHeight: POPUP_HEIGHT,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      frame: false,
      title: 'ClipVault',
      backgroundColor: '#f8fafc',
      skipTaskbar: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        // The preload imports the small, audited local renderer-api module.
        // Electron's sandboxed preload cannot load local CommonJS modules.
        sandbox: false,
      },
    })

    const contents = popupWindow.webContents
    trustedWebContents.add(contents)
    popupWindow.on('closed', () => {
      trustedWebContents.delete(contents)
      popupWindow = null
    })
    popupWindow.on('close', (event) => {
      if (quitting) return
      event.preventDefault()
      popupWindow.hide()
    })
    popupWindow.on('focus', () => {
      contents.send(IPC_CHANNELS.windowStateChanged, { state: 'focused' })
    })
    popupWindow.on('blur', () => {
      contents.send(IPC_CHANNELS.windowStateChanged, { state: 'blurred' })
      popupWindow?.hide()
    })
    if (isDevelopment) popupWindow.loadURL(devServerUrl)
    else popupWindow.loadFile(rendererPath)
    return popupWindow
  }

  function showPopup() {
    if (quitting) return
    const window = createPopupWindow()
    positionPopup()
    if (!window.isVisible()) window.show()
    window.focus()
  }

  function hidePopup() {
    if (popupWindow && !popupWindow.isDestroyed()) popupWindow.hide()
  }

  function togglePopup() {
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) hidePopup()
    else showPopup()
  }

  async function pauseOrResumeCapture() {
    const status = clipboardMonitor.getStatus()
    if (status.enabled) await clipboardMonitor.pause()
    else await clipboardMonitor.resume()
    rebuildTrayMenu()
  }

  async function clearHistoryFromTray() {
    showPopup()
    const result = await confirmAndClearHistory({
      dialog,
      parentWindow: popupWindow,
      historyStore,
    })
    if (result.cleared) onHistoryCleared(result)
    rebuildTrayMenu()
  }

  function buildTrayMenu() {
    const captureEnabled = clipboardMonitor.getStatus().enabled
    const showLabel = shortcutRegistered
      ? `Show ClipVault (${platform === 'darwin' ? '⌘⇧V' : 'Ctrl+Shift+V'})`
      : 'Show ClipVault (keyboard shortcut unavailable)'
    return Menu.buildFromTemplate([
      { label: showLabel, click: showPopup },
      { label: captureEnabled ? 'Pause Capture' : 'Resume Capture', click: pauseOrResumeCapture },
      { type: 'separator' },
      { label: 'Clear History…', click: clearHistoryFromTray },
      { type: 'separator' },
      { label: 'Quit ClipVault', click: () => app.quit() },
    ])
  }

  function rebuildTrayMenu() {
    if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu())
  }

  function createTray() {
    const image = nativeImage.createFromPath(iconPath)
    if (platform === 'darwin' && typeof image.setTemplateImage === 'function') {
      image.setTemplateImage(true)
    }
    tray = new Tray(image)
    tray.setToolTip(shortcutRegistered
      ? 'ClipVault — ⌘⇧V to toggle'
      : 'ClipVault — keyboard shortcut unavailable')
    tray.on('click', togglePopup)
    tray.on('right-click', () => tray.popUpContextMenu())
    rebuildTrayMenu()
  }

  function initialize() {
    if (tray && !tray.isDestroyed()) return popupWindow
    createPopupWindow()
    createTray()
    try {
      shortcutRegistered = globalShortcut.register(GLOBAL_SHORTCUT, togglePopup)
    } catch {
      shortcutRegistered = false
    }
    tray.setToolTip(shortcutRegistered
      ? `ClipVault — ${platform === 'darwin' ? '⌘⇧V' : 'Ctrl+Shift+V'} to toggle`
      : 'ClipVault — keyboard shortcut unavailable')
    rebuildTrayMenu()
    return popupWindow
  }

  function dispose() {
    quitting = true
    if (shortcutRegistered) globalShortcut.unregister(GLOBAL_SHORTCUT)
    shortcutRegistered = false
    if (tray && !tray.isDestroyed()) tray.destroy()
    tray = null
  }

  function allowWindowCloseForQuit() {
    quitting = true
  }

  return {
    initialize,
    showPopup,
    hidePopup,
    togglePopup,
    rebuildTrayMenu,
    dispose,
    allowWindowCloseForQuit,
    getPopupWindow: () => popupWindow,
    getTray: () => tray,
    isShortcutRegistered: () => shortcutRegistered,
  }
}

module.exports = {
  GLOBAL_SHORTCUT,
  POPUP_HEIGHT,
  POPUP_WIDTH,
  createMenuBarController,
}

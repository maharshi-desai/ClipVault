const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createMenuBarController, GLOBAL_SHORTCUT } = require('../electron/menu-bar-controller')

function createHarness({ shortcutResult = true, shortcutThrows = false, dialogResponse = 1, isDevelopment = true } = {}) {
  const windows = []
  const shortcutCalls = []
  const app = { quitCalls: 0, quit() { this.quitCalls += 1 } }
  const trustedWebContents = new Set()
  const capture = {
    enabled: true,
    getStatus() { return { enabled: this.enabled } },
    async pause() { this.enabled = false },
    async resume() { this.enabled = true },
  }
  const historyStore = {
    clearCalls: 0,
    async clear() { this.clearCalls += 1; return 3 },
  }
  const dialog = {
    async showMessageBox(...args) {
      this.lastArgs = args
      return { response: dialogResponse }
    },
  }
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super()
      this.options = options
      this.webContents = new EventEmitter()
      this.webContents.send = () => {}
      this.webContents.isDestroyed = () => false
      this.webContents.setWindowOpenHandler = (handler) => { this.webContents.windowOpenHandler = handler }
      this.position = null
      this.visible = false
      this.focusCalls = 0
      windows.push(this)
    }
    isDestroyed() { return false }
    isVisible() { return this.visible }
    setPosition(x, y) { this.position = [x, y] }
    show() { this.visible = true }
    hide() { this.visible = false }
    focus() { this.focusCalls += 1 }
    loadURL(url) { this.loaded = url }
    loadFile(file) { this.loaded = file }
  }
  class Tray extends EventEmitter {
    constructor(image) { super(); this.image = image; this.destroyed = false }
    getBounds() { return { x: 1200, y: 20, width: 22, height: 22 } }
    setToolTip(value) { this.tooltip = value }
    setContextMenu(menu) { this.menu = menu }
    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
    popUpContextMenu() { this.contextMenuCalls = (this.contextMenuCalls ?? 0) + 1 }
  }
  const Menu = { buildFromTemplate: (items) => ({ items }) }
  const image = { template: false, setTemplateImage(value) { this.template = value } }
  const nativeImage = { createFromPath: (file) => { image.file = file; return image } }
  const globalShortcut = {
    register(accelerator, callback) {
      shortcutCalls.push(['register', accelerator])
      this.callback = callback
      if (shortcutThrows) throw new Error('registration failed')
      return shortcutResult
    },
    unregister(accelerator) { shortcutCalls.push(['unregister', accelerator]) },
  }
  const events = []
  const controller = createMenuBarController({
    app,
    BrowserWindow,
    Tray,
    Menu,
    nativeImage,
    globalShortcut,
    screen: { getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 25, width: 1440, height: 875 } }) },
    dialog,
    clipboardMonitor: capture,
    historyStore,
    trustedWebContents,
    isDevelopment,
    devServerUrl: 'http://127.0.0.1:5173',
    platform: 'darwin',
    onHistoryCleared: (result) => events.push(result),
  })
  return { app, capture, controller, dialog, events, globalShortcut, historyStore, image, shortcutCalls, trustedWebContents, windows }
}

test('tray popup is a singleton, focuses and repositions, and close hides it', () => {
  const h = createHarness()
  h.controller.initialize()
  const window = h.controller.getPopupWindow()

  assert.equal(h.windows.length, 1)
  assert.deepEqual(window.options.webPreferences, {
    preload: require('node:path').join(__dirname, '..', 'electron', 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  })
  assert.equal(h.image.template, true)
  assert.equal(h.image.file.endsWith('clipvault-template.png'), true)

  h.controller.showPopup()
  h.controller.showPopup()
  assert.equal(h.windows.length, 1)
  assert.deepEqual(window.position, [960, 46])
  assert.equal(window.visible, true)
  assert.equal(window.focusCalls, 2)
  window.emit('blur')
  assert.equal(window.visible, false)
  h.controller.showPopup()

  let prevented = false
  window.emit('close', { preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(window.visible, false)
  h.controller.dispose()
})

test('repeated controller initialization does not create duplicate windows, trays, or shortcuts', () => {
  const h = createHarness()
  const initialWindow = h.controller.initialize()
  const initialTray = h.controller.getTray()

  assert.equal(h.controller.initialize(), initialWindow)
  assert.equal(h.controller.getTray(), initialTray)
  assert.equal(h.windows.length, 1)
  assert.equal(h.shortcutCalls.filter(([action]) => action === 'register').length, 1)
  h.controller.dispose()
})

test('tray and global shortcut toggle popup; capture menu action pauses and resumes', async () => {
  const h = createHarness()
  h.controller.initialize()
  const tray = h.controller.getTray()
  const window = h.controller.getPopupWindow()
  const clickMenuItem = (label) => tray.menu.items.find((item) => item.label === label).click()

  assert.equal(h.controller.isShortcutRegistered(), true)
  assert.equal(h.globalShortcut.callback instanceof Function, true)
  assert.equal(h.globalShortcut.callback === undefined, false)
  assert.equal(h.shortcutCalls[0][1], GLOBAL_SHORTCUT)
  assert.equal(tray.tooltip, 'ClipVault — ⌘⇧V to toggle')
  assert.equal(window.visible, false)

  tray.emit('click')
  assert.equal(window.visible, true)
  h.globalShortcut.callback()
  assert.equal(window.visible, false)
  await clickMenuItem('Pause Capture')
  assert.equal(h.capture.enabled, false)
  assert.equal(tray.menu.items.some((item) => item.label === 'Resume Capture'), true)
  await clickMenuItem('Resume Capture')
  assert.equal(h.capture.enabled, true)

  clickMenuItem('Quit ClipVault')
  assert.equal(h.app.quitCalls, 1)
  h.controller.dispose()
  assert.deepEqual(h.shortcutCalls.at(-1), ['unregister', GLOBAL_SHORTCUT])
  assert.equal(tray.destroyed, true)
})

test('shortcut registration false or throwing is handled and surfaced in tray', () => {
  for (const options of [{ shortcutResult: false }, { shortcutThrows: true }]) {
    const h = createHarness(options)
    assert.doesNotThrow(() => h.controller.initialize())
    assert.equal(h.controller.isShortcutRegistered(), false)
    assert.equal(h.controller.getTray().tooltip, 'ClipVault — keyboard shortcut unavailable')
    assert.equal(h.controller.getTray().menu.items[0].label, 'Show ClipVault (keyboard shortcut unavailable)')
    h.controller.dispose()
  }
})

test('popup blocks new windows and navigation outside the app origin', () => {
  const h = createHarness()
  h.controller.initialize()
  const contents = h.controller.getPopupWindow().webContents
  assert.deepEqual(contents.windowOpenHandler({ url: 'https://untrusted.example' }), { action: 'deny' })

  let externalNavigationPrevented = false
  contents.emit('will-navigate', { preventDefault() { externalNavigationPrevented = true } }, 'https://untrusted.example')
  assert.equal(externalNavigationPrevented, true)

  let appNavigationPrevented = false
  contents.emit('will-navigate', { preventDefault() { appNavigationPrevented = true } }, 'http://127.0.0.1:5173/')
  assert.equal(appNavigationPrevented, false)
  h.controller.dispose()
})

test('packaged popup allows only its configured renderer file', () => {
  const h = createHarness({ isDevelopment: false })
  h.controller.initialize()
  const contents = h.controller.getPopupWindow().webContents
  const allowedUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href
  let prevented = false
  contents.emit('will-navigate', { preventDefault() { prevented = true } }, allowedUrl)
  assert.equal(prevented, false)

  contents.emit('will-navigate', { preventDefault() { prevented = true } }, 'https://untrusted.example')
  assert.equal(prevented, true)
  h.controller.dispose()
})

test('tray clear action asks for native confirmation and reports completed clears', async () => {
  const h = createHarness()
  h.controller.initialize()
  const tray = h.controller.getTray()
  await tray.menu.items.find((item) => item.label === 'Clear History…').click()

  assert.equal(h.dialog.lastArgs.length, 2)
  assert.deepEqual(h.dialog.lastArgs[1].buttons, ['Cancel', 'Clear History'])
  assert.equal(h.historyStore.clearCalls, 1)
  assert.deepEqual(h.events, [{ cleared: true, count: 3 }])
  assert.equal(h.controller.getPopupWindow().visible, true)
  h.controller.dispose()

  const cancelled = createHarness({ dialogResponse: 0 })
  cancelled.controller.initialize()
  await cancelled.controller.getTray().menu.items.find((item) => item.label === 'Clear History…').click()
  assert.equal(cancelled.historyStore.clearCalls, 0)
  assert.deepEqual(cancelled.events, [])
  cancelled.controller.dispose()
})

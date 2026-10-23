const { app, BrowserWindow, clipboard, ipcMain } = require('electron')
const path = require('node:path')
const { IPC_CHANNELS } = require('./ipc-contract')
const { registerIpcHandlers } = require('./ipc-handlers')
const { ClipboardHistoryStore } = require('./clipboard-history-store')
const { ClipboardMonitor } = require('./clipboard-monitor')
const { HISTORY_LIMIT, MAX_CLIPBOARD_TEXT_CHARS, POLL_INTERVAL_MS } = require('./config')

const isDevelopment = !app.isPackaged
const trustedWebContents = new Set()
let clipboardMonitor
let isQuitting = false

function sendToRenderers(channel, payload) {
  for (const webContents of trustedWebContents) {
    if (!webContents.isDestroyed()) webContents.send(channel, payload)
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: 'ClipVault',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const windowContents = window.webContents
  trustedWebContents.add(windowContents)
  window.on('closed', () => trustedWebContents.delete(windowContents))

  if (isDevelopment) {
    window.loadURL('http://127.0.0.1:5173')
    window.webContents.openDevTools({ mode: 'detach' })
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  window.on('focus', () => {
    window.webContents.send(IPC_CHANNELS.windowStateChanged, { state: 'focused' })
  })
  window.on('blur', () => {
    window.webContents.send(IPC_CHANNELS.windowStateChanged, { state: 'blurred' })
  })
}

app.whenReady().then(async () => {
  const historyStore = new ClipboardHistoryStore({
    filePath: path.join(app.getPath('userData'), 'clipboard-history.json'),
    maxEntries: HISTORY_LIMIT,
    maxTextChars: MAX_CLIPBOARD_TEXT_CHARS,
  })

  clipboardMonitor = new ClipboardMonitor({
    clipboard,
    historyStore,
    pollIntervalMs: POLL_INTERVAL_MS,
    maxTextChars: MAX_CLIPBOARD_TEXT_CHARS,
    historyLimit: HISTORY_LIMIT,
    onEntry: (entry) => sendToRenderers(IPC_CHANNELS.clipboardEntry, entry),
    onStatusChange: (status) => sendToRenderers(IPC_CHANNELS.captureStatusChanged, status),
  })

  registerIpcHandlers({
    ipcMain,
    app,
    BrowserWindow,
    trustedWebContents,
    historyStore,
    clipboardMonitor,
    clipboard,
  })

  await historyStore.initialize()
  await clipboardMonitor.start()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  isQuitting = true
  Promise.resolve(clipboardMonitor?.stop()).finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

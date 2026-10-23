const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { IPC_CHANNELS } = require('./ipc-contract')
const { createGetAppInfoHandler } = require('./ipc-handlers')

const isDevelopment = !app.isPackaged
const trustedWebContents = new Set()

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

app.whenReady().then(() => {
  ipcMain.handle(
    IPC_CHANNELS.getAppInfo,
    createGetAppInfoHandler({ app, BrowserWindow, platform: process.platform, trustedWebContents }),
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

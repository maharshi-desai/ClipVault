function installAppQuitLifecycle({
  app,
  globalShortcut,
  getClipboardMonitor,
  getMenuBarController,
}) {
  let isQuitting = false

  app.on('before-quit', (event) => {
    if (isQuitting) return
    event.preventDefault()
    isQuitting = true
    const menuBarController = getMenuBarController()
    menuBarController?.allowWindowCloseForQuit()
    menuBarController?.dispose()
    Promise.resolve(getClipboardMonitor()?.stop()).finally(() => app.quit())
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())

  return { isQuitting: () => isQuitting }
}

module.exports = { installAppQuitLifecycle }

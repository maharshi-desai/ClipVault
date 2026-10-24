const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { installAppQuitLifecycle } = require('../electron/app-lifecycle')

test('quit hides the tray, stops capture, then permits the second quit and unregisters shortcuts', async () => {
  const app = new EventEmitter()
  app.quitCalls = 0
  app.quit = () => { app.quitCalls += 1 }
  const calls = []
  const globalShortcut = { unregisterAll: () => calls.push('unregister-all') }
  const lifecycle = installAppQuitLifecycle({
    app,
    globalShortcut,
    getClipboardMonitor: () => ({ async stop() { calls.push('stop-capture') } }),
    getMenuBarController: () => ({
      allowWindowCloseForQuit() { calls.push('allow-window-close') },
      dispose() { calls.push('dispose-tray-and-shortcut') },
    }),
  })
  let prevented = false
  app.emit('before-quit', { preventDefault() { prevented = true } })

  assert.equal(prevented, true)
  assert.equal(lifecycle.isQuitting(), true)
  assert.deepEqual(calls.slice(0, 3), [
    'allow-window-close',
    'dispose-tray-and-shortcut',
    'stop-capture',
  ])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(app.quitCalls, 1)

  let secondQuitPrevented = false
  app.emit('before-quit', { preventDefault() { secondQuitPrevented = true } })
  assert.equal(secondQuitPrevented, false)
  app.emit('will-quit')
  assert.equal(calls.at(-1), 'unregister-all')
})

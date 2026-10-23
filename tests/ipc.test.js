const test = require('node:test')
const assert = require('node:assert/strict')
const { IPC_CHANNELS, isWindowStatePayload } = require('../electron/ipc-contract')
const { createGetAppInfoHandler } = require('../electron/ipc-handlers')
const { createRendererApi } = require('../electron/renderer-api')

function createTrustedEvent() {
  const mainFrame = { name: 'main-frame' }
  const sender = { mainFrame }
  const window = { isDestroyed: () => false }
  const BrowserWindow = {
    fromWebContents: (webContents) => webContents === sender ? window : null,
  }

  return { event: { sender, senderFrame: mainFrame }, BrowserWindow, trustedWebContents: new Set([sender]) }
}

test('app info handler returns only the requested application details', () => {
  const { event, BrowserWindow, trustedWebContents } = createTrustedEvent()
  const handler = createGetAppInfoHandler({
    app: { getName: () => 'ClipVault', getVersion: () => '1.0.0' },
    BrowserWindow,
    platform: 'darwin',
    trustedWebContents,
  })

  assert.deepEqual(handler(event), {
    name: 'ClipVault',
    version: '1.0.0',
    platform: 'darwin',
  })
})

test('app info handler rejects unexpected arguments', () => {
  const { event, BrowserWindow, trustedWebContents } = createTrustedEvent()
  const handler = createGetAppInfoHandler({
    app: { getName: () => 'ClipVault', getVersion: () => '1.0.0' },
    BrowserWindow,
    platform: 'darwin',
    trustedWebContents,
  })

  assert.throws(() => handler(event, 'unexpected'), /does not accept arguments/)
})

test('app info handler rejects unknown windows and subframes', () => {
  const { event, BrowserWindow, trustedWebContents } = createTrustedEvent()
  const handler = createGetAppInfoHandler({
    app: { getName: () => 'ClipVault', getVersion: () => '1.0.0' },
    BrowserWindow,
    platform: 'darwin',
    trustedWebContents,
  })

  assert.throws(() => handler({ ...event, sender: {} }), /untrusted renderer/)
  assert.throws(() => handler({ ...event, senderFrame: {} }), /untrusted renderer/)
})

test('app info handler rejects a BrowserWindow not registered by the application', () => {
  const { event, BrowserWindow } = createTrustedEvent()
  const handler = createGetAppInfoHandler({
    app: { getName: () => 'ClipVault', getVersion: () => '1.0.0' },
    BrowserWindow,
    platform: 'darwin',
    trustedWebContents: new Set(),
  })

  assert.throws(() => handler(event), /untrusted renderer/)
})

test('renderer API invokes only the app info channel with no arguments', async () => {
  const calls = []
  const api = createRendererApi({
    invoke: (...args) => {
      calls.push(args)
      return Promise.resolve({ name: 'ClipVault' })
    },
    on() {},
    removeListener() {},
  })

  assert.deepEqual(await api.getAppInfo(), { name: 'ClipVault' })
  assert.deepEqual(calls, [[IPC_CHANNELS.getAppInfo]])
  assert.deepEqual(Object.keys(api).sort(), ['getAppInfo', 'onWindowStateChanged'])
})

test('window event subscription filters payloads and unsubscribes idempotently', () => {
  const listeners = new Map()
  const removed = []
  const api = createRendererApi({
    invoke() {},
    on(channel, listener) { listeners.set(channel, listener) },
    removeListener(channel, listener) {
      removed.push([channel, listener])
      listeners.delete(channel)
    },
  })
  const states = []
  const unsubscribe = api.onWindowStateChanged((state) => states.push(state))
  const listener = listeners.get(IPC_CHANNELS.windowStateChanged)

  listener({ secret: 'event objects are not forwarded' }, { state: 'focused' })
  listener({}, { state: 'invalid' })
  assert.deepEqual(states, ['focused'])

  unsubscribe()
  unsubscribe()
  listener({}, { state: 'blurred' })

  assert.deepEqual(states, ['focused'])
  assert.equal(removed.length, 1)
  assert.equal(removed[0][0], IPC_CHANNELS.windowStateChanged)
  assert.equal(removed[0][1], listener)
})

test('window event subscription requires a callback and accepts only known states', () => {
  const api = createRendererApi({ invoke() {}, on() {}, removeListener() {} })

  assert.throws(() => api.onWindowStateChanged('not a function'), /callback function/)
  assert.equal(isWindowStatePayload({ state: 'focused' }), true)
  assert.equal(isWindowStatePayload({ state: 'blurred' }), true)
  assert.equal(isWindowStatePayload({ state: 'other' }), false)
  assert.equal(isWindowStatePayload(null), false)
})

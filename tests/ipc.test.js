const test = require('node:test')
const assert = require('node:assert/strict')
const {
  IPC_CHANNELS,
  isCaptureStatusPayload,
  isClipboardEntryPayload,
  isWindowStatePayload,
} = require('../electron/ipc-contract')
const { createGetAppInfoHandler, registerIpcHandlers } = require('../electron/ipc-handlers')
const { createRendererApi } = require('../electron/renderer-api')
const { randomUUID } = require('node:crypto')

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
  assert.deepEqual(Object.keys(api).sort(), [
    'clearHistory', 'copyHistoryEntry', 'deleteHistoryEntry', 'getAppInfo', 'getCaptureStatus',
    'getHistory', 'onCaptureStatusChanged', 'onClipboardEntry', 'onWindowStateChanged',
    'pauseCapture', 'resumeCapture', 'searchHistory',
  ])
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

test('main IPC handlers validate queries, IDs, sender frames and argument counts', async () => {
  const { event, BrowserWindow, trustedWebContents } = createTrustedEvent()
  const handlers = new Map()
  const copied = []
  registerIpcHandlers({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    app: { getName: () => 'ClipVault', getVersion: () => '1.0.0' },
    BrowserWindow,
    trustedWebContents,
    historyStore: {
      getHistory: async () => [],
      search: async (query) => [{ query }],
      getById: async (id) => ({ id, text: 'saved text' }),
      delete: async () => true,
      clear: async () => 1,
    },
    clipboardMonitor: {
      pause: async () => ({ enabled: false }),
      resume: async () => ({ enabled: true }),
      getStatus: () => ({ enabled: true }),
    },
    clipboard: { writeText: (text) => copied.push(text) },
  })

  assert.deepEqual(await handlers.get(IPC_CHANNELS.getHistory)(event), [])
  assert.deepEqual(await handlers.get(IPC_CHANNELS.searchHistory)(event, 'clip'), [{ query: 'clip' }])
  await assert.rejects(async () => handlers.get(IPC_CHANNELS.searchHistory)(event, {}), /Search query/)
  await assert.rejects(async () => handlers.get(IPC_CHANNELS.searchHistory)(event, 'x'.repeat(257)), /Search query/)
  await assert.rejects(async () => handlers.get(IPC_CHANNELS.getHistory)(event, 'extra'), /invalid number/)
  await assert.rejects(async () => handlers.get(IPC_CHANNELS.copyHistoryEntry)(event, 'bad-id'), /ID is invalid/)
  assert.equal(await handlers.get(IPC_CHANNELS.copyHistoryEntry)(event, randomUUID()), true)
  assert.deepEqual(copied, ['saved text'])
  assert.deepEqual(await handlers.get(IPC_CHANNELS.pauseCapture)(event), { enabled: false })
  assert.deepEqual(await handlers.get(IPC_CHANNELS.resumeCapture)(event), { enabled: true })
  assert.deepEqual(handlers.get(IPC_CHANNELS.getCaptureStatus)(event), { enabled: true })
  assert.equal(await handlers.get(IPC_CHANNELS.clearHistory)(event), 1)
  await assert.rejects(async () => handlers.get(IPC_CHANNELS.getHistory)({ sender: {}, senderFrame: {} }), /untrusted renderer/)
})

test('renderer API exposes named history and capture operations on fixed channels', async () => {
  const calls = []
  const api = createRendererApi({
    invoke: (...args) => {
      calls.push(args)
      return Promise.resolve(true)
    },
    on() {},
    removeListener() {},
  })

  await api.searchHistory('clip')
  await api.copyHistoryEntry('entry-id')
  await api.deleteHistoryEntry('entry-id')
  await api.pauseCapture()
  await api.resumeCapture()
  await api.getCaptureStatus()
  await api.clearHistory()
  assert.deepEqual(calls, [
    [IPC_CHANNELS.searchHistory, 'clip'],
    [IPC_CHANNELS.copyHistoryEntry, 'entry-id'],
    [IPC_CHANNELS.deleteHistoryEntry, 'entry-id'],
    [IPC_CHANNELS.pauseCapture],
    [IPC_CHANNELS.resumeCapture],
    [IPC_CHANNELS.getCaptureStatus],
    [IPC_CHANNELS.clearHistory],
  ])
})

test('clipboard and capture-status event subscriptions filter and sanitize payloads', () => {
  const listeners = new Map()
  const api = createRendererApi({
    invoke() {},
    on(channel, listener) { listeners.set(channel, listener) },
    removeListener(channel) { listeners.delete(channel) },
  })
  const entries = []
  const statuses = []
  api.onClipboardEntry((entry) => entries.push(entry))
  api.onCaptureStatusChanged((status) => statuses.push(status))
  const entryListener = listeners.get(IPC_CHANNELS.clipboardEntry)
  const statusListener = listeners.get(IPC_CHANNELS.captureStatusChanged)
  const entry = { id: 'id1', text: 'private text', timestamp: '2026-10-23T00:00:00.000Z', secret: 'strip' }
  const status = { enabled: false, pollIntervalMs: 1000, historyLimit: 500, maxClipboardTextChars: 25000, storageAvailable: true, secret: 'strip' }

  entryListener({ secret: 'event hidden' }, entry)
  entryListener({}, { ...entry, text: '' })
  statusListener({ secret: 'event hidden' }, status)
  statusListener({}, { ...status, enabled: 'yes' })
  assert.deepEqual(entries, [{ id: 'id1', text: 'private text', timestamp: entry.timestamp }])
  assert.deepEqual(statuses, [{
    enabled: false,
    pollIntervalMs: 1000,
    historyLimit: 500,
    maxClipboardTextChars: 25000,
    storageAvailable: true,
  }])
  assert.equal(isClipboardEntryPayload(entry), true)
  assert.equal(isCaptureStatusPayload(status), true)
})

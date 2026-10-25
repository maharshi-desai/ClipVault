const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { IPC_CHANNELS } = require('../electron/ipc-contract')
const { registerIpcHandlers } = require('../electron/ipc-handlers')
const { PROJECT_DOCUMENTATION_URL } = require('../electron/approved-links')

function setupHandlers({ preferences = { theme: 'system', historyLimit: 500, captureOnStartup: true }, writeClipboardText } = {}) {
  let currentPreferences = preferences
  const frame = {}
  const sender = { mainFrame: frame }
  const window = { isDestroyed: () => false, hideCalls: 0, hide() { this.hideCalls += 1 } }
  const BrowserWindow = { fromWebContents: (contents) => contents === sender ? window : null }
  const event = { sender, senderFrame: frame }
  const handlers = new Map()
  const copiedText = []
  const calls = []
  registerIpcHandlers({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    app: { getName: () => 'ClipVault', getVersion: () => '1.0.0' },
    BrowserWindow,
    trustedWebContents: new Set([sender]),
    historyStore: { getHistory: async () => [], search: async () => [], getById: async () => null, delete: async () => false, clear: async () => 0 },
    clipboardMonitor: { getStatus: () => ({ enabled: true }), pause: async () => ({}), resume: async () => ({}) },
    clipboard: { writeText: writeClipboardText || ((text) => copiedText.push(text)) },
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    shell: { openExternal: async (url) => { calls.push(['openExternal', url]) } },
    notifySnippetSaved: () => calls.push(['snippet-notification']),
    snippetStore: {
      list: async (query) => { calls.push(['list', query]); return [] },
      save: async (snippet) => { calls.push(['save', snippet]); return snippet },
      getById: async (id) => ({ id, content: 'saved snippet text' }),
      setPinned: async (id, pinned) => ({ id, pinned }),
      delete: async (id) => id === 'known',
    },
    preferencesStore: {
      get: () => currentPreferences,
      update: async (patch) => { currentPreferences = { ...currentPreferences, ...patch }; return currentPreferences },
    },
    readAppearance: () => ({ theme: currentPreferences.theme, dark: currentPreferences.theme === 'dark' }),
    onPreferencesUpdated: async (next) => calls.push(['preferences', next]),
  })
  return { BrowserWindow, calls, copiedText, event, handlers, window }
}

test('snippet and preference IPC operations validate arguments and use fixed handlers', async () => {
  const h = setupHandlers()
  const id = randomUUID()
  assert.deepEqual(await h.handlers.get(IPC_CHANNELS.getSnippets)(h.event, 'greeting'), [])
  await assert.rejects(async () => h.handlers.get(IPC_CHANNELS.getSnippets)(h.event, 'x'.repeat(257)), /query/i)
  assert.deepEqual(await h.handlers.get(IPC_CHANNELS.saveSnippet)(h.event, { title: 'Greeting', content: 'Hello' }), {
    id: undefined, title: 'Greeting', content: 'Hello',
  })
  assert.equal(h.calls.some(([kind]) => kind === 'snippet-notification'), true)
  await assert.rejects(async () => h.handlers.get(IPC_CHANNELS.saveSnippet)(h.event, { title: 'x', content: 'y', pinned: true }), /unsupported/i)
  await assert.rejects(async () => h.handlers.get(IPC_CHANNELS.saveSnippet)(h.event, { id: 'bad', title: 'x', content: 'y' }), /ID/i)
  assert.equal(await h.handlers.get(IPC_CHANNELS.copySnippet)(h.event, id), true)
  assert.deepEqual(h.copiedText, ['saved snippet text'])
  assert.deepEqual(await h.handlers.get(IPC_CHANNELS.setSnippetPinned)(h.event, id, true), { id, pinned: true })
  await assert.rejects(async () => h.handlers.get(IPC_CHANNELS.setSnippetPinned)(h.event, id, 'yes'), /pin/i)
  assert.deepEqual(await h.handlers.get(IPC_CHANNELS.updatePreferences)(h.event, { theme: 'dark', historyLimit: 250 }), {
    preferences: { theme: 'dark', historyLimit: 250, captureOnStartup: true },
    appearance: { theme: 'dark', dark: true },
  })
  await assert.rejects(h.handlers.get(IPC_CHANNELS.updatePreferences)(h.event, { theme: 'solarized' }), /Theme/i)
  assert.equal(h.calls.some(([kind]) => kind === 'preferences'), true)
})

test('snippet copy IPC waits for Electron asynchronous clipboard writes', async () => {
  let finishWrite
  let writeFinished = false
  let copiedValue
  const h = setupHandlers({
    writeClipboardText: (text) => new Promise((resolve) => {
      copiedValue = text
      finishWrite = () => { writeFinished = true; resolve() }
    }),
  })
  const copyPromise = h.handlers.get(IPC_CHANNELS.copySnippet)(h.event, randomUUID())
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(writeFinished, false)
  assert.equal(copiedValue, 'saved snippet text')
  finishWrite()
  assert.equal(await copyPromise, true)
  assert.equal(writeFinished, true)
})

test('close-popup request hides only the trusted renderer window', async () => {
  const h = setupHandlers()
  assert.equal(await h.handlers.get(IPC_CHANNELS.closePopup)(h.event), true)
  assert.equal(h.window.hideCalls, 1)
  await assert.rejects(async () => h.handlers.get(IPC_CHANNELS.closePopup)({ sender: {}, senderFrame: {} }), /untrusted renderer/)
})

test('project documentation IPC opens only the fixed approved URL', async () => {
  const h = setupHandlers()
  assert.equal(await h.handlers.get(IPC_CHANNELS.openProjectDocumentation)(h.event), true)
  assert.deepEqual(h.calls.find(([kind]) => kind === 'openExternal'), ['openExternal', PROJECT_DOCUMENTATION_URL])
  await assert.rejects(async () => h.handlers.get(IPC_CHANNELS.openProjectDocumentation)(h.event, 'https://attacker.invalid'), /arguments/i)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { ClipboardHistoryStore } = require('../electron/clipboard-history-store')

async function makeStore(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'clipvault-history-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))

  let nextId = 0
  const store = new ClipboardHistoryStore({
    filePath: path.join(directory, 'clipboard-history.json'),
    createId: () => `entry-${++nextId}`,
    now: () => '2026-10-23T00:00:00.000Z',
    ...options,
  })
  return { store, filePath: path.join(directory, 'clipboard-history.json') }
}

test('history is saved locally and retrieved newest first', async (t) => {
  const { store, filePath } = await makeStore(t)
  await store.initialize()
  const older = await store.addText('older', '2026-10-22T00:00:00.000Z')
  const newer = await store.addText('newer', '2026-10-23T00:00:00.000Z')

  assert.deepEqual((await store.getHistory()).map((entry) => entry.id), [newer.id, older.id])
  assert.equal(JSON.parse(await fs.readFile(filePath, 'utf8')).version, 1)
  assert.equal(store.getStorageStatus(), true)
})

test('search is case-insensitive and matches clipboard text', async (t) => {
  const { store } = await makeStore(t)
  await store.addText('Meeting Notes: Monday')
  await store.addText('shopping list')

  assert.deepEqual((await store.search('mEeTiNg')).map((entry) => entry.text), ['Meeting Notes: Monday'])
  assert.equal((await store.search('')).length, 2)
})

test('exact duplicate text is ignored without creating a second entry', async (t) => {
  const { store } = await makeStore(t)
  const original = await store.addText('same text')

  assert.equal(await store.addText('same text'), null)
  assert.deepEqual(await store.getHistory(), [original])
})

test('delete removes one entry and clear empties persisted history', async (t) => {
  const { store } = await makeStore(t)
  const keep = await store.addText('keep')
  const remove = await store.addText('remove')

  assert.equal(await store.delete(remove.id), true)
  assert.equal(await store.delete(remove.id), false)
  assert.deepEqual(await store.getHistory(), [keep])
  assert.equal(await store.clear(), 1)
  assert.deepEqual(await store.getHistory(), [])
})

test('history limit retains only the newest entries', async (t) => {
  const { store } = await makeStore(t, { maxEntries: 2 })
  await store.addText('one')
  await store.addText('two')
  await store.addText('three')

  assert.deepEqual((await store.getHistory()).map((entry) => entry.text), ['three', 'two'])
})

test('loaded entries are sanitized to the documented fields', async (t) => {
  const { store, filePath } = await makeStore(t)
  await fs.writeFile(filePath, JSON.stringify({
    version: 1,
    entries: [{
      id: 'entry-1',
      text: 'saved text',
      timestamp: '2026-10-23T00:00:00.000Z',
      unexpected: 'not sent through IPC',
    }],
  }), 'utf8')

  assert.deepEqual(await store.getHistory(), [{
    id: 'entry-1',
    text: 'saved text',
    timestamp: '2026-10-23T00:00:00.000Z',
  }])
})

test('invalid and oversized clipboard text is not stored', async (t) => {
  const { store } = await makeStore(t, { maxTextChars: 5 })

  assert.equal(await store.addText('   '), null)
  assert.equal(await store.addText('123456'), null)
  assert.deepEqual(await store.getHistory(), [])
})

test('missing storage is an empty healthy history; corrupted JSON is handled safely', async (t) => {
  const { store, filePath } = await makeStore(t)
  await store.initialize()
  assert.deepEqual(await store.getHistory(), [])
  assert.equal(store.getStorageStatus(), true)

  await fs.writeFile(filePath, '{not valid JSON', 'utf8')
  const recoveredStore = new ClipboardHistoryStore({ filePath })
  assert.deepEqual(await recoveredStore.getHistory(), [])
  assert.equal(recoveredStore.getStorageStatus(), false)
  await recoveredStore.addText('recovered')
  assert.deepEqual((await recoveredStore.getHistory()).map((entry) => entry.text), ['recovered'])
})

test('unreadable storage does not crash history retrieval', async () => {
  const denied = Object.assign(new Error('access denied'), { code: 'EACCES' })
  const store = new ClipboardHistoryStore({
    filePath: '/unreadable/clipboard-history.json',
    fileSystem: { stat: async () => { throw denied } },
  })

  assert.deepEqual(await store.getHistory(), [])
  assert.equal(store.getStorageStatus(), false)
})

test('failed writes leave in-memory history unchanged and do not expose clipboard text', async () => {
  const missing = Object.assign(new Error('missing'), { code: 'ENOENT' })
  const store = new ClipboardHistoryStore({
    filePath: '/temporary/clipboard-history.json',
    fileSystem: {
      stat: async () => { throw missing },
      mkdir: async () => {},
      writeFile: async () => { throw new Error('disk failure') },
      unlink: async () => {},
    },
  })

  await assert.rejects(store.addText('private clipboard phrase'), (error) => {
    assert.match(error.message, /could not be saved locally/)
    assert.doesNotMatch(error.message, /private clipboard phrase/)
    return true
  })
  assert.deepEqual(await store.getHistory(), [])
  assert.equal(store.getStorageStatus(), false)
})

test('an interrupted atomic replacement leaves the previous history readable', async (t) => {
  const { store, filePath } = await makeStore(t)
  const original = await store.addText('previously saved')
  const previousFile = await fs.readFile(filePath, 'utf8')

  store.fileSystem = new Proxy(store.fileSystem, {
    get(target, property) {
      if (property === 'rename') {
        return async () => { throw new Error('simulated interrupted replacement') }
      }
      const value = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  await assert.rejects(store.addText('replacement entry'), /could not be saved locally/)
  assert.equal(await fs.readFile(filePath, 'utf8'), previousFile)
  assert.deepEqual(await store.getHistory(), [original])
  assert.equal(await fs.access(`${filePath}.tmp`).then(() => true, () => false), false)
})

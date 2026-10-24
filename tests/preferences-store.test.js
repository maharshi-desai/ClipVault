const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { PreferencesStore } = require('../electron/preferences-store')

test('preferences persist theme, history limit, and capture-on-startup privacy choice', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'clipvault-prefs-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'preferences.json')
  const store = new PreferencesStore({ filePath })
  assert.deepEqual(await store.load(), { theme: 'system', historyLimit: 500, captureOnStartup: true })

  const updated = await store.update({ theme: 'dark', historyLimit: 250, captureOnStartup: false })
  const reopened = new PreferencesStore({ filePath })
  assert.deepEqual(await reopened.load(), updated)
})

test('corrupted preferences fall back to safe defaults', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'clipvault-prefs-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'preferences.json')
  await fs.writeFile(filePath, '{broken', 'utf8')
  const store = new PreferencesStore({ filePath })
  assert.deepEqual(await store.load(), { theme: 'system', historyLimit: 500, captureOnStartup: true })
})

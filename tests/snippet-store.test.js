const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { SnippetStore } = require('../electron/snippet-store')

async function makeStore(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'clipvault-snippets-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  let nextId = 0
  return new SnippetStore({
    filePath: path.join(directory, 'snippets.json'),
    createId: () => `snippet-${++nextId}`,
    now: () => `2026-10-24T00:00:0${nextId}.000Z`,
  })
}

test('snippets create, search, pin, edit, persist, and delete', async (t) => {
  const store = await makeStore(t)
  const first = await store.save({ title: 'Thanks', content: 'Thanks for the update.' })
  await store.save({ title: 'Meeting link', content: 'https://example.test/meeting' })
  assert.equal((await store.list('UPDATE')).length, 1)
  const pinned = await store.setPinned(first.id, true)
  assert.equal(pinned.pinned, true)
  const edited = await store.save({ id: first.id, title: 'Thank you', content: 'Thanks so much.' })
  assert.equal(edited.id, first.id)
  assert.equal(edited.pinned, true)
  assert.equal((await store.list())[0].id, first.id)
  assert.equal(await store.delete(first.id), true)
  assert.equal(await store.delete(first.id), false)
  assert.equal((await store.list()).length, 1)
})

test('snippet validation rejects empty titles and content', async (t) => {
  const store = await makeStore(t)
  await assert.rejects(store.save({ title: ' ', content: 'text' }), /invalid/i)
  await assert.rejects(store.save({ title: 'Title', content: ' ' }), /invalid/i)
})

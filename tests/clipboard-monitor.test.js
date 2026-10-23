const test = require('node:test')
const assert = require('node:assert/strict')
const { ClipboardMonitor } = require('../electron/clipboard-monitor')

function createMonitor(initialText = '') {
  const clipboard = { text: initialText, readText() { return this.text } }
  const entries = []
  const statuses = []
  const timers = new Set()
  const historyStore = {
    available: true,
    getStorageStatus() { return this.available },
    async addText(text) {
      if (entries.some((entry) => entry.text === text)) return null
      const entry = { id: `id-${entries.length + 1}`, text, timestamp: '2026-10-23T00:00:00.000Z' }
      entries.unshift(entry)
      return entry
    },
  }
  const monitor = new ClipboardMonitor({
    clipboard,
    historyStore,
    pollIntervalMs: 1000,
    maxTextChars: 8,
    historyLimit: 500,
    onEntry: (entry) => entries.push({ notified: entry.id }),
    onStatusChange: (status) => statuses.push(status),
    setIntervalFn: (callback, interval) => {
      const timer = { callback, interval }
      timers.add(timer)
      return timer
    },
    clearIntervalFn: (timer) => timers.delete(timer),
  })
  return { clipboard, entries, historyStore, monitor, statuses, timers }
}

test('startup baseline is not recorded and changed text is captured once', async () => {
  const { clipboard, entries, monitor } = createMonitor('already copied')
  await monitor.start()
  await monitor.poll()
  assert.deepEqual(entries, [])

  clipboard.text = 'new text'
  await monitor.poll()
  await monitor.poll()
  assert.deepEqual(entries, [
    { id: 'id-1', text: 'new text', timestamp: '2026-10-23T00:00:00.000Z' },
    { notified: 'id-1' },
  ])
})

test('a failed initial clipboard read establishes a baseline before capture begins', async () => {
  const { clipboard, entries, monitor } = createMonitor('already on clipboard')
  const readText = clipboard.readText.bind(clipboard)
  let firstRead = true
  clipboard.readText = () => {
    if (firstRead) {
      firstRead = false
      throw new Error('clipboard unavailable')
    }
    return readText()
  }

  await monitor.start()
  await monitor.poll()
  assert.deepEqual(entries, [])
  clipboard.text = 'new'
  await monitor.poll()
  assert.equal(entries[0].text, 'new')
})

test('pause stops capture and resume resets baseline for clipboard changes while paused', async () => {
  const { clipboard, entries, monitor, timers } = createMonitor('startup')
  await monitor.start()
  assert.equal(timers.size, 1)

  await monitor.pause()
  assert.equal(monitor.getStatus().enabled, false)
  assert.equal(timers.size, 0)
  clipboard.text = 'while paused'
  await monitor.poll()
  await monitor.resume()
  await monitor.poll()
  assert.equal(monitor.getStatus().enabled, true)
  assert.deepEqual(entries, [])

  clipboard.text = 'resumed'
  await monitor.poll()
  assert.equal(entries[0].text, 'resumed')
})

test('empty, whitespace-only, oversized and exact duplicate text are ignored', async () => {
  const { clipboard, entries, monitor } = createMonitor('')
  await monitor.start()
  clipboard.text = '   '
  await monitor.poll()
  clipboard.text = 'too many chars'
  await monitor.poll()
  clipboard.text = 'short'
  await monitor.poll()
  clipboard.text = 'other'
  await monitor.poll()
  clipboard.text = 'short'
  await monitor.poll()

  assert.deepEqual(entries.filter((entry) => !entry.notified).map((entry) => entry.text), ['other', 'short'])
})

test('stop clears the timer and prevents later capture', async () => {
  const { clipboard, entries, monitor, timers } = createMonitor()
  await monitor.start()
  await monitor.stop()
  clipboard.text = 'after stop'
  await monitor.poll()

  assert.equal(timers.size, 0)
  assert.deepEqual(entries, [])
})

test('storage failures are reflected in status without logging clipboard text', async () => {
  const { clipboard, historyStore, monitor, statuses } = createMonitor()
  historyStore.addText = async () => {
    historyStore.available = false
    throw new Error('storage unavailable')
  }
  await monitor.start()
  clipboard.text = 'secret'
  await monitor.poll()

  assert.equal(statuses.at(-1).storageAvailable, false)
})

const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const {
  HISTORY_LIMIT,
  MAX_CLIPBOARD_TEXT_CHARS,
  MAX_HISTORY_FILE_BYTES,
} = require('./config')

class ClipboardHistoryStore {
  constructor({
    filePath,
    maxEntries = HISTORY_LIMIT,
    maxTextChars = MAX_CLIPBOARD_TEXT_CHARS,
    maxFileBytes = MAX_HISTORY_FILE_BYTES,
    fileSystem = fs,
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }) {
    this.filePath = filePath
    this.maxEntries = maxEntries
    this.maxTextChars = maxTextChars
    this.maxFileBytes = maxFileBytes
    this.fileSystem = fileSystem
    this.createId = createId
    this.now = now
    this.entries = []
    this.loaded = false
    this.storageAvailable = true
    this.queue = Promise.resolve()
  }

  runExclusive(operation) {
    const result = this.queue.then(operation, operation)
    this.queue = result.catch(() => undefined)
    return result
  }

  initialize() {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
    })
  }

  async loadIfNeeded() {
    if (this.loaded) return
    this.loaded = true

    try {
      const stats = await this.fileSystem.stat(this.filePath)
      if (stats.size > this.maxFileBytes) {
        this.storageAvailable = false
        return
      }

      const contents = await this.fileSystem.readFile(this.filePath, 'utf8')
      const document = JSON.parse(contents)
      if (document?.version !== 1 || !Array.isArray(document.entries)) {
        this.storageAvailable = false
        return
      }

      const seenIds = new Set()
      const seenTexts = new Set()
      this.entries = []
      for (const entry of document.entries) {
        if (!this.isValidEntry(entry)) continue
        if (seenIds.has(entry.id) || seenTexts.has(entry.text)) continue
        seenIds.add(entry.id)
        seenTexts.add(entry.text)
        this.entries.push(this.copyEntry(entry))
        if (this.entries.length >= this.maxEntries) break
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.storageAvailable = false
    }
  }

  isValidEntry(entry) {
    return Boolean(
      entry &&
        typeof entry.id === 'string' &&
        entry.id.length > 0 &&
        entry.id.length <= 128 &&
        typeof entry.text === 'string' &&
        entry.text.trim().length > 0 &&
        entry.text.length <= this.maxTextChars &&
        typeof entry.timestamp === 'string' &&
        entry.timestamp.length <= 64 &&
        Number.isFinite(Date.parse(entry.timestamp)),
    )
  }

  copyEntry(entry) {
    return { id: entry.id, text: entry.text, timestamp: entry.timestamp }
  }

  getHistory() {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      return this.entries.map((entry) => this.copyEntry(entry))
    })
  }

  search(query) {
    const needle = query.toLocaleLowerCase()
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      return this.entries
        .filter((entry) => entry.text.toLocaleLowerCase().includes(needle))
        .map((entry) => this.copyEntry(entry))
    })
  }

  getById(id) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const entry = this.entries.find((item) => item.id === id)
      return entry ? this.copyEntry(entry) : null
    })
  }

  addText(text, timestamp = this.now()) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      if (typeof text !== 'string' || text.trim().length === 0 || text.length > this.maxTextChars) {
        return null
      }
      if (this.entries.some((entry) => entry.text === text)) return null

      const entry = { id: this.createId(), text, timestamp }
      const nextEntries = [entry, ...this.entries].slice(0, this.maxEntries)
      await this.persist(nextEntries)
      this.entries = nextEntries
      return this.copyEntry(entry)
    })
  }

  delete(id) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const nextEntries = this.entries.filter((entry) => entry.id !== id)
      if (nextEntries.length === this.entries.length) return false
      await this.persist(nextEntries)
      this.entries = nextEntries
      return true
    })
  }

  clear() {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const previousCount = this.entries.length
      await this.persist([])
      this.entries = []
      return previousCount
    })
  }

  getStorageStatus() {
    return this.storageAvailable
  }

  async persist(entries) {
    const document = JSON.stringify({ version: 1, entries })
    if (Buffer.byteLength(document, 'utf8') > this.maxFileBytes) {
      this.storageAvailable = false
      throw new Error('Clipboard history exceeds the local storage limit.')
    }

    const temporaryPath = `${this.filePath}.tmp`
    try {
      await this.fileSystem.mkdir(path.dirname(this.filePath), { recursive: true })
      await this.fileSystem.writeFile(temporaryPath, document, { encoding: 'utf8', mode: 0o600 })
      await this.fileSystem.rename(temporaryPath, this.filePath)
      this.storageAvailable = true
    } catch {
      this.storageAvailable = false
      try {
        await this.fileSystem.unlink(temporaryPath)
      } catch {
        // A missing temporary file is expected when writing failed early.
      }
      throw new Error('Clipboard history could not be saved locally.')
    }
  }
}

module.exports = { ClipboardHistoryStore }

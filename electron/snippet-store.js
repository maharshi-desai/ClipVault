const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const MAX_SNIPPETS = 500
const MAX_TITLE_CHARS = 100
const MAX_CONTENT_CHARS = 25_000

class SnippetStore {
  constructor({ filePath, fileSystem = fs, createId = randomUUID, now = () => new Date().toISOString() }) {
    this.filePath = filePath
    this.fileSystem = fileSystem
    this.createId = createId
    this.now = now
    this.entries = []
    this.loaded = false
    this.queue = Promise.resolve()
  }

  runExclusive(operation) {
    const result = this.queue.then(operation, operation)
    this.queue = result.catch(() => undefined)
    return result
  }

  async loadIfNeeded() {
    if (this.loaded) return
    this.loaded = true
    try {
      const document = JSON.parse(await this.fileSystem.readFile(this.filePath, 'utf8'))
      if (document.version !== 1 || !Array.isArray(document.snippets)) return
      this.entries = document.snippets.filter((item) => this.isValid(item)).slice(0, MAX_SNIPPETS)
    } catch (error) {
      if (error.code !== 'ENOENT') this.entries = []
    }
  }

  isValid(snippet) {
    return Boolean(
      snippet &&
      typeof snippet.id === 'string' &&
      typeof snippet.title === 'string' &&
      snippet.title.trim().length > 0 &&
      snippet.title.length <= MAX_TITLE_CHARS &&
      typeof snippet.content === 'string' &&
      snippet.content.trim().length > 0 &&
      snippet.content.length <= MAX_CONTENT_CHARS &&
      typeof snippet.pinned === 'boolean' &&
      Number.isFinite(Date.parse(snippet.createdAt)) &&
      Number.isFinite(Date.parse(snippet.updatedAt)),
    )
  }

  copy(snippet) {
    return { ...snippet }
  }

  list(query = '') {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const needle = query.trim().toLocaleLowerCase()
      return this.entries
        .filter((item) => !needle || `${item.title}\n${item.content}`.toLocaleLowerCase().includes(needle))
        .map((item) => this.copy(item))
        .sort((left, right) => Number(right.pinned) - Number(left.pinned) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    })
  }

  getById(id) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const snippet = this.entries.find((item) => item.id === id)
      return snippet ? this.copy(snippet) : null
    })
  }

  save({ id, title, content }) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const cleanTitle = title.trim()
      if (!cleanTitle || cleanTitle.length > MAX_TITLE_CHARS || !content.trim() || content.length > MAX_CONTENT_CHARS) {
        throw new TypeError('Snippet title or content is invalid.')
      }
      const existingIndex = id ? this.entries.findIndex((snippet) => snippet.id === id) : -1
      if (id && existingIndex < 0) return null
      if (existingIndex < 0 && this.entries.length >= MAX_SNIPPETS) throw new Error('Snippet limit reached.')
      const timestamp = this.now()
      const existing = existingIndex >= 0 ? this.entries[existingIndex] : null
      const saved = {
        id: existing?.id ?? this.createId(),
        title: cleanTitle,
        content,
        pinned: existing?.pinned ?? false,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }
      const next = [...this.entries]
      if (existingIndex >= 0) next[existingIndex] = saved
      else next.unshift(saved)
      await this.persist(next)
      this.entries = next
      return this.copy(saved)
    })
  }

  setPinned(id, pinned) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const index = this.entries.findIndex((item) => item.id === id)
      if (index < 0) return null
      const next = [...this.entries]
      next[index] = { ...next[index], pinned, updatedAt: this.now() }
      await this.persist(next)
      this.entries = next
      return this.copy(next[index])
    })
  }

  delete(id) {
    return this.runExclusive(async () => {
      await this.loadIfNeeded()
      const next = this.entries.filter((item) => item.id !== id)
      if (next.length === this.entries.length) return false
      await this.persist(next)
      this.entries = next
      return true
    })
  }

  async persist(snippets) {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    try {
      await this.fileSystem.mkdir(path.dirname(this.filePath), { recursive: true })
      await this.fileSystem.writeFile(temporaryPath, JSON.stringify({ version: 1, snippets }), { encoding: 'utf8', mode: 0o600 })
      await this.fileSystem.rename(temporaryPath, this.filePath)
    } catch {
      try { await this.fileSystem.unlink(temporaryPath) } catch {}
      throw new Error('Snippets could not be saved locally.')
    }
  }
}

module.exports = { MAX_CONTENT_CHARS, MAX_SNIPPETS, MAX_TITLE_CHARS, SnippetStore }

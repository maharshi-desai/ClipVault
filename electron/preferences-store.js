const fs = require('node:fs/promises')
const path = require('node:path')

const THEMES = ['system', 'light', 'dark']
const HISTORY_LIMITS = [100, 250, 500, 1000]

function isValidHistoryLimit(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 5000
}

class PreferencesStore {
  constructor({ filePath, defaults = { theme: 'system', historyLimit: 500, captureOnStartup: true }, fileSystem = fs }) {
    this.filePath = filePath
    this.defaults = { ...defaults }
    this.fileSystem = fileSystem
    this.values = { ...defaults }
    this.queue = Promise.resolve()
  }

  async load() {
    try {
      const document = JSON.parse(await this.fileSystem.readFile(this.filePath, 'utf8'))
      if (THEMES.includes(document.theme)) this.values.theme = document.theme
      if (isValidHistoryLimit(document.historyLimit)) this.values.historyLimit = document.historyLimit
      if (typeof document.captureOnStartup === 'boolean') this.values.captureOnStartup = document.captureOnStartup
    } catch (error) {
      if (error.code !== 'ENOENT') this.values = { ...this.defaults }
    }
    return this.get()
  }

  get() {
    return { ...this.values }
  }

  update(patch) {
    const operation = async () => {
      const next = { ...this.values, ...patch }
      const document = JSON.stringify({ version: 1, ...next })
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`
      try {
        await this.fileSystem.mkdir(path.dirname(this.filePath), { recursive: true })
        await this.fileSystem.writeFile(temporaryPath, document, { encoding: 'utf8', mode: 0o600 })
        await this.fileSystem.rename(temporaryPath, this.filePath)
      } catch {
        try { await this.fileSystem.unlink(temporaryPath) } catch {}
        throw new Error('Preferences could not be saved locally.')
      }
      this.values = next
      return this.get()
    }
    const result = this.queue.then(operation, operation)
    this.queue = result.catch(() => undefined)
    return result
  }
}

module.exports = { HISTORY_LIMITS, THEMES, PreferencesStore, isValidHistoryLimit }

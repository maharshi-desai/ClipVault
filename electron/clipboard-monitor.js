const {
  HISTORY_LIMIT,
  MAX_CLIPBOARD_TEXT_CHARS,
  POLL_INTERVAL_MS,
} = require('./config')

class ClipboardMonitor {
  constructor({
    clipboard,
    historyStore,
    pollIntervalMs = POLL_INTERVAL_MS,
    maxTextChars = MAX_CLIPBOARD_TEXT_CHARS,
    historyLimit = HISTORY_LIMIT,
    onEntry = () => {},
    onStatusChange = () => {},
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  }) {
    this.clipboard = clipboard
    this.historyStore = historyStore
    this.pollIntervalMs = pollIntervalMs
    this.maxTextChars = maxTextChars
    this.historyLimit = historyLimit
    this.onEntry = onEntry
    this.onStatusChange = onStatusChange
    this.setIntervalFn = setIntervalFn
    this.clearIntervalFn = clearIntervalFn
    this.enabled = false
    this.lastText = null
    this.hasBaseline = false
    this.timer = null
    this.polling = false
    this.pendingPoll = Promise.resolve()
  }

  getStatus() {
    return {
      enabled: this.enabled,
      pollIntervalMs: this.pollIntervalMs,
      historyLimit: this.historyLimit,
      maxClipboardTextChars: this.maxTextChars,
      storageAvailable: this.historyStore.getStorageStatus(),
    }
  }

  emitStatus() {
    this.onStatusChange(this.getStatus())
  }

  schedulePolling() {
    if (this.timer) return
    this.timer = this.setIntervalFn(() => {
      this.poll()
    }, this.pollIntervalMs)
    if (typeof this.timer?.unref === 'function') this.timer.unref()
  }

  async start() {
    if (this.enabled) return this.getStatus()
    this.lastText = await this.readClipboardText()
    this.hasBaseline = typeof this.lastText === 'string'
    this.enabled = true
    this.schedulePolling()
    this.emitStatus()
    return this.getStatus()
  }

  async pause() {
    if (!this.enabled) return this.getStatus()
    this.enabled = false
    this.clearTimer()
    await this.pendingPoll
    this.emitStatus()
    return this.getStatus()
  }

  async resume() {
    if (this.enabled) return this.getStatus()
    await this.pendingPoll
    this.lastText = await this.readClipboardText()
    this.hasBaseline = typeof this.lastText === 'string'
    this.enabled = true
    this.schedulePolling()
    this.emitStatus()
    return this.getStatus()
  }

  async stop() {
    this.enabled = false
    this.clearTimer()
    await this.pendingPoll
  }

  clearTimer() {
    if (!this.timer) return
    this.clearIntervalFn(this.timer)
    this.timer = null
  }

  async readClipboardText() {
    try {
      const value = await this.clipboard.readText()
      return typeof value === 'string' ? value : null
    } catch {
      return null
    }
  }

  async poll() {
    if (!this.enabled || this.polling) return

    this.polling = true
    this.pendingPoll = this.captureChangedText()
    try {
      await this.pendingPoll
    } finally {
      this.polling = false
    }
  }

  async captureChangedText() {
    const text = await this.readClipboardText()
    if (!this.enabled || typeof text !== 'string') return
    if (!this.hasBaseline) {
      this.lastText = text
      this.hasBaseline = true
      return
    }
    if (text === this.lastText) return
    this.lastText = text

    if (text.trim().length === 0 || text.length > this.maxTextChars) return

    try {
      const entry = await this.historyStore.addText(text)
      if (entry) this.onEntry(entry)
    } catch {
      // Never log clipboard content. The storage status is reflected in the UI.
      this.emitStatus()
    }
  }
}

module.exports = { ClipboardMonitor }

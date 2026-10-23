function positiveIntegerFromEnv(name, fallback, maximum) {
  const value = Number(process.env[name])
  if (!Number.isSafeInteger(value) || value <= 0) return fallback
  return Math.min(value, maximum)
}

module.exports = Object.freeze({
  POLL_INTERVAL_MS: positiveIntegerFromEnv('CLIPVAULT_POLL_INTERVAL_MS', 1000, 60_000),
  HISTORY_LIMIT: positiveIntegerFromEnv('CLIPVAULT_HISTORY_LIMIT', 500, 5000),
  MAX_CLIPBOARD_TEXT_CHARS: positiveIntegerFromEnv('CLIPVAULT_MAX_TEXT_CHARS', 25_000, 100_000),
  MAX_HISTORY_FILE_BYTES: 64 * 1024 * 1024,
})

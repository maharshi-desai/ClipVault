async function confirmAndClearHistory({ dialog, parentWindow, historyStore }) {
  const restoreParent = Boolean(
    parentWindow &&
      !parentWindow.isDestroyed() &&
      typeof parentWindow.isVisible === 'function' &&
      parentWindow.isVisible(),
  )
  const options = {
    type: 'warning',
    title: 'Clear clipboard history?',
    message: 'This permanently removes all saved clips from this Mac.',
    detail: 'This action cannot be undone.',
    buttons: ['Cancel', 'Clear History'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  }
  const result = parentWindow
    ? await dialog.showMessageBox(parentWindow, options)
    : await dialog.showMessageBox(options)

  if (restoreParent && !parentWindow.isDestroyed()) {
    parentWindow.show()
    parentWindow.focus()
  }

  if (result.response !== 1) return { cleared: false, count: 0 }
  return { cleared: true, count: await historyStore.clear() }
}

module.exports = { confirmAndClearHistory }

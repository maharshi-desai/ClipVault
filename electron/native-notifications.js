function createNativeNotifications({ Notification, onSnippetSaved = () => {} }) {
  function showSnippetSaved() {
    try {
      if (!Notification.isSupported()) return false
      const notification = new Notification({
        title: 'Snippet saved',
        body: 'Your reusable snippet is ready in ClipVault.',
      })
      notification.on('click', onSnippetSaved)
      notification.show()
      return true
    } catch {
      // Notification availability must not prevent a snippet from being saved.
      return false
    }
  }

  return Object.freeze({ showSnippetSaved })
}

module.exports = { createNativeNotifications }

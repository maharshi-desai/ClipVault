const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createNativeNotifications } = require('../electron/native-notifications')

test('snippet notification is generic and clicking it shows the popup', () => {
  let clickCalls = 0
  class FakeNotification extends EventEmitter {
    static isSupported() { return true }
    constructor(options) { super(); this.options = options; FakeNotification.last = this }
    show() { this.shown = true }
  }

  const notifications = createNativeNotifications({
    Notification: FakeNotification,
    onSnippetSaved: () => { clickCalls += 1 },
  })
  assert.equal(notifications.showSnippetSaved(), true)
  assert.equal(FakeNotification.last.shown, true)
  assert.deepEqual(FakeNotification.last.options, {
    title: 'Snippet saved',
    body: 'Your reusable snippet is ready in ClipVault.',
  })
  FakeNotification.last.emit('click')
  assert.equal(clickCalls, 1)
})

test('unsupported native notifications do not throw or block saves', () => {
  class UnsupportedNotification {
    static isSupported() { return false }
  }
  const notifications = createNativeNotifications({ Notification: UnsupportedNotification })
  assert.equal(notifications.showSnippetSaved(), false)
})

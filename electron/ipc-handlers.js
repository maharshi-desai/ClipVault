const { isTrustedMainFrameEvent } = require('./ipc-contract')

function createGetAppInfoHandler({ app, BrowserWindow, platform, trustedWebContents }) {
  return (event, ...args) => {
    if (!isTrustedMainFrameEvent(event, BrowserWindow, trustedWebContents)) {
      throw new Error('IPC request came from an untrusted renderer.')
    }

    if (args.length !== 0) {
      throw new TypeError('The app info request does not accept arguments.')
    }

    return {
      name: app.getName(),
      version: app.getVersion(),
      platform,
    }
  }
}

module.exports = { createGetAppInfoHandler }

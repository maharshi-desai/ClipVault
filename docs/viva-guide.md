# Viva guide

## How the app starts

1. `npm run dev` starts Vite and waits until its local URL is ready.
2. Electron launches `electron/main.js`, which creates a `BrowserWindow` and loads the Vite URL.
3. The window loads `preload.js` before the page. The preload exposes a small `window.clipVault` API using `contextBridge`.
4. React mounts at `src/main.jsx`; `src/App.jsx` requests application information and subscribes to window focus changes.

## IPC request and response

`getAppInfo()` in the renderer calls the named preload method. Preload uses `ipcRenderer.invoke('clipvault:app:get-info')`. The main process has registered that channel with `ipcMain.handle`; before returning `{ name, version, platform }`, it checks the sender is an allowlisted window's main frame and that no arguments were supplied. Electron resolves the promise with the returned object, which React displays.

## Safe event subscription

The main process sends a fixed focus/blur payload on `clipvault:window:state-changed`. Preload listens to that channel and calls the renderer callback with only the validated state string. It does not pass the raw Electron event object. The subscription returns an unsubscribe function, and React calls it automatically when the component unmounts. The renderer cannot pick an arbitrary channel.

## Production flow

`npm run build` bundles the renderer into `dist/`. Packaged Electron loads `dist/index.html`. `npm run dist:mac` builds the renderer and asks electron-builder to create a DMG.

## Security explanation

Context isolation keeps the page's JavaScript environment separate from Electron's preload environment. Disabling Node integration prevents renderer code from importing Node modules. A narrow preload bridge is the intended way to add desktop capabilities. The main process also validates request senders and arguments.

## Scope

Important communication files: `electron/main.js` registers handlers and emits window events; `electron/ipc-contract.js` defines the allowed channel names and payload check; `electron/ipc-handlers.js` validates and serves the request; `electron/renderer-api.js` wraps the limited renderer operations; `electron/preload.js` exposes them; and `src/App.jsx` demonstrates their use. `tests/ipc.test.js` covers the API behavior using Node's built-in test runner.

This is still the foundation phase. The sample clip cards are static; there is no clipboard monitoring or persistence.

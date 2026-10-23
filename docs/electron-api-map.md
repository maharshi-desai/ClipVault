# Electron API map

| Location | Responsibility | Current surface |
| --- | --- | --- |
| `electron/main.js` | Window lifecycle, dev/production loading, window focus/blur events, IPC handler registration | `BrowserWindow`, `app`, `ipcMain.handle` |
| `electron/ipc-contract.js` | Fixed channel names, sender-frame check, event payload validation | `clipvault:app:get-info`, `clipvault:window:state-changed` |
| `electron/ipc-handlers.js` | Validates app-info sender and zero-argument request; returns allowlisted metadata | `{ name, version, platform }` |
| `electron/renderer-api.js` | Renderer-safe wrappers around invoke and event listener registration | `getAppInfo()`, `onWindowStateChanged(callback)` |
| `electron/preload.js` | Exposes the limited API with `contextBridge` | `window.clipVault` |
| `src/App.jsx` | Calls app-info API and subscribes to window state | Displays app name/version/platform and focused/blurred status |
| `tests/ipc.test.js` | Exercises request validation and preload API behavior with Node's test runner | No Electron runtime required |

Security settings on the window: `contextIsolation: true`, `nodeIntegration: false`. The renderer cannot choose a channel or pass arguments through `getAppInfo`. The main handler rejects calls from WebContents outside the app's allowlist, subframes, or requests with arguments. Event subscriptions are limited to one named channel, validate their payload, hide the Electron event object, and return an unsubscribe function. Neither `ipcRenderer` nor Node.js APIs are exposed. No clipboard APIs are exposed.

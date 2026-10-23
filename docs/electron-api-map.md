# Electron API map

| Location | Responsibility | Current surface |
| --- | --- | --- |
| `electron/main.js` | Window lifecycle, dev/production loading, window focus/blur events, IPC handler registration | `BrowserWindow`, `app`, `ipcMain.handle` |
| `electron/ipc-contract.js` | Fixed channel names, sender-frame check, event payload validation | `clipvault:app:get-info`, `clipvault:window:state-changed` |
| `electron/ipc-handlers.js` | Validates trusted sender, argument count/types, history IDs and routes operations | History/search/copy/delete/clear and capture controls |
| `electron/clipboard-monitor.js` | Polls Electron clipboard text, tracks baseline, pauses/resumes and emits new entries | Main-process clipboard access only |
| `electron/clipboard-history-store.js` | Asynchronous JSON persistence and history operations | `userData/clipboard-history.json` |
| `electron/config.js` | Poll interval, item cap, and max text size defaults/environment overrides | 1 second, 500 entries, 25,000 characters |
| `electron/renderer-api.js` | Renderer-safe wrappers around invoke and event listener registration | History operations, capture controls, typed event callbacks |
| `electron/preload.js` | Exposes the limited API with `contextBridge` | `window.clipVault` |
| `src/App.jsx` | Uses the preload API for local history and capture controls | Search, copy, delete, clear, pause/resume, visible privacy status |
| `tests/` | Exercises storage, capture, IPC validation and event API with Node's test runner | No Electron runtime required |

### Exposed renderer API

Request methods: `getAppInfo()`, `getHistory()`, `searchHistory(query)`, `copyHistoryEntry(id)`, `deleteHistoryEntry(id)`, `clearHistory()`, `pauseCapture()`, `resumeCapture()`, and `getCaptureStatus()`.

Event methods: `onClipboardEntry(callback)`, `onCaptureStatusChanged(callback)`, and `onWindowStateChanged(callback)`. Each returns an unsubscribe function. Event wrappers validate and select payload fields and never pass Electron's event object to the renderer.

### IPC channels

| Channel | Direction | Data |
| --- | --- | --- |
| `clipvault:app:get-info` | Renderer → main → renderer | No args; returns app name/version/platform |
| `clipvault:history:get` | Renderer → main → renderer | No args; returns newest-first entries |
| `clipvault:history:search` | Renderer → main → renderer | Query up to 256 characters; returns matching entries |
| `clipvault:history:copy` | Renderer → main → renderer | UUID; copies a saved entry to the system clipboard and returns success |
| `clipvault:history:delete` | Renderer → main → renderer | UUID; deletes one entry |
| `clipvault:history:clear` | Renderer → main → renderer | No args; returns the number of entries cleared |
| `clipvault:capture:pause` / `resume` | Renderer → main → renderer | No args; returns capture status |
| `clipvault:capture:get-status` | Renderer → main → renderer | No args; returns enabled state and configured limits |
| `clipvault:history:new-entry` | Main → renderer | New saved entry `{ id, text, timestamp }` |
| `clipvault:capture:status-changed` | Main → renderer | Capture enabled state, limits, and storage availability |

Security settings on the window: `contextIsolation: true`, `nodeIntegration: false`. The renderer cannot choose a channel or access the filesystem or clipboard directly. Main handlers reject calls from WebContents outside the app's allowlist, subframes, malformed IDs/search terms, or unexpected arguments. Event subscriptions are limited to named channels, validate their payload, hide Electron's event object, and return unsubscribe functions. Neither `ipcRenderer` nor unrestricted Node.js APIs are exposed. Clipboard text is only stored locally and is not automatically encrypted.

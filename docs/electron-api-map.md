# Electron API map

| Location | Responsibility | Current surface |
| --- | --- | --- |
| `electron/main.js` | Single-instance startup, history/capture initialization, IPC and menu-bar wiring | `app.whenReady()`, `BrowserWindow`, `ipcMain.handle` |
| `electron/menu-bar-controller.js` | Singleton popup/tray, placement, global shortcut and tray actions | `Tray`, `Menu`, `globalShortcut`, `screen` |
| `electron/app-lifecycle.js` | Capture shutdown, tray disposal, and shortcut cleanup | `before-quit`, `will-quit` |
| `electron/history-clear-confirmation.js` | Native confirmation before permanent history clearing | `dialog.showMessageBox` |
| `electron/snippet-store.js` | Persistent snippet CRUD, search, pin ordering and copy lookup | `userData/snippets.json` |
| `electron/preferences-store.js` | Persistent theme, history cap and capture-on-launch privacy setting | `userData/preferences.json` |
| `electron/assets/clipvault-template.png` | Monochrome icon marked as a macOS template image | Tray icon |
| `electron/ipc-contract.js` | Fixed channel names, sender-frame check, event payload validation | App, capture, history and clear-notification channels |
| `electron/ipc-handlers.js` | Validates trusted sender, argument count/types, history IDs and routes operations | History/search/copy/delete/native clear/capture controls |
| `electron/clipboard-monitor.js` | Polls Electron clipboard text, tracks baseline, pauses/resumes and emits new entries | Main-process clipboard access only |
| `electron/clipboard-history-store.js` | Asynchronous JSON persistence and history operations | `userData/clipboard-history.json` |
| `electron/config.js` | Poll interval, item cap, and max text size defaults/environment overrides | 1 second, 500 entries, 25,000 characters |
| `electron/renderer-api.js` | Renderer-safe wrappers around invoke and event listener registration | History operations, capture controls, typed event callbacks |
| `electron/preload.js` | Exposes the limited API with `contextBridge` | `window.clipVault` |
| `src/App.jsx` | Uses the preload API for local history and capture controls | Search, copy, delete, clear, pause/resume, visible privacy status |
| `tests/` | Exercises storage, capture, IPC, tray/popup/shortcut and quit behavior with Node's test runner | Electron APIs mocked for native lifecycle cases |

### Exposed renderer API

Request methods: `getAppInfo()`, `getHistory()`, `searchHistory(query)`, `copyHistoryEntry(id)`, `deleteHistoryEntry(id)`, `clearHistory()`, `pauseCapture()`, `resumeCapture()`, `getCaptureStatus()`, `getSnippets(query)`, `saveSnippet(snippet)`, `copySnippet(id)`, `setSnippetPinned(id, pinned)`, `deleteSnippet(id)`, `getPreferences()`, `updatePreferences(patch)`, `getAppearance()`, and `closePopup()`. `clearHistory()` returns `{ cleared, count }` after a native warning dialog; cancellation preserves history.

Event methods: `onClipboardEntry(callback)`, `onCaptureStatusChanged(callback)`, `onHistoryCleared(callback)`, `onAppearanceChanged(callback)`, and `onWindowStateChanged(callback)`. Each returns an unsubscribe function. Event wrappers validate and select payload fields and never pass Electron's event object to the renderer.

### IPC channels

| Channel | Direction | Data |
| --- | --- | --- |
| `clipvault:app:get-info` | Renderer → main → renderer | No args; returns app name/version/platform |
| `clipvault:history:get` | Renderer → main → renderer | No args; returns newest-first entries |
| `clipvault:history:search` | Renderer → main → renderer | Query up to 256 characters; returns matching entries |
| `clipvault:history:copy` | Renderer → main → renderer | UUID; copies a saved entry to the system clipboard and returns success |
| `clipvault:history:delete` | Renderer → main → renderer | UUID; deletes one entry |
| `clipvault:history:clear` | Renderer → main → renderer | No args; asks for native confirmation, then returns `{ cleared, count }` |
| `clipvault:history:cleared` | Main → renderer | `{ count }` after a confirmed tray or app clear |
| `clipvault:snippets:*` | Renderer → main → renderer | Search/list, create/edit, copy by ID, pin/unpin, and delete snippets |
| `clipvault:preferences:get/update` | Renderer → main → renderer | Theme, history limit, and capture-on-startup preference; main validates updates |
| `clipvault:appearance:get/changed` | Main/renderer | Effective theme state; `nativeTheme.updated` drives system changes |
| `clipvault:popup:close` | Renderer → main | No args; hides only the requesting trusted popup |
| `clipvault:capture:pause` / `resume` | Renderer → main → renderer | No args; returns capture status |
| `clipvault:capture:get-status` | Renderer → main → renderer | No args; returns enabled state and configured limits |
| `clipvault:history:new-entry` | Main → renderer | New saved entry `{ id, text, timestamp }` |
| `clipvault:capture:status-changed` | Main → renderer | Capture enabled state, limits, and storage availability |

Security settings on the window: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: false`. The sandbox is disabled because the small CommonJS preload imports the audited local `renderer-api.js` module; the renderer itself still receives only the named `contextBridge` methods and has no Node.js access. The renderer cannot choose an IPC channel or access the filesystem or clipboard directly. Main handlers reject calls from WebContents outside the app's allowlist, subframes, malformed IDs/search terms, or unexpected arguments. Event subscriptions are limited to named channels, validate their payload, hide Electron's event object, and return unsubscribe functions. Neither `ipcRenderer` nor unrestricted Node.js APIs are exposed. Clipboard text is only stored locally and is not automatically encrypted.

## Menu bar operation

The app starts one compact popup beside the tray. Tray clicks and `CommandOrControl+Shift+V` toggle the same window; it is repositioned within the active display work area and focused when shown. Escape, blur, or closing the popup hides it while the tray app remains available. Shortcut failures are surfaced in the tray tooltip/menu. Automated tests use mocked Electron APIs and cover popup lifecycle/placement, menu actions, shortcut failure, clear confirmation, and quit cleanup; they do not replace a manual macOS interaction check.

Snippet and preference storage remains local to the Electron `userData` directory. The React renderer only invokes the named methods; snippet content is copied by ID inside the main process. `nativeTheme` owns system appearance synchronization, while the renderer only applies the validated effective dark/light value.

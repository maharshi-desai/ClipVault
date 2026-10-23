# Architecture

ClipVault is split into a renderer and a desktop shell. Clipboard text is read and stored by the Electron main process; the renderer receives only the history operations and events exposed by the preload bridge.

- **Renderer (`src/`)**: React components and JSX are built by Vite. Tailwind utilities are processed by PostCSS.
- **Main process (`electron/main.js`)**: creates the native window, starts/stops clipboard capture, initializes local history, and registers IPC handlers.
- **Clipboard monitor (`electron/clipboard-monitor.js`)**: reads text from Electron's clipboard every second while enabled, compares against a baseline, applies size/empty checks, and reports new entries.
- **History store (`electron/clipboard-history-store.js`)**: keeps up to 500 entries in memory and persists changes asynchronously to a versioned JSON file in `app.getPath('userData')`.
- **Preload (`electron/preload.js`)**: exposes a deliberately small `window.clipVault` API through Electron's `contextBridge`.
- **Build/package**: `npm run build` creates the frontend in `dist/`; electron-builder packages the app as a macOS DMG using `npm run dist:mac`.

The renderer has no direct Node.js or filesystem access (`nodeIntegration: false`). Context isolation is enabled. Clipboard data stays local; the app does not send clipboard contents to a remote service. Local JSON history is not automatically encrypted. Clipboard history may contain sensitive information, so the UI clearly shows capture status, pause/resume controls, and a clear-history action.

## Request-response and event flow

1. React calls `window.clipVault.getAppInfo()`; this public method invokes the fixed `clipvault:app:get-info` channel.
2. `electron/main.js` registers an `ipcMain.handle` listener. It checks that the call came from a BrowserWindow's main frame whose WebContents is in the app's allowlist, and rejects any arguments.
3. The main process returns only the app name, version, and platform. Electron resolves the `ipcRenderer.invoke` promise, and React displays those values.
4. The preload's `onWindowStateChanged(callback)` subscribes only to `clipvault:window:state-changed`. It checks the payload, passes only `focused` or `blurred` to the callback, and never forwards Electron's event object.
5. The subscription returns an idempotent unsubscribe function. React returns it from `useEffect`, so unmounting removes the IPC listener.

## Clipboard-to-renderer data flow

1. At startup the main process reads the current clipboard text as a baseline. It does not save that initial value.
2. While capture is enabled, the monitor polls every second. When the text changes it advances the baseline, ignores empty/whitespace-only or oversized text, and asks the history store to add it.
3. The store ignores exact text duplicates already in history. A new entry gets a UUID and ISO timestamp, is placed first in newest-first order, and the history is capped at 500 entries by default.
4. The store writes only changed history using asynchronous file operations and an atomic temporary-file rename. Missing/corrupt/unreadable files do not crash startup; a storage warning is reflected in capture status.
5. After a successful new-entry save, main sends the entry to the renderer over a fixed event channel. Search, copy, delete, clear, pause, resume, and status requests go through validated `ipcMain.handle` handlers.
6. Pausing stops the timer. Resuming reads a new baseline before scheduling polling, so clipboard contents copied while paused are not added.

The defaults are in `electron/config.js`: 1,000 ms polling, a 500-item history cap, and a 25,000-character maximum per text entry. They can be adjusted with `CLIPVAULT_POLL_INTERVAL_MS`, `CLIPVAULT_HISTORY_LIMIT`, and `CLIPVAULT_MAX_TEXT_CHARS` environment variables, subject to safety caps.

The IPC channel names and state payload check live in `electron/ipc-contract.js`; the request handler and sender validation are in `electron/ipc-handlers.js`; the limited renderer-facing methods are assembled in `electron/renderer-api.js` and exposed by `electron/preload.js`.

## Important files

| File | Purpose |
| --- | --- |
| `package.json` | Dependencies, npm commands, Electron entry point, and macOS DMG packaging settings |
| `vite.config.js` | React plugin, renderer base path, and local development server settings |
| `tailwind.config.js` / `postcss.config.js` | Tailwind source scanning and CSS processing |
| `index.html` | HTML shell Vite loads and React mounts into |
| `electron/main.js` | Creates the desktop window, initializes capture/storage, registers IPC and stops the timer at quit |
| `electron/preload.js` | Exposes the small, isolated `window.clipVault` API |
| `electron/ipc-contract.js` | Names the allowed channels and validates event payloads and sender frames |
| `electron/ipc-handlers.js` | Validates IPC senders and arguments, then routes app/history/capture requests |
| `electron/renderer-api.js` | Wraps `ipcRenderer.invoke` and manages safe event subscriptions |
| `electron/config.js` | Default capture interval, history count, and text-size limits |
| `electron/clipboard-monitor.js` | Clipboard baseline, polling, pause/resume and change detection |
| `electron/clipboard-history-store.js` | Serialized history operations and async local JSON persistence |
| `src/main.jsx` | React entry point and global stylesheet import |
| `src/App.jsx` | History, search, copy/delete/clear controls, capture status and privacy notice |
| `src/index.css` | Tailwind layers and global page defaults |
| `tests/` | Node built-in tests for IPC, storage, history operations and paused capture |
| `docs/` | Development record, architecture, API boundary, decisions, and viva explanation |

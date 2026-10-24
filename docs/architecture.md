# Architecture

ClipVault is split into a renderer and a desktop shell. Clipboard text is read and stored by the Electron main process; the renderer receives only the history operations and events exposed by the preload bridge.

- **Renderer (`src/`)**: React components and JSX are built by Vite. Tailwind utilities are processed by PostCSS.
- **Main process (`electron/main.js`)**: establishes a single app instance, initializes history and clipboard capture, creates the menu bar controller, and registers IPC handlers.
- **Menu bar controller (`electron/menu-bar-controller.js`)**: owns the tray icon/menu, singleton compact popup, popup positioning, global shortcut, pause/resume action, and menu clear-history confirmation.
- **Application lifecycle (`electron/app-lifecycle.js`)**: hides the popup close behavior during quit, disposes the tray and registered shortcut, stops capture, and unregisters shortcuts before exit.
- **Clipboard monitor (`electron/clipboard-monitor.js`)**: reads text from Electron's clipboard every second while enabled, compares against a baseline, applies size/empty checks, and reports new entries.
- **History store (`electron/clipboard-history-store.js`)**: keeps up to 500 entries in memory and persists changes asynchronously to a versioned JSON file in `app.getPath('userData')`.
- **Snippet store (`electron/snippet-store.js`)**: supports local create/edit/search/pin/delete for reusable text snippets in a separate JSON file.
- **Preferences store (`electron/preferences-store.js`)**: persists theme, history limit, and whether capture resumes automatically on next launch.
- **Preload (`electron/preload.js`)**: exposes a deliberately small `window.clipVault` API through Electron's `contextBridge`.
- **Build/package**: `npm run build` creates the frontend in `dist/`; electron-builder packages the app as a macOS DMG using `npm run dist:mac`.

The renderer has no direct Node.js or filesystem access (`nodeIntegration: false`). Context isolation is enabled. Clipboard data stays local; the app does not send clipboard contents to a remote service. Local JSON history is not automatically encrypted. Clipboard history may contain sensitive information, so the UI clearly shows capture status, pause/resume controls, and a clear-history action.

## Request-response and event flow

1. React calls `window.clipVault.getAppInfo()`; this public method invokes the fixed `clipvault:app:get-info` channel.
2. `electron/main.js` registers an `ipcMain.handle` listener. It checks that the call came from a BrowserWindow's main frame whose WebContents is in the app's allowlist, and rejects any arguments.
3. The main process returns only the app name, version, and platform. Electron resolves the `ipcRenderer.invoke` promise, and React displays those values.
4. The preload's `onWindowStateChanged(callback)` subscribes only to `clipvault:window:state-changed`. It checks the payload, passes only `focused` or `blurred` to the callback, and never forwards Electron's event object.
5. The subscription returns an idempotent unsubscribe function. React returns it from `useEffect`, so unmounting removes the IPC listener.

## Menu bar and popup flow

1. After `app.whenReady()`, main creates one compact hidden `BrowserWindow`, then creates a `Tray` with a monochrome image. On macOS the image is marked as a template image so macOS adapts its color for light and dark menu bars.
2. The tray click and registered `CommandOrControl+Shift+V` shortcut call the same toggle function. It reuses the existing popup, positions it beneath the tray inside the active display's work area, then shows and focuses it.
3. Clicking outside the popup or pressing Escape hides it. The window's close event is prevented and hides the popup, so closing the UI does not quit the tray app. A single-instance lock prevents a second application process from creating another popup.
4. The tray menu pauses/resumes the clipboard monitor, clears history only after `dialog.showMessageBox` confirmation, or requests app quit. Shortcut registration failure is caught and made visible in the tray tooltip/menu.
5. On quit, main permits the window to close, destroys the tray, unregisters the shortcut, waits for the clipboard monitor to stop, and unregisters all global shortcuts at `will-quit`. macOS `activate` shows the existing popup again.

## Clipboard-to-renderer data flow

1. At startup the main process reads the current clipboard text as a baseline. It does not save that initial value.
2. While capture is enabled, the monitor polls every second. When the text changes it advances the baseline, ignores empty/whitespace-only or oversized text, and asks the history store to add it.
3. The store ignores exact text duplicates already in history. A new entry gets a UUID and ISO timestamp, is placed first in newest-first order, and the history is capped at 500 entries by default.
4. The store writes only changed history using asynchronous file operations and an atomic temporary-file rename. Missing/corrupt/unreadable files do not crash startup; a storage warning is reflected in capture status.
5. After a successful new-entry save, main sends the entry to the renderer over a fixed event channel. Search, copy, delete, clear, pause, resume, and status requests go through validated `ipcMain.handle` handlers.
6. Pausing stops the timer. Resuming reads a new baseline before scheduling polling, so clipboard contents copied while paused are not added.

## Snippet and appearance data flow

1. The renderer requests snippets and preferences through named `window.clipVault` methods. Main validates query lengths, snippet fields, IDs, preference keys, theme values, and history limits.
2. `SnippetStore` writes snippets to `userData/snippets.json`; `PreferencesStore` writes `userData/preferences.json`. Both keep filesystem access in the main process and use asynchronous temporary-file replacement.
3. Saving/editing a snippet keeps its ID and pin state. Pinned snippets sort ahead of the rest. Copy requests send only a snippet ID; main loads the snippet and writes its content to the system clipboard.
4. Theme preference updates set `nativeTheme.themeSource` to `system`, `light`, or `dark`. The main process returns effective dark mode and broadcasts appearance changes when the OS theme changes; the renderer applies the mode to the document root.
5. History-limit changes truncate oldest entries when necessary. The automatic-resume privacy preference is used on the next app launch.

The defaults are in `electron/config.js`: 1,000 ms polling, a 500-item history cap, and a 25,000-character maximum per text entry. They can be adjusted with `CLIPVAULT_POLL_INTERVAL_MS`, `CLIPVAULT_HISTORY_LIMIT`, and `CLIPVAULT_MAX_TEXT_CHARS` environment variables, subject to safety caps.

The IPC channel names and state payload check live in `electron/ipc-contract.js`; the request handler and sender validation are in `electron/ipc-handlers.js`; the limited renderer-facing methods are assembled in `electron/renderer-api.js` and exposed by `electron/preload.js`.

## Important files

| File | Purpose |
| --- | --- |
| `package.json` | Dependencies, npm commands, Electron entry point, and macOS DMG packaging settings |
| `vite.config.js` | React plugin, renderer base path, and local development server settings |
| `tailwind.config.js` / `postcss.config.js` | Tailwind source scanning and CSS processing |
| `index.html` | HTML shell Vite loads and React mounts into |
| `electron/main.js` | Enforces one instance, initializes capture/storage, and connects tray, popup, IPC and lifecycle |
| `electron/menu-bar-controller.js` | Creates and reuses the popup, tray menu, global shortcut and popup positioning |
| `electron/app-lifecycle.js` | Coordinates capture shutdown, tray disposal and shortcut cleanup |
| `electron/history-clear-confirmation.js` | Shows a native warning dialog before clearing local history |
| `electron/assets/clipvault-template.png` | Monochrome macOS template image for the menu bar |
| `electron/preload.js` | Exposes the small, isolated `window.clipVault` API |
| `electron/ipc-contract.js` | Names the allowed channels and validates event payloads and sender frames |
| `electron/ipc-handlers.js` | Validates IPC senders and arguments, then routes app/history/capture requests |
| `electron/renderer-api.js` | Wraps `ipcRenderer.invoke` and manages safe event subscriptions |
| `electron/config.js` | Default capture interval, history count, and text-size limits |
| `electron/clipboard-monitor.js` | Clipboard baseline, polling, pause/resume and change detection |
| `electron/clipboard-history-store.js` | Serialized history operations and async local JSON persistence |
| `electron/snippet-store.js` | Snippet CRUD/search/pin operations and local JSON persistence |
| `electron/preferences-store.js` | Theme, history limit, and capture-on-launch preference persistence |
| `src/components/HistoryList.jsx` | Clipboard preview cards, timestamp, keyboard selection, copy and delete controls |
| `src/components/SnippetList.jsx` | Snippet preview, copy/edit/pin/delete controls |
| `src/components/SnippetEditor.jsx` | Validated snippet create/edit form |
| `src/components/SettingsPanel.jsx` | Theme, history size, privacy and clear-history settings |
| `src/main.jsx` | React entry point and global stylesheet import |
| `src/App.jsx` | Renderer state, API subscriptions, search, keyboard controls, appearance and screen switching |
| `src/index.css` | Tailwind layers and global page defaults |
| `tests/` | Node built-in tests for IPC, storage, capture, tray/popup/shortcut behavior and quit cleanup |
| `docs/` | Development record, architecture, API boundary, decisions, and viva explanation |

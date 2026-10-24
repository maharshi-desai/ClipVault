# Viva guide

## How the app starts

1. `npm run dev` starts Vite and waits until its local URL is ready.
2. Electron launches `electron/main.js`, acquires a single-instance lock, and after `app.whenReady()` initializes history and capture.
3. The menu bar controller creates one compact popup and tray item, registers `CommandOrControl+Shift+V`, and shows the popup.
4. The popup loads `preload.js` before the page. The preload exposes a small `window.clipVault` API using `contextBridge`.
5. React mounts at `src/main.jsx`; `src/App.jsx` requests history and capture status, then subscribes to new-entry/status events.

## Menu bar, popup, and shortcuts

`electron/menu-bar-controller.js` owns one popup and one tray. Tray clicks and the global shortcut use the same toggle function. Showing the popup repositions it below the tray, clamps it within the display work area, and focuses it. Escape, blur, and close hide the popup while leaving the tray process running. The tray menu can pause/resume capture, clear history, or quit. The macOS tray image is marked as a template image. If shortcut registration fails, the app remains usable from the tray and shows that the shortcut is unavailable.

`electron/app-lifecycle.js` handles quit: the first `before-quit` allows popup closure, destroys the tray, unregisters its shortcut, stops capture, then calls `app.quit()` again. The second quit proceeds; `will-quit` unregisters all shortcuts. A single-instance lock prevents a second app process; a second launch shows the existing popup.

## IPC request and response

`getAppInfo()` in the renderer calls the named preload method. Preload uses `ipcRenderer.invoke('clipvault:app:get-info')`. The main process has registered that channel with `ipcMain.handle`; before returning `{ name, version, platform }`, it checks the sender is an allowlisted window's main frame and that no arguments were supplied. Electron resolves the promise with the returned object, which React displays.

## Safe event subscription

The main process sends a fixed focus/blur payload on `clipvault:window:state-changed`. Preload listens to that channel and calls the renderer callback with only the validated state string. It does not pass the raw Electron event object. The subscription returns an unsubscribe function, and React calls it automatically when the component unmounts. The renderer cannot pick an arbitrary channel.

## Clipboard history flow

Electron's main process reads text with `clipboard.readText()` on a one-second timer while capture is enabled. Startup establishes a baseline first, so the text already in the clipboard is not saved automatically. A changed, non-empty text value within the configured character cap is sent to `ClipboardHistoryStore`. Exact text already in the retained history is ignored. New entries contain a UUID, text, and ISO timestamp, are capped at 500 entries by default, and are saved as JSON under Electron's `app.getPath('userData')` using async file operations.

When storage finishes successfully, main notifies React through the fixed `clipboardEntry` event. History reads/searches and copy/delete/clear actions use the narrow preload methods and validated main handlers. Clearing uses a native warning dialog; cancelling preserves history. A tray clear emits `history-cleared` so the renderer refreshes too. Copying an entry uses Electron's main-process `clipboard.writeText`. Pause clears the interval; resume takes a fresh baseline before restarting it. Quit stops the timer.

## Snippets, preferences, and appearance

Reusable snippets are saved in `userData/snippets.json` by `SnippetStore`. React can search, create/edit, pin, and delete snippets through explicit preload methods. Copying a snippet sends its ID to main; main reads the local snippet and writes it to the clipboard. The renderer never receives filesystem access.

`PreferencesStore` keeps the theme choice, history limit, and “resume capture at launch” setting in `userData/preferences.json`. A lower history limit removes oldest entries. Disabling automatic capture resume leaves capture paused on the next launch.

The renderer requests the appearance through `getAppearance()`. Main sets `nativeTheme.themeSource` to `system`, `light`, or `dark`; Electron's `nativeTheme.updated` event is validated and forwarded through the preload subscription. React adds or removes the root `dark` class and the CSS variables supply the matching palette. The search field focuses on popup focus. Up/Down selects a result, Enter copies it, and Escape dismisses the editor/settings/search before hiding the popup.

The main files are `electron/config.js` (limits), `electron/clipboard-monitor.js` (polling/baseline), `electron/clipboard-history-store.js` (local JSON/history operations), `electron/menu-bar-controller.js` (tray/popup/shortcut), `electron/app-lifecycle.js` (quit cleanup), `electron/ipc-contract.js` and `electron/ipc-handlers.js` (channels and validation), `electron/renderer-api.js` and `electron/preload.js` (safe bridge), and `src/App.jsx` (history interface).

## Production flow

`npm run build` bundles the renderer into `dist/`. Packaged Electron loads `dist/index.html`. `npm run dist:mac` builds the renderer and asks electron-builder to create a DMG.

## Security explanation

Context isolation keeps the page's JavaScript environment separate from Electron's preload environment. Disabling Node integration prevents renderer code from importing Node modules. A narrow preload bridge is the intended way to add desktop capabilities. The main process also validates request senders and arguments.

## Scope

Important communication files: `electron/main.js` registers handlers and emits window events; `electron/ipc-contract.js` defines the allowed channel names and payload check; `electron/ipc-handlers.js` validates and serves the request; `electron/renderer-api.js` wraps the limited renderer operations; `electron/preload.js` exposes them; and `src/App.jsx` demonstrates their use. `tests/ipc.test.js` covers the API behavior using Node's built-in test runner.

Clipboard history is local and not automatically encrypted. It can include sensitive text; the interface makes capture state visible, provides pause/resume and clear-history controls, and warns users about local storage privacy. Monitoring and file operations stay in the main process; no clipboard data is uploaded to a remote server.

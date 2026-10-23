# Architecture

ClipVault is split into a renderer and a desktop shell.

- **Renderer (`src/`)**: React components and JSX are built by Vite. Tailwind utilities are processed by PostCSS.
- **Main process (`electron/main.js`)**: creates the native window and chooses the Vite server in development or built `dist/index.html` in packaged mode.
- **Preload (`electron/preload.js`)**: exposes a deliberately small `window.clipVault` API through Electron's `contextBridge`.
- **Build/package**: `npm run build` creates the frontend in `dist/`; electron-builder packages the app as a macOS DMG using `npm run dist:mac`.

The renderer has no direct Node.js access (`nodeIntegration: false`). Context isolation is enabled. Extend privileged behavior in the main process and expose narrow, reviewed functions through preload when needed. Clipboard monitoring is intentionally out of scope.

## Request-response and event flow

1. React calls `window.clipVault.getAppInfo()`; this public method invokes the fixed `clipvault:app:get-info` channel.
2. `electron/main.js` registers an `ipcMain.handle` listener. It checks that the call came from a BrowserWindow's main frame whose WebContents is in the app's allowlist, and rejects any arguments.
3. The main process returns only the app name, version, and platform. Electron resolves the `ipcRenderer.invoke` promise, and React displays those values.
4. The preload's `onWindowStateChanged(callback)` subscribes only to `clipvault:window:state-changed`. It checks the payload, passes only `focused` or `blurred` to the callback, and never forwards Electron's event object.
5. The subscription returns an idempotent unsubscribe function. React returns it from `useEffect`, so unmounting removes the IPC listener.

The IPC channel names and state payload check live in `electron/ipc-contract.js`; the request handler and sender validation are in `electron/ipc-handlers.js`; the limited renderer-facing methods are assembled in `electron/renderer-api.js` and exposed by `electron/preload.js`.

## Important files

| File | Purpose |
| --- | --- |
| `package.json` | Dependencies, npm commands, Electron entry point, and macOS DMG packaging settings |
| `vite.config.js` | React plugin, renderer base path, and local development server settings |
| `tailwind.config.js` / `postcss.config.js` | Tailwind source scanning and CSS processing |
| `index.html` | HTML shell Vite loads and React mounts into |
| `electron/main.js` | Creates the desktop window and switches between dev and built renderer |
| `electron/preload.js` | Exposes the small, isolated `window.clipVault` API |
| `electron/ipc-contract.js` | Names the allowed channels and validates event payloads and sender frames |
| `electron/ipc-handlers.js` | Validates the app info request and returns safe app metadata |
| `electron/renderer-api.js` | Wraps `ipcRenderer.invoke` and manages safe event subscriptions |
| `src/main.jsx` | React entry point and global stylesheet import |
| `src/App.jsx` | Starter UI and example app-info request/event subscription |
| `src/index.css` | Tailwind layers and global page defaults |
| `tests/ipc.test.js` | Node built-in tests for validation and renderer API behavior |
| `docs/` | Development record, architecture, API boundary, decisions, and viva explanation |

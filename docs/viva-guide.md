# Viva guide

## How the app starts

1. `npm run dev` starts Vite and waits until its local URL is ready.
2. Electron launches `electron/main.js`, which creates a `BrowserWindow` and loads the Vite URL.
3. The window loads `preload.js` before the page. The preload exposes a small API using `contextBridge`.
4. React mounts at `src/main.jsx`; `src/App.jsx` renders the starter screen.

## Production flow

`npm run build` bundles the renderer into `dist/`. Packaged Electron loads `dist/index.html`. `npm run dist:mac` builds the renderer and asks electron-builder to create a DMG.

## Security explanation

Context isolation keeps the page's JavaScript environment separate from Electron's preload environment. Disabling Node integration prevents renderer code from importing Node modules. A narrow preload bridge is the intended way to add desktop capabilities.

## Scope

This is the foundation phase only. The sample clip cards are static UI; there is no clipboard monitoring or persistence yet.

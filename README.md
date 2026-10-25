# ClipVault

ClipVault is a menu bar-first macOS clipboard utility built with Electron, React, Vite, JavaScript/JSX, and Tailwind CSS. Clipboard monitoring, history, snippets, and preferences run locally on the device.

## Implemented

- Searchable clipboard history with copy, delete, and confirmed clear actions.
- One-second clipboard polling by default, pause/resume controls, startup/resume baselines, and a 500-entry default limit. Empty and oversized text is ignored; exact duplicates already in history are skipped.
- Persistent reusable snippets with create, edit, search, pin, copy, and delete operations.
- A compact popup, menu bar tray, global shortcut (`Command+Shift+V` on macOS), focus and hide behavior, and shortcut-registration failure handling.
- Light, dark, and system appearance settings; capture-on-startup and history-limit preferences.
- Generic native snippet-saved notifications and a fixed project-documentation link.
- Validated IPC, a limited `window.clipVault` preload API, isolated renderer, and local JSON storage with atomic replacement.

## Requirements and setup

Use a current Node.js release supported by the installed Vite and Electron versions, plus npm. Native menu bar, dialog, notification, and shortcut behavior requires a desktop session. macOS-specific behavior must be checked on macOS.

```sh
npm install
npm run dev
```

Run the JavaScript test suite and build the production renderer:

```sh
npm test
npm run build
```

`npm run build` writes the Vite frontend to `dist/`. `npm run dev` starts Vite and launches Electron after the development server is available. Open the app through Electron; opening the Vite URL in a regular browser does not provide the preload API and will show a desktop-services error.

The release command builds an Apple Silicon DMG:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
```

It runs the Vite build and `electron-builder --mac dmg --arm64`. The app bundle uses identifier `com.clipvault.desktop`, version `1.0.0`, and the macOS icon at `electron/assets/clipvault.icns`. The tested artifact is `release/ClipVault-1.0.0-arm64.dmg`. It is unsigned and not notarized; Gatekeeper assessment rejects it, so it is suitable for local verification but not ready for friction-free public distribution. Intel Macs are not supported by this arm64 artifact. See [`docs/development-log.md`](docs/development-log.md) for the measured artifact size and release checks.

## Privacy and storage

Clipboard history can contain sensitive information. It is saved as local JSON under Electron's `userData` directory and is **not automatically encrypted**. ClipVault does not send clipboard data to a remote server and does not log clipboard text. Pause capture when needed, disable capture on startup in settings, or clear the history. Snippets and preferences are also stored locally.

Defaults are a 1,000 ms polling interval, 500 history entries, and a 25,000-character per-item limit. The main-process values can be adjusted with `CLIPVAULT_POLL_INTERVAL_MS`, `CLIPVAULT_HISTORY_LIMIT`, and `CLIPVAULT_MAX_TEXT_CHARS` (bounded by safety caps).

## Project structure

```text
electron/       Electron main process, IPC, stores, preload, tray and lifecycle
src/            React JSX interface and Tailwind styles
tests/          Node built-in JavaScript tests
docs/           Architecture, decisions, API map, development log and test checklist
index.html      Vite renderer entry
vite.config.js  Vite and React configuration
package.json    Dependencies, commands and Electron Builder configuration
```

Important modules include `electron/main.js` (application composition), `electron/menu-bar-controller.js` (tray and popup), `electron/preload.js` and `electron/renderer-api.js` (secure renderer capabilities), `electron/ipc-handlers.js` (validated requests), `electron/clipboard-monitor.js` (capture), and the history/snippet/preferences stores. React views live in `src/App.jsx` and `src/components/`.

See [architecture](docs/architecture.md), [Electron API map](docs/electron-api-map.md), [decisions](docs/decisions.md), [testing checklist](docs/testing.md), and [development log](docs/development-log.md).

## Security and current limitations

Context isolation is enabled and Node integration is disabled. Renderer code uses only the named preload API; main-process handlers validate the sender frame and arguments. External navigation is restricted and the documentation action accepts no user-supplied URL. The preload currently uses `sandbox: false` because it imports the local CommonJS API module; this is a defense-in-depth limitation documented in the architecture and decisions.

Automated Electron tests mock native APIs and cannot prove macOS delivery/behavior. Use [docs/testing.md](docs/testing.md) to verify the actual desktop app. There is no configured lint script or linter. Clipboard history and preferences are not encrypted at rest. No remote sync, rich clipboard formats, image capture, or cloud backup is implemented.

# ClipVault

ClipVault is a desktop clipboard history app built with React, Vite, JavaScript/JSX, Tailwind CSS, and Electron. Clipboard text is monitored and stored locally by the Electron main process.

## Requirements

- Node.js and npm
- macOS for building the configured DMG installer

## Getting started

Install dependencies:

```sh
npm install
```

Start the Vite development server and Electron window together:

```sh
npm run dev
```

Build the renderer for production:

```sh
npm run build
```

Run the JavaScript test suite:

```sh
npm test
```

Package the app as a macOS DMG:

```sh
npm run dist:mac
```

The frontend build is written to `dist/`. DMG output is written to `release/`. Signing and notarization are not configured and require release credentials.

## Project structure

```text
electron/       Electron main process and preload bridge
src/            React renderer, styles, and feature folders
docs/           Architecture, development notes, decisions, and viva guide
index.html      Vite HTML entry point
vite.config.js  Vite and React configuration
tailwind.config.js
postcss.config.js
```

### Important files

- `electron/main.js` creates the desktop window and loads the Vite server in development or `dist/index.html` in production.
- `electron/preload.js` exposes the narrow `window.clipVault` API to the renderer.
- `electron/clipboard-monitor.js` polls the system clipboard, maintains the startup/resume baseline, and supports pause/resume.
- `electron/clipboard-history-store.js` searches and mutates the JSON history under Electron's user data folder.
- `electron/config.js` holds capture interval, history count, and clipboard-text limits.
- `src/main.jsx` mounts React and loads the global stylesheet.
- `src/App.jsx` displays history and provides search, copy, delete, clear, and capture controls.
- `src/index.css` includes Tailwind layers and global page defaults.
- `package.json` defines dependencies, npm scripts, and electron-builder's DMG target.

## Electron security

The renderer runs with `contextIsolation: true` and `nodeIntegration: false`. Renderer code does not import Node.js or Electron APIs directly. Add future desktop capabilities through a narrow preload API and matching main-process handlers.

## Privacy and scope

Clipboard history may contain sensitive information. It is stored locally as JSON and is not automatically encrypted. The interface displays capture status and provides pause/resume and clear-history controls. Clipboard content is not sent to a remote server.

Capture defaults to a one-second polling interval, 500 history entries, and a 25,000-character text limit. You can override these defaults with `CLIPVAULT_POLL_INTERVAL_MS`, `CLIPVAULT_HISTORY_LIMIT`, and `CLIPVAULT_MAX_TEXT_CHARS`.

For development details and the architecture overview, see [`docs/development-log.md`](docs/development-log.md), [`docs/architecture.md`](docs/architecture.md), and [`docs/viva-guide.md`](docs/viva-guide.md).

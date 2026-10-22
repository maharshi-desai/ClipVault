# ClipVault

ClipVault is a starter desktop app built with React, Vite, JavaScript/JSX, Tailwind CSS, and Electron. It provides a basic desktop window and a static sample interface to build on.

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
- `src/main.jsx` mounts React and loads the global stylesheet.
- `src/App.jsx` contains the starter interface.
- `src/index.css` includes Tailwind layers and global page defaults.
- `package.json` defines dependencies, npm scripts, and electron-builder's DMG target.

## Electron security

The renderer runs with `contextIsolation: true` and `nodeIntegration: false`. Renderer code does not import Node.js or Electron APIs directly. Add future desktop capabilities through a narrow preload API and matching main-process handlers.

## Current scope

This is the initial foundation phase. The sample clip cards are static. Clipboard monitoring, clipboard access, and persistence have not been added.

For development details and the architecture overview, see [`docs/development-log.md`](docs/development-log.md), [`docs/architecture.md`](docs/architecture.md), and [`docs/viva-guide.md`](docs/viva-guide.md).

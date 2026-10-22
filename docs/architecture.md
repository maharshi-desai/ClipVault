# Architecture

ClipVault is split into a renderer and a desktop shell.

- **Renderer (`src/`)**: React components and JSX are built by Vite. Tailwind utilities are processed by PostCSS.
- **Main process (`electron/main.js`)**: creates the native window and chooses the Vite server in development or built `dist/index.html` in packaged mode.
- **Preload (`electron/preload.js`)**: exposes a deliberately small `window.clipVault` API through Electron's `contextBridge`.
- **Build/package**: `npm run build` creates the frontend in `dist/`; electron-builder packages the app as a macOS DMG using `npm run dist:mac`.

The renderer has no direct Node.js access (`nodeIntegration: false`). Context isolation is enabled. Extend privileged behavior in the main process and expose narrow, reviewed functions through preload when needed. Clipboard monitoring is intentionally out of scope for this phase.

## Important files

| File | Purpose |
| --- | --- |
| `package.json` | Dependencies, npm commands, Electron entry point, and macOS DMG packaging settings |
| `vite.config.js` | React plugin, renderer base path, and local development server settings |
| `tailwind.config.js` / `postcss.config.js` | Tailwind source scanning and CSS processing |
| `index.html` | HTML shell Vite loads and React mounts into |
| `electron/main.js` | Creates the desktop window and switches between dev and built renderer |
| `electron/preload.js` | Defines the small, isolated renderer API |
| `src/main.jsx` | React entry point and global stylesheet import |
| `src/App.jsx` | Starter ClipVault interface |
| `src/index.css` | Tailwind layers and global page defaults |
| `docs/` | Development record, architecture, API boundary, decisions, and viva explanation |

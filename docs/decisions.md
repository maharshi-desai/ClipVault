# Decisions

- **JavaScript and JSX only:** application code uses `.js` and `.jsx`; no TypeScript dependency or source file is used.
- **Vite + React:** fast local renderer serving and a simple static production bundle.
- **CommonJS in Electron entry files:** `main.js` and `preload.js` run directly in Electron without an extra transpilation step.
- **Tailwind CSS 3:** configured with PostCSS for a small, explicit setup.
- **Electron security defaults:** context isolation is on and Node integration is off; renderer receives only a small preload API.
- **No clipboard monitoring:** deliberately deferred to a later phase.
- **macOS packaging:** electron-builder targets DMG output. Signing and notarization depend on release credentials and are not configured here.

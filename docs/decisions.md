# Decisions

- **JavaScript and JSX only:** application code uses `.js` and `.jsx`; no TypeScript dependency or source file is used.
- **Vite + React:** fast local renderer serving and a simple static production bundle.
- **CommonJS in Electron entry files:** `main.js` and `preload.js` run directly in Electron without an extra transpilation step.
- **Tailwind CSS 3:** configured with PostCSS for a small, explicit setup.
- **Electron security defaults:** context isolation is on and Node integration is off; renderer receives only a small preload API.
- **Preload tradeoff:** `sandbox: false` is required by the current preload's local CommonJS import of `renderer-api.js`. The renderer still has context isolation, disabled Node integration, validated IPC, and a narrow bridge; enabling sandbox again requires bundling or inlining the preload API. Treat sandbox disablement as a remaining defense-in-depth concern.
- **Menu bar-first interaction:** one compact popup is reused from tray and shortcut actions; closing it hides the window and leaves the tray process available.
- **Global shortcut:** use `CommandOrControl+Shift+V`; registration failure does not prevent tray use and is shown in the tray menu/tooltip.
- **Native clear confirmation:** clear-history requests use Electron's native warning dialog from both renderer and tray actions.
- **Local snippets and preferences:** reusable snippets and user settings use separate JSON files under `app.getPath('userData')`; filesystem access stays in the main process.
- **Native appearance preference:** `nativeTheme.themeSource` follows the user's system, light, or dark setting, and the validated appearance event updates the renderer root theme.
- **Notifications:** snippet saves use a generic native notification that excludes snippet and clipboard content; unsupported notification environments do not fail the save operation.
- **External links:** the documentation action takes no renderer URL and opens only a fixed, reviewed project README URL. Popup navigation and new-window creation are restricted.
- **Manual verification:** mocked tests establish application logic, not native macOS delivery/behavior. `docs/testing.md` tracks the macOS checks without assuming they have been run.
- **macOS packaging:** electron-builder targets an arm64 DMG for the Apple Silicon build host. Vite output is `dist/`; electron-builder artifacts go to `release/`. React, React DOM, and Lucide are development/build dependencies because Vite bundles them into the frontend; the Electron main process has no third-party production dependencies. The app icon is generated from the maintained SVG source into `.icns` for the bundle.
- **Release signing:** this verification build disables identity discovery and is unsigned/not notarized. A Developer ID certificate and Apple notarization credentials are required before public distribution; do not store those credentials in the repository.

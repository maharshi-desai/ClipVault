# Development log

## 2026-10-23 — Initial desktop scaffold

- Created the React and JSX renderer with Vite as the development server and production frontend bundler.
- Added an Electron main process and a minimal isolated preload bridge.
- Added Tailwind CSS 3 through PostCSS and a small responsive starter screen.
- Added npm scripts for development, frontend builds, and macOS DMG packaging.
- No clipboard monitoring or clipboard read/write behavior has been added.

### Commands and results

- `npm install` — completed; 409 packages installed. npm reported 15 audit findings (10 moderate, 5 high).
- `npm run build` — completed with Vite 8.3.5. Output: `dist/index.html` (0.44 kB), CSS (9.14 kB), and JS (228.87 kB); build took 499 ms.
- `npm run dev` — Vite served at `http://127.0.0.1:5173/` with HTTP 200, and the Electron process launched. The development command was stopped cleanly after verification.

The successful build emitted Vite configuration loader and PostCSS module type warnings. They did not prevent the build. No DMG was created because this phase requested a frontend production build, not a packaged installer.

## 2026-10-23 — Secure Electron communication

- Added a fixed app-info request channel implemented with `ipcMain.handle` and `ipcRenderer.invoke`.
- Main validates that requests come from a known window's main frame and rejects unexpected arguments.
- Preload exposes only `getAppInfo()` and `onWindowStateChanged(callback)` on `window.clipVault`; raw `ipcRenderer` and Node APIs remain private.
- Added a focus/blur subscription that validates payloads, hides the Electron event object, and returns an idempotent unsubscribe function. React cleans it up from `useEffect`.
- Added JavaScript tests with Node's built-in test runner and updated the architecture and API map.
- `npm test` — passed: 7 tests, 0 failures. Coverage includes app-info response shape, argument rejection, sender/frame and allowlist rejection, fixed-channel invocation, event filtering, callback validation, and idempotent unsubscription.
- `npm run build` — passed with Vite 8.3.5; generated `dist/index.html`, CSS (9.14 kB), and JS (229.28 kB). Existing Vite config-loader and PostCSS module-type warnings remain non-fatal.

## 2026-10-23 — Phase 3: Clipboard engine and local storage

- Added main-process text polling with a startup/resume baseline, a one-second default interval, pause/resume controls, a 25,000-character default entry cap, and an environment-configurable history limit of 500 by default.
- Added a serialized asynchronous JSON store under Electron's `userData` directory. It uses UUIDs and ISO timestamps, skips exact duplicate text, keeps newest entries first, and writes only on history changes.
- Added IPC methods for history retrieval/search/copy/delete/clear and capture status/pause/resume. Main validates sender, argument count, query size, and entry IDs. Preload event subscriptions validate/sanitize payloads and return unsubscribe functions.
- Added the React history screen with live new-entry updates, search, copy/delete/clear actions, capture status/pause-resume controls, and a privacy warning.
- Added tests for history behavior, duplicate handling, limits, paused capture, IPC argument validation, and storage errors/corruption.
- `npm test` — passed: 26 tests, 0 failures.
- `node --check` — passed for all Electron JavaScript entry/modules.
- `npm run build` — passed with Vite 8.3.5; generated `dist/index.html`, CSS (10.53 kB), and JS (234.30 kB). The existing Vite config-loader and PostCSS module-type warnings remain non-fatal.
- Lint — unavailable: this project has no lint script or configured linter.
- Final Phase 3 review: confirmed pause/quit timer cleanup, resume baselining, trusted-frame IPC checks, event unsubscription, local-only handling, and temporary-file rename writes. Added a regression test that simulates a failed atomic rename and verifies the prior JSON history stays readable and the temporary file is cleaned up. No live clipboard test was run during this review.

## 2026-10-23 — Phase 4: Menu bar-first macOS interaction

- Added a single-instance application lock and a menu bar controller that creates one compact popup window, positions it below the tray inside the active display work area, and reuses/focuses it rather than creating duplicates.
- Added a monochrome clipboard tray PNG and mark it as a macOS template image. The tray menu shows the popup, pauses/resumes capture, clears history after native confirmation, and quits the app.
- Registered `CommandOrControl+Shift+V` to toggle the popup. Registration errors/false returns are handled; the tray tooltip/menu indicate when the shortcut is unavailable. The shortcut and tray are cleaned up during quit.
- Popup blur, Escape, or close hides it while leaving the tray application running. macOS `activate` and a second app launch show the existing popup. The native clear confirmation is shared between renderer and tray requests, and the renderer refreshes from a narrow clear-notification event.
- Added mocked Electron tests for popup singleton/position/focus/close, tray actions, shortcut failure/cleanup, native clear confirmation/cancellation, and app quit ordering. These tests do not validate native macOS rendering or permissions.
- `npm test` — passed: 34 tests, 0 failures. `npm run build` — passed with Vite 8.3.5; existing Vite config-loader and PostCSS module-type warnings remain non-fatal. `node --check` passed for the changed Electron modules; `git diff --check` passed.
- Development launch check: `npm run dev` reached Vite ready, returned HTTP 200 for the renderer, and the ClipVault Electron process was present. Native tray/window interaction could not be observed because the Mac desktop was locked and the computer-use tool could not unlock it; no claim of manual shortcut/menu interaction is made.

## 2026-10-24 — Full utility interface and user preferences

- Replaced the starter history screen with a compact React/Tailwind interface for searchable clip history, timestamps/previews, copy/delete, snippets, capture state, settings, loading/empty/error feedback, and keyboard navigation.
- Added reusable snippet create/edit/search/pin/copy/delete operations with main-process JSON persistence. Snippet copy accepts a validated ID; renderer never receives clipboard or filesystem APIs.
- Added persisted appearance/history/privacy preferences. Electron `nativeTheme` handles system/light/dark modes and broadcasts effective appearance changes; history-limit changes trim oldest items, and capture-on-launch can be disabled.
- Added `window.clipVault` methods/events for snippets, preferences, appearance, and popup close. Clear history remains behind a native Electron confirmation.
- Added tests for snippet persistence/CRUD/search/pinning, preferences persistence/recovery, validated IPC operations, and appearance event filtering/unsubscribe.
- `npm test` — passed: 41 tests, 0 failures. `npm run build` — passed with Vite 8.3.5; the existing Vite config-loader and PostCSS module-type warnings remain non-fatal. Changed Electron modules passed `node --check`; `git diff --check` passed.
- Live macOS visual check: the popup, capture status, preferences, system/light appearance controls, snippets empty state, and snippet create/delete were exercised. The first launch showed an unavailable bridge because the sandboxed preload could not load its local CommonJS API module. Disabled the preload sandbox while retaining `contextIsolation: true`, `nodeIntegration: false`, and the named contextBridge surface; after restart the renderer connected and showed the live capture status. No clipboard text capture action was manually checked in this visual pass.
- After the preload correction, `npm test` passed again (41 tests), `npm run build` passed, and the development UI was relaunched successfully.

## 2026-10-24 — Required Electron API audit

- Audited the project against the required Electron APIs. Existing APIs were in use for lifecycle, popup, IPC, bridge, tray, shortcuts, menu, dialogs, clipboard and native appearance. Added missing `Notification` and `shell` features.
- Added a generic native “Snippet saved” notification; it never includes snippet or clipboard text, clicking it shows the popup, and unsupported OS notifications do not interrupt saving.
- Added an argument-free Preferences action that opens only the fixed approved GitHub README URL through a validated IPC handler. The renderer cannot submit arbitrary URLs.
- Added popup protections that deny all new windows and cancel top-level navigation outside the configured Vite dev origin or exact packaged renderer file.
- Added `docs/electron-api-checklist.md` mapping each API to its production function, purpose, user behavior and verification limits; updated the API map.
- `npm test` — passed: 46 tests, 0 failures. `npm run build` — passed with Vite 8.3.5. `node --check` passed for changed Electron modules; `git diff --check` passed. Native OS notification delivery and external browser launch remain platform behaviors not covered by mocks.

## 2026-10-24 — Phase 7: Testing, documentation, and quality audit

- Reviewed the existing tests, IPC contract, renderer bridge, storage modules, tray controller, and project documentation before making changes.
- Added regression tests that statically check the React renderer does not import Electron/Node built-ins, verify the preload only exposes the named API, and confirm repeated menu-bar initialization does not register duplicate windows/trays/shortcuts.
- Expanded README.md with implemented features, install/dev/test/build commands, project layout, privacy and known limits. Updated architecture, decisions, and API map to reflect native notification/link handling, navigation restrictions, preload sandbox tradeoff, and test limits.
- Added `docs/testing.md` with an unchecked macOS checklist. Prior visual checks are recorded separately; unperformed native tray, shortcut, capture, dialogs, notification, browser-link and quit checks remain unchecked.
- `npm test` — passed: 49 tests, 0 failures.
- `node --check electron/*.js` (loop over all Electron modules) — passed: 15 JavaScript files.
- TypeScript-file absence check — passed; no `.ts` or `.tsx` files were found outside dependency and Git folders.
- `npm run build` — passed with Vite 8.3.5; generated `dist/index.html`, 14.28 kB CSS, and 252.29 kB JavaScript (78.22 kB gzip).
- `git diff --check` — passed. Linting — unavailable; `package.json` has no lint script and no configured linter.
- Build emitted non-fatal Vite native config-loader and PostCSS module-type warnings. No source change was made to silence them because changing package module mode could affect Electron's CommonJS entry points.
- No DMG packaging command was run. Automated tests mock native APIs; manual macOS checks are listed but remain outstanding apart from the previously recorded popup/theme/snippet visual pass.

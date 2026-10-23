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
- Added JavaScript tests with Node's built-in test runner and updated the architecture, API map, and viva guide.
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

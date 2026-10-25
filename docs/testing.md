# ClipVault testing

This document separates automated checks from manual macOS checks. Automated tests use Node's built-in test runner and mocked Electron interfaces; they do not verify native OS behavior. The boxes below are deliberately unchecked. Check an item only after carrying it out on the target Mac.

## Automated tests

Run from the repository root:

```sh
npm test
npm run build
```

The suite covers clipboard history add/search/duplicate/limit/delete/clear, empty and oversized values, missing/corrupt/unreadable storage, atomic-write failure, capture baseline/pause/resume/stop, snippet CRUD/search/pinning/reload/validation, preference persistence and recovery, IPC validation and sender checks, preload event filtering/unsubscription, renderer security boundaries, popup singleton/placement/focus, tray actions, shortcut failure/cleanup, native clear confirmation, notifications, and quit lifecycle.

`npm test` is not a substitute for running the Electron app. `npm run build` builds the React renderer only; it does not package a macOS installer.

## Manual macOS checklist

Run `npm run dev` from a logged-in macOS desktop session and test in the Electron popup. Opening `http://127.0.0.1:5173` in Chrome or another ordinary browser does not load the Electron preload bridge.

### Tray and popup

- [ ] Confirm the ClipVault template icon appears in the menu bar and adapts to light/dark menu bar appearance.
- [ ] Click the tray icon; confirm it toggles the popup.
- [ ] Open the tray menu and verify Show, Pause/Resume Capture, Clear History, and Quit actions.
- [ ] Press `Command+Shift+V`; verify the popup toggles. If another app owns the shortcut, verify the tray remains usable and reports the shortcut unavailable.
- [ ] Open the popup repeatedly from the tray, shortcut, and app activation; confirm only one popup exists.
- [ ] Confirm opening focuses the popup and places it near the tray within the display work area, including near screen edges.
- [ ] Click outside, press Escape, and use the window close control; confirm the popup hides and the tray app remains available.
- [ ] Reopen after hiding and confirm the existing window is reused.

### Clipboard capture and history

- [ ] Start with known clipboard text and launch; confirm the startup baseline is not added as a new entry.
- [ ] Copy new plain text; confirm one history item appears with a timestamp and preview.
- [ ] Copy the same text again; confirm an exact duplicate already in history is not added.
- [ ] Pause capture from the UI and tray; copy text while paused; confirm it is not recorded.
- [ ] Resume capture; confirm text copied during the pause is not recorded, then copy fresh text and confirm it is recorded.
- [ ] Copy empty text and text larger than the configured limit; confirm neither is recorded.
- [ ] Restart the app and verify prior history is still present.
- [ ] Search by full and partial text, including different letter case.
- [ ] Copy a history row and paste into a safe text editor; verify the selected text is restored.
- [ ] Delete one row; confirm other entries remain. Clear history and test both cancel and confirm in the native dialog.
- [ ] Change the history limit and confirm the displayed/status value updates and excess oldest entries are removed.

### Snippets and preferences

- [ ] Create a snippet; verify a generic native “Snippet saved” notification does not reveal its content.
- [ ] Edit the snippet, pin/unpin it, search it, copy it to a safe text editor, and delete it.
- [ ] Restart and verify snippets and preferences persist.
- [ ] Try empty/whitespace-only snippet fields and confirm validation prevents saving.
- [ ] Select Light, Dark, and System appearance; confirm the interface follows each choice and System tracks macOS appearance changes.
- [ ] Toggle capture-on-startup off, quit and relaunch; confirm capture starts paused. Turn it back on and verify next launch behavior.

### Native integration, lifecycle, and privacy

- [ ] Verify clear-history native confirmation works from the renderer and tray; cancel preserves data.
- [ ] Verify a notification click reopens/focuses ClipVault. macOS notification settings may affect delivery.
- [ ] Use the documentation action and confirm it opens only the approved ClipVault GitHub README in the external browser.
- [ ] Quit using the tray menu; confirm the tray disappears, polling stops, and the global shortcut is released. Relaunch and confirm it can register again.
- [ ] Confirm clipboard content is not printed in terminal logs and no clipboard data is sent over the network.
- [ ] Confirm capture status is visible and pause/resume is readily available.
- [ ] Confirm the UI warns that local clipboard history can contain sensitive data and local JSON storage is not automatically encrypted.
- [ ] Attempt to open an external link from the popup; confirm it is blocked rather than navigating the app window.
- [ ] Confirm the renderer is running in Electron and only `window.clipVault` is available for desktop operations; direct Node/Electron imports are not part of the React UI.

## Manual check record

No manual checks are marked complete by this checklist. A prior visual development check confirmed that the popup loaded, capture status appeared, appearance controls changed the theme, and a temporary snippet could be created and deleted. That check did not exercise live clipboard capture, tray menu, global shortcut, native confirmation, notification delivery, external browser launch, or quit cleanup. Re-run the checklist against the current revision before treating those behaviors as verified.

# Electron API checklist

This checklist maps each required Electron API to production code and a visible user behavior. “Verified” means source review or an automated mock test; native macOS behavior is called out separately below.

| API | Production file and function | Purpose | User-facing behavior | Verification |
| --- | --- | --- | --- | --- |
| `app` | `electron/main.js`: `app.whenReady()`, `requestSingleInstanceLock()`, `getPath()`; `electron/app-lifecycle.js`: `installAppQuitLifecycle()` | Starts one app, chooses local storage, handles macOS activation and orderly quit | Launch shows one menu bar popup; second launch focuses it; Quit stops capture and releases tray/shortcut | Lifecycle and tray tests use Electron mocks; app was previously launched on macOS |
| `BrowserWindow` | `electron/menu-bar-controller.js`: `createPopupWindow()`, `showPopup()`, `positionPopup()` | Creates and reuses the compact renderer window | Tray/shortcut shows the same focused, repositioned popup | `tests/menu-bar-controller.test.js` |
| `ipcMain` | `electron/ipc-handlers.js`: `registerIpcHandlers()` | Validates trusted main-frame senders and arguments before serving requests | History, snippets, preferences, capture controls, documentation link, and clear requests work through named handlers | `tests/ipc.test.js`, `tests/feature-ipc.test.js` |
| `ipcRenderer` | `electron/renderer-api.js`: `createRendererApi()` | Invokes only fixed IPC channels and receives sanitized events | React calls `window.clipVault` operations without Electron imports | `tests/ipc.test.js` |
| `contextBridge` | `electron/preload.js`: `contextBridge.exposeInMainWorld()` | Exposes a frozen named capability API | Renderer sees `window.clipVault`, not raw IPC or filesystem access | Preload source review plus renderer API shape/subscription tests |
| `Tray` | `electron/menu-bar-controller.js`: `createTray()` | Creates the macOS template icon and handles tray clicks/menu | Click toggles the popup; right-click opens app actions | `tests/menu-bar-controller.test.js`; native icon appearance needs macOS visual validation |
| `globalShortcut` | `electron/menu-bar-controller.js`: `initialize()`, `dispose()`; `electron/app-lifecycle.js` cleans up | Registers and releases `CommandOrControl+Shift+V` | Shortcut toggles the popup; registration failure is shown in tray tooltip/menu | `tests/menu-bar-controller.test.js` |
| `Menu` | `electron/menu-bar-controller.js`: `buildTrayMenu()` | Builds app actions for the menu bar | Show, pause/resume, clear, and quit are available from the tray menu | `tests/menu-bar-controller.test.js` |
| `Notification` | `electron/native-notifications.js`: `showSnippetSaved()` | Shows a generic native confirmation after a snippet is saved | “Snippet saved” notification appears without snippet or clipboard text; clicking it reopens ClipVault | `tests/native-notifications.test.js`; OS delivery requires native macOS check |
| `dialog` | `electron/history-clear-confirmation.js`: `confirmAndClearHistory()` | Requests native confirmation before permanent history removal | Clear is applied only after confirmation; cancel preserves history | Confirmation tests and tray tests; actual dialog appearance is platform-dependent |
| `clipboard` | `electron/clipboard-monitor.js`: `poll()`; `electron/ipc-handlers.js`: history/snippet copy handlers | Reads changed text in main and writes selected saved text back | New text is captured while enabled; Copy restores a selected history item or snippet | `tests/clipboard-monitor.test.js`, IPC/store tests; manual live text-capture test is separate |
| `nativeTheme` | `electron/main.js`: theme setup and `nativeTheme.updated` listener | Applies system/light/dark source and broadcasts effective appearance | System mode follows macOS appearance; Light and Dark can be selected in Preferences | Preference tests and prior live theme switch |
| `shell` | `electron/ipc-handlers.js`: `openProjectDocumentation` handler; `electron/approved-links.js`: fixed destination | Opens only the approved ClipVault README URL externally | Preferences has an “Open project documentation” action | IPC test checks the exact fixed URL; browser launch is not automated |

## IPC and navigation safeguards

- The renderer never supplies an external URL. The documentation handler accepts no arguments and calls `shell.openExternal()` only with the constant in `electron/approved-links.js`.
- The popup denies all new windows with `setWindowOpenHandler()` and cancels top-level navigation outside the exact packaged renderer file or the configured Vite development origin.
- IPC methods are named wrappers. Main checks the WebContents allowlist, main frame, argument count, and each operation’s data shape.
- The window keeps `contextIsolation: true` and `nodeIntegration: false`. `sandbox: false` is currently needed because `electron/preload.js` imports the local CommonJS `renderer-api.js`; the renderer still receives no Node APIs, but this removes Electron's preload sandbox defense-in-depth.
- Notifications contain no snippet or clipboard text. Clipboard data remains local and no remote service is used.

## Verification limits

Node tests mock Electron APIs. They establish routing, fixed URL selection, input validation, event cleanup, and notification content, but they do not prove that macOS actually displays notifications, tray menus, native dialogs, shortcut permission prompts, or clipboard behavior on every OS release. Those need a real desktop run.

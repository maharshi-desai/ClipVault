# Electron API map

| Location | Responsibility | Current surface |
| --- | --- | --- |
| `electron/main.js` | Window lifecycle, dev/production loading | `BrowserWindow`, `app` |
| `electron/preload.js` | Safe bridge between renderer and Electron | `window.clipVault.getAppVersion()` |
| `src/` | User interface | No direct Electron or Node imports |

Security settings on the window: `contextIsolation: true`, `nodeIntegration: false`. Keep the bridge narrow; add IPC handlers and matching preload methods only for concrete features. No clipboard APIs are exposed.

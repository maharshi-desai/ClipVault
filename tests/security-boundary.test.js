const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')

function getJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return getJavaScriptFiles(entryPath)
    return /\.jsx?$/.test(entry.name) ? [entryPath] : []
  })
}

test('React renderer does not import Electron or Node built-in modules', () => {
  const forbiddenImports = /(?:from\s*|require\s*\()\s*['"](?:electron|node:|fs(?:\/promises)?|path|child_process|os|process)['"]/m
  const rendererFiles = getJavaScriptFiles(path.join(projectRoot, 'src'))

  assert.ok(rendererFiles.length > 0)
  for (const filePath of rendererFiles) {
    assert.doesNotMatch(fs.readFileSync(filePath, 'utf8'), forbiddenImports, path.relative(projectRoot, filePath))
  }
})

test('preload exposes only the named ClipVault API and not raw IPC or filesystem access', () => {
  const preload = fs.readFileSync(path.join(projectRoot, 'electron', 'preload.js'), 'utf8')
  const rendererApi = fs.readFileSync(path.join(projectRoot, 'electron', 'renderer-api.js'), 'utf8')
  const controller = fs.readFileSync(path.join(projectRoot, 'electron', 'menu-bar-controller.js'), 'utf8')

  assert.match(preload, /contextBridge\.exposeInMainWorld\(['"]clipVault['"]/)
  assert.doesNotMatch(preload, /exposeInMainWorld\(['"](?:ipcRenderer|require|fs)['"]|window\.(?:ipcRenderer|require)/)
  assert.doesNotMatch(rendererApi, /\b(?:readFile|writeFile|readdir|exec|spawn)\s*\(/)
  assert.match(controller, /contextIsolation:\s*true/)
  assert.match(controller, /nodeIntegration:\s*false/)
})

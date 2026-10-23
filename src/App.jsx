import { ArrowDownUp, Archive, Check, Command, Copy, Pause, Play, Search, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function mergeEntries(currentEntries, incomingEntries, limit) {
  const byId = new Map()
  for (const entry of [...currentEntries, ...incomingEntries]) byId.set(entry.id, entry)
  return [...byId.values()]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, limit)
}

function formatTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

function App() {
  const [entries, setEntries] = useState([])
  const [captureStatus, setCaptureStatus] = useState(null)
  const [appInfo, setAppInfo] = useState(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [message, setMessage] = useState('')
  const historyLimitRef = useRef(500)
  const api = window.clipVault

  useEffect(() => {
    if (!api) return undefined
    let active = true

    const unsubscribeEntry = api.onClipboardEntry((entry) => {
      setEntries((current) => mergeEntries(current, [entry], historyLimitRef.current))
    })
    const unsubscribeStatus = api.onCaptureStatusChanged((status) => {
      historyLimitRef.current = status.historyLimit
      setCaptureStatus(status)
      setEntries((current) => current.slice(0, status.historyLimit))
    })

    api.getHistory().then((history) => {
      if (active) setEntries((current) => mergeEntries(current, history, captureStatus?.historyLimit ?? 500))
    }).catch(() => {
      if (active) setMessage('Clipboard history could not be read from local storage.')
    })
    api.getCaptureStatus().then((status) => {
      if (active) {
        historyLimitRef.current = status.historyLimit
        setCaptureStatus(status)
        setEntries((current) => current.slice(0, status.historyLimit))
      }
    }).catch(() => {
      if (active) setMessage('Capture status is unavailable.')
    })
    api.getAppInfo().then(setAppInfo).catch(() => {})

    return () => {
      active = false
      unsubscribeEntry()
      unsubscribeStatus()
    }
  }, [])

  useEffect(() => {
    if (!api) return undefined
    const searchText = query.trim()
    if (!searchText) {
      setSearchResults(null)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(() => {
      api.searchHistory(searchText).then((results) => {
        if (active) setSearchResults(results)
      }).catch(() => {
        if (active) setMessage('Clipboard history search failed.')
      })
    }, 150)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, entries])

  const visibleEntries = query.trim() ? (searchResults ?? []) : entries
  const platformName = appInfo?.platform === 'darwin'
    ? 'macOS'
    : appInfo?.platform === 'win32'
      ? 'Windows'
      : appInfo?.platform === 'linux'
        ? 'Linux'
        : appInfo?.platform

  async function toggleCapture() {
    if (!api || !captureStatus) return
    setMessage('')
    try {
      const status = captureStatus.enabled ? await api.pauseCapture() : await api.resumeCapture()
      setCaptureStatus(status)
    } catch {
      setMessage('Capture setting could not be changed.')
    }
  }

  async function copyEntry(entry) {
    setMessage('')
    try {
      const copied = await api.copyHistoryEntry(entry.id)
      setMessage(copied ? 'Clip copied to the system clipboard.' : 'That clip is no longer in history.')
    } catch {
      setMessage('Clip could not be copied to the system clipboard.')
    }
  }

  async function deleteEntry(id) {
    setMessage('')
    try {
      const deleted = await api.deleteHistoryEntry(id)
      if (deleted) {
        setEntries((current) => current.filter((entry) => entry.id !== id))
        setSearchResults((current) => current?.filter((entry) => entry.id !== id) ?? null)
      }
    } catch {
      setMessage('Clip could not be deleted from local history.')
    }
  }

  async function clearHistory() {
    if (!api || !window.confirm('Clear all saved clipboard history? This cannot be undone.')) return
    setMessage('')
    try {
      await api.clearHistory()
      setEntries([])
      setSearchResults(query.trim() ? [] : null)
    } catch {
      setMessage('Clipboard history could not be cleared.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6 sm:flex">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><Archive size={19} /></div>
            <span className="text-lg font-semibold tracking-tight">ClipVault</span>
          </div>
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Library</p>
          <div className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700"><Archive size={17} /> All clips <span className="ml-auto text-xs">{entries.length}</span></div>
          <div className="mt-auto rounded-xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-indigo-600" /> Your space</div>
            <p className="text-xs leading-5 text-slate-500">Clipboard history stays on this device. No clipboard content is sent to a server.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-6 py-8 sm:px-10">
          <header className="mb-7 flex items-start justify-between gap-4">
            <div><p className="mb-1 text-sm text-slate-500">Your personal clipboard</p><h1 className="text-3xl font-semibold tracking-tight">ClipVault</h1></div>
            <button aria-label="Settings" className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-slate-900"><Settings2 size={18} /></button>
          </header>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${captureStatus?.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div>
                <p className="text-sm font-semibold">{captureStatus ? (captureStatus.enabled ? 'Clipboard capture is on' : 'Clipboard capture is paused') : 'Checking capture status…'}</p>
                <p className="text-xs text-slate-500">{captureStatus?.storageAvailable === false ? 'Local storage is unavailable.' : `Saved only on this device · Up to ${captureStatus?.maxClipboardTextChars ?? 25000} characters per clip`}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={toggleCapture} disabled={!captureStatus} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50">
                {captureStatus?.enabled ? <><Pause size={15} /> Pause capture</> : <><Play size={15} /> Resume capture</>}
              </button>
              <button onClick={clearHistory} className="flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"><Trash2 size={15} /> Clear history</button>
            </div>
          </div>

          <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Clipboard history may contain sensitive information. It is stored locally and is not automatically encrypted. Pause capture when you do not want new text saved.</p>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><Search size={18} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search clipboard history..." /><kbd className="hidden items-center gap-1 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-400 sm:flex"><Command size={10} /> K</kbd></label>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"><ArrowDownUp size={16} /> Newest first</div>
          </div>

          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700">{query.trim() ? 'Search results' : 'Recent clips'} <span className="ml-1 font-normal text-slate-400">{visibleEntries.length}</span></h2><span className="text-xs text-slate-400">{captureStatus ? `Limit ${captureStatus.historyLimit}` : ''}</span></div>
          <div className="space-y-3">
            {visibleEntries.map((entry) => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-sm">
              <div className="mb-3 flex items-center justify-between"><span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-bold tracking-wide text-violet-700">TEXT</span><time className="text-xs text-slate-400">{formatTimestamp(entry.timestamp)}</time></div>
              <p className="max-h-32 overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{entry.text}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => copyEntry(entry)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><Copy size={14} /> Copy</button>
                <button onClick={() => deleteEntry(entry.id)} aria-label="Delete clip" className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"><Trash2 size={14} /> Delete</button>
              </div>
            </article>)}
            {visibleEntries.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Check size={22} className="mx-auto mb-3 text-slate-400" /><p className="text-sm font-medium text-slate-700">{query.trim() ? 'No matching clips' : 'No clipboard history yet'}</p><p className="mt-1 text-xs text-slate-500">{query.trim() ? 'Try another search.' : 'Copy some text while capture is on to save it here.'}</p></div>}
          </div>
          {message && <p role="status" className="mt-5 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">{message}</p>}
          <footer className="mt-10 text-center text-xs text-slate-400">{appInfo ? `${appInfo.name} v${appInfo.version} · ${platformName}` : 'ClipVault · Local clipboard history'}</footer>
        </section>
      </div>
    </main>
  )
}

export default App

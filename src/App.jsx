import { Archive, Check, Command, Moon, Pause, Play, Plus, Search, Settings2, Sparkles, Sun, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HistoryList from './components/HistoryList.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import SnippetEditor from './components/SnippetEditor.jsx'
import SnippetList from './components/SnippetList.jsx'

function applyAppearance(appearance) {
  if (!appearance) return
  document.documentElement.classList.toggle('dark', appearance.dark)
  document.documentElement.style.colorScheme = appearance.dark ? 'dark' : 'light'
}

function App() {
  const api = window.clipVault
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const historyLimitRef = useRef(500)
  const [view, setView] = useState('history')
  const [returnView, setReturnView] = useState('history')
  const [history, setHistory] = useState([])
  const [historyMatches, setHistoryMatches] = useState(null)
  const [snippets, setSnippets] = useState([])
  const [snippetMatches, setSnippetMatches] = useState(null)
  const [query, setQuery] = useState('')
  const [captureStatus, setCaptureStatus] = useState(null)
  const [preferences, setPreferences] = useState(null)
  const [appearance, setAppearance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [editorSnippet, setEditorSnippet] = useState(undefined)
  const [snippetError, setSnippetError] = useState('')
  const [busy, setBusy] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)

  const visibleHistory = query.trim() ? (historyMatches ?? []) : history
  const visibleSnippets = query.trim() ? (snippetMatches ?? []) : snippets
  const activeItems = view === 'snippets' ? visibleSnippets : visibleHistory

  const refreshHistory = useCallback(async () => {
    const items = await api.getHistory()
    setHistory(items)
    return items
  }, [api])

  const refreshSnippets = useCallback(async (search = '') => {
    const items = await api.getSnippets(search)
    if (search) setSnippetMatches(items)
    else setSnippets(items)
    return items
  }, [api])

  useEffect(() => {
    if (!api) {
      setError('ClipVault desktop services are unavailable. Reopen the app to reconnect.')
      setLoading(false)
      return undefined
    }

    let active = true
    const unsubscribers = [
      api.onClipboardEntry((entry) => setHistory((items) => [entry, ...items.filter((item) => item.id !== entry.id)].slice(0, historyLimitRef.current))),
      api.onCaptureStatusChanged((status) => setCaptureStatus(status)),
      api.onHistoryCleared(() => {
        setHistory([])
        setHistoryMatches(query.trim() ? [] : null)
      }),
      api.onAppearanceChanged((nextAppearance) => {
        setAppearance(nextAppearance)
        applyAppearance(nextAppearance)
      }),
      api.onWindowStateChanged((state) => {
        if (state === 'focused') searchRef.current?.focus()
      }),
    ]

    Promise.all([
      api.getHistory(),
      api.getCaptureStatus(),
      api.getPreferences(),
      api.getAppearance(),
      api.getSnippets(''),
    ]).then(([nextHistory, nextStatus, nextPreferences, nextAppearance, nextSnippets]) => {
      if (!active) return
      setHistory(nextHistory)
      setCaptureStatus(nextStatus)
      setPreferences(nextPreferences)
      historyLimitRef.current = nextPreferences.historyLimit
      setAppearance(nextAppearance)
      setSnippets(nextSnippets)
      applyAppearance(nextAppearance)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError('ClipVault could not load local data. Your saved files have not been changed.')
      setLoading(false)
    })

    searchRef.current?.focus()
    return () => {
      active = false
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [api])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [view, query, visibleHistory.length, visibleSnippets.length])

  useEffect(() => {
    if (!api || !query.trim() || view === 'settings') {
      setHistoryMatches(null)
      setSnippetMatches(null)
      setSearching(false)
      return undefined
    }
    let active = true
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        if (view === 'history') {
          const results = await api.searchHistory(query.trim())
          if (active) setHistoryMatches(results)
        } else {
          const results = await api.getSnippets(query.trim())
          if (active) setSnippetMatches(results)
        }
      } catch {
        if (active) setError('Search could not be completed. Try again.')
      } finally {
        if (active) setSearching(false)
      }
    }, 120)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [api, query, view, history.length, snippets.length])

  useEffect(() => {
    const selected = listRef.current?.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const copySelected = useCallback(async (item = activeItems[selectedIndex]) => {
    if (!item || !api) return
    setError('')
    try {
      const copied = view === 'snippets'
        ? await api.copySnippet(item.id)
        : await api.copyHistoryEntry(item.id)
      if (!copied) throw new Error('Clip was not found')
      setToast(view === 'snippets' ? 'Snippet copied' : 'Copied to clipboard')
      window.setTimeout(() => setToast(''), 1600)
    } catch {
      setError('Could not copy this item to the clipboard.')
    }
  }, [activeItems, api, selectedIndex, view])

  useEffect(() => {
    function onKeyDown(event) {
      const commandKey = event.metaKey || event.ctrlKey
      if (commandKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (view === 'settings') setView(returnView)
        window.requestAnimationFrame(() => searchRef.current?.focus())
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (editorSnippet !== undefined) setEditorSnippet(undefined)
        else if (view === 'settings') setView(returnView)
        else if (query) setQuery('')
        else api?.closePopup().catch(() => {})
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (view === 'settings' || editorSnippet !== undefined || activeItems.length === 0) return
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        setSelectedIndex((current) => {
          if (current < 0) return direction > 0 ? 0 : activeItems.length - 1
          return (current + direction + activeItems.length) % activeItems.length
        })
      }
      if (event.key === 'Enter' && selectedIndex >= 0 && editorSnippet === undefined && view !== 'settings') {
        event.preventDefault()
        copySelected()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeItems.length, api, copySelected, editorSnippet, query, returnView, selectedIndex, view])

  async function toggleCapture() {
    if (!captureStatus) return
    setError('')
    try {
      setCaptureStatus(captureStatus.enabled ? await api.pauseCapture() : await api.resumeCapture())
    } catch {
      setError('Capture status could not be changed.')
    }
  }

  async function deleteHistoryEntry(id) {
    try {
      await api.deleteHistoryEntry(id)
      setHistory((items) => items.filter((entry) => entry.id !== id))
      setHistoryMatches((items) => items?.filter((entry) => entry.id !== id) ?? null)
    } catch {
      setError('This history item could not be deleted.')
    }
  }

  async function clearHistory() {
    try {
      const result = await api.clearHistory()
      if (result.cleared) {
        setHistory([])
        setHistoryMatches(query.trim() ? [] : null)
        setToast(`${result.count} ${result.count === 1 ? 'item' : 'items'} cleared`)
      }
    } catch {
      setError('History could not be cleared.')
    }
  }

  async function updatePreferences(patch) {
    setSettingsBusy(true)
    setError('')
    try {
      const result = await api.updatePreferences(patch)
      setPreferences(result.preferences)
      historyLimitRef.current = result.preferences.historyLimit
      setAppearance(result.appearance)
      applyAppearance(result.appearance)
      setCaptureStatus(await api.getCaptureStatus())
    } catch {
      setError('That preference could not be saved.')
    } finally {
      setSettingsBusy(false)
    }
  }

  async function saveSnippet(values) {
    setBusy(true)
    setSnippetError('')
    try {
      await api.saveSnippet(values)
      await refreshSnippets('')
      setSnippetMatches(null)
      setEditorSnippet(undefined)
      setToast('Snippet saved')
    } catch {
      setSnippetError('Could not save the snippet. Check the title and text, then try again.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSnippet(id) {
    try {
      await api.deleteSnippet(id)
      await refreshSnippets('')
      if (query.trim()) await refreshSnippets(query.trim())
    } catch {
      setError('This snippet could not be deleted.')
    }
  }

  async function togglePinned(snippet) {
    try {
      await api.setSnippetPinned(snippet.id, !snippet.pinned)
      await refreshSnippets('')
      if (query.trim()) await refreshSnippets(query.trim())
    } catch {
      setError('Snippet pin could not be changed.')
    }
  }

  function openSettings() {
    setReturnView(view === 'settings' ? returnView : view)
    setView('settings')
    setQuery('')
  }

  const emptyStatus = useMemo(() => {
    if (!captureStatus) return 'Checking status'
    return captureStatus.enabled ? 'Capturing clipboard' : 'Capture is paused'
  }, [captureStatus])

  return (
    <main className="relative flex h-screen min-h-[520px] w-full flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--background)] text-[var(--text)] shadow-2xl">
      <header className="flex h-[62px] shrink-0 items-center justify-between border-b border-[var(--line)] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {view === 'settings' ? <button onClick={() => setView(returnView)} aria-label="Close preferences" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-soft)]"><X size={16} /></button> : <div className="grid h-8 w-8 place-items-center rounded-[11px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"><Archive size={15} /></div>}
          <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-semibold tracking-tight">{view === 'settings' ? 'Preferences' : 'ClipVault'}</p>{view !== 'settings' && <span className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--muted)]">LOCAL</span>}</div><p className="truncate text-[10px] text-[var(--muted)]">{view === 'settings' ? 'A little more personal' : 'Your clipboard, in one place'}</p></div>
        </div>
        <div className="flex items-center gap-1.5">
          {view !== 'settings' && <button onClick={toggleCapture} aria-label={captureStatus?.enabled ? 'Pause capture' : 'Resume capture'} title={emptyStatus} className={`grid h-8 w-8 place-items-center rounded-lg transition ${captureStatus?.enabled ? 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400' : 'text-[var(--muted)] hover:bg-[var(--surface-soft)]'}`}>{captureStatus?.enabled ? <Pause size={15} /> : <Play size={15} />}</button>}
          {view === 'snippets' && <button onClick={() => { setSnippetError(''); setEditorSnippet(null) }} aria-label="Create snippet" title="New snippet" className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-white hover:opacity-90"><Plus size={15} /></button>}
          {view !== 'settings' && <button onClick={openSettings} aria-label="Open preferences" title="Preferences" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"><Settings2 size={15} /></button>}
        </div>
      </header>

      {view === 'settings' ? (
        <div className="flex-1 overflow-y-auto"><SettingsPanel preferences={preferences} onUpdate={updatePreferences} onBack={() => setView(returnView)} onClear={clearHistory} busy={settingsBusy} error={error} /></div>
      ) : (
        <>
          <div className="shrink-0 px-4 pt-3.5">
            <div className="mb-3 flex rounded-xl bg-[var(--surface-soft)] p-1">
              <button onClick={() => { setView('history'); setQuery('') }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${view === 'history' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'}`}><Archive size={13} /> History <span className="text-[10px] opacity-60">{history.length}</span></button>
              <button onClick={() => { setView('snippets'); setQuery('') }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${view === 'snippets' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'}`}><Sparkles size={13} /> Snippets <span className="text-[10px] opacity-60">{snippets.length}</span></button>
            </div>
            <label className="flex h-10 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/10">
              <Search size={15} className="shrink-0 text-[var(--muted)]" />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted)]" placeholder={view === 'history' ? 'Search your clipboard…' : 'Search snippets…'} aria-label={view === 'history' ? 'Search clipboard history' : 'Search snippets'} />
              {query ? <button onClick={() => setQuery('')} aria-label="Clear search" className="text-[var(--muted)] hover:text-[var(--text)]"><X size={14} /></button> : <kbd className="flex items-center gap-0.5 rounded border border-[var(--line)] px-1.5 py-1 text-[9px] text-[var(--muted)]"><Command size={9} />K</kbd>}
            </label>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
            <div className="mb-2 flex shrink-0 items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{query ? 'Search results' : view === 'history' ? 'Recent clips' : 'Pinned & saved'}</p>{view === 'history' && <span className="text-[10px] text-[var(--muted)]">{history.length}{preferences ? ` / ${preferences.historyLimit}` : ''}</span>}{view === 'snippets' && <button onClick={() => { setSnippetError(''); setEditorSnippet(null) }} className="text-[10px] font-medium text-[var(--accent)] hover:opacity-75">New snippet</button>}</div>
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              {error && <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] leading-4 text-rose-500" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={13} /></button></div>}
              {view === 'history' ? <HistoryList entries={visibleHistory} loading={loading || searching} query={query} selectedIndex={selectedIndex} onCopy={copySelected} onDelete={deleteHistoryEntry} /> : <SnippetList snippets={visibleSnippets} loading={loading || searching} query={query} selectedIndex={selectedIndex} onCreate={() => setEditorSnippet(null)} onCopy={copySelected} onEdit={(snippet) => { setSnippetError(''); setEditorSnippet(snippet) }} onDelete={deleteSnippet} onPin={togglePinned} />}
              {view === 'history' && !loading && !visibleHistory.length && error && <button onClick={() => refreshHistory().catch(() => {})} className="mx-auto -mt-12 block text-xs text-[var(--accent)]">Try loading again</button>}
            </div>
          </div>
        </>
      )}

      <footer className="flex h-[42px] shrink-0 items-center justify-between border-t border-[var(--line)] px-4 text-[10px] text-[var(--muted)]">
        <div className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${captureStatus?.enabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />{emptyStatus}{captureStatus?.storageAvailable === false && <span className="text-rose-500">· Storage unavailable</span>}</div>
        <div className="flex items-center gap-2"><span>Only on this Mac</span><span className="opacity-40">·</span><span>{appearance?.dark ? <Moon size={11} /> : <Sun size={11} />}</span><button aria-label="Close ClipVault" title="Close popup" onClick={() => api?.closePopup().catch(() => {})} className="rounded p-0.5 hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"><X size={13} /></button></div>
      </footer>

      {toast && <div role="status" className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-white dark:text-slate-900"><Check size={12} className="mr-1 inline" />{toast}</div>}
      {editorSnippet !== undefined && <SnippetEditor snippet={editorSnippet} onSave={saveSnippet} onCancel={() => setEditorSnippet(undefined)} busy={busy} error={snippetError} />}
    </main>
  )
}

export default App

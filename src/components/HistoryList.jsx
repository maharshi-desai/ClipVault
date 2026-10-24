import { Clock3, Copy, Trash2 } from 'lucide-react'

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  const age = Date.now() - date.getTime()
  if (age < 60_000) return 'Just now'
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function HistoryList({ entries, loading, query, selectedIndex, onCopy, onDelete }) {
  if (loading) return <div className="grid h-64 place-items-center text-sm text-[var(--muted)]"><span className="animate-pulse">Loading your clips…</span></div>
  if (entries.length === 0) {
    return (
      <div className="grid h-64 place-items-center px-7 text-center">
        <div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[var(--surface-soft)] text-[var(--muted)]">⌘</div>
          <p className="text-sm font-semibold">{query ? 'No matching clips' : 'Your history is clear'}</p>
          <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{query ? 'Try another search term.' : 'Copy text anywhere and it will appear here.'}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2.5 pb-3">
      {entries.map((entry, index) => (
        <article key={entry.id} data-selected={selectedIndex === index} className={`group rounded-xl border p-3.5 transition ${selectedIndex === index ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]'}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]"><Clock3 size={12} />{formatTime(entry.timestamp)}</span>
            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <button aria-label="Copy clip" onClick={() => onCopy(entry)} className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"><Copy size={14} /></button>
              <button aria-label="Delete clip" onClick={() => onDelete(entry.id)} className="rounded-md p-1.5 text-[var(--muted)] hover:bg-rose-500/10 hover:text-rose-500"><Trash2 size={14} /></button>
            </div>
          </div>
          <button onClick={() => onCopy(entry)} className="block w-full text-left">
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-5 text-[var(--text-soft)]">{entry.text}</p>
          </button>
        </article>
      ))}
    </div>
  )
}

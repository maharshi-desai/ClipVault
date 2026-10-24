import { Copy, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'

export default function SnippetList({ snippets, loading, query, selectedIndex, onCreate, onCopy, onEdit, onDelete, onPin }) {
  if (loading) return <div className="grid h-64 place-items-center text-sm text-[var(--muted)]"><span className="animate-pulse">Loading snippets…</span></div>
  if (snippets.length === 0) {
    return (
      <div className="grid h-64 place-items-center px-7 text-center">
        <div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[var(--surface-soft)] text-[var(--accent)]">✳</div>
          <p className="text-sm font-semibold">{query ? 'No matching snippets' : 'Save a reusable snippet'}</p>
          <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{query ? 'Search by title or snippet text.' : 'Keep replies, links, and templates close at hand.'}</p>
          {!query && <button onClick={onCreate} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> New snippet</button>}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2.5 pb-3">
      {snippets.map((snippet, index) => (
        <article key={snippet.id} data-selected={selectedIndex === index} className={`group rounded-xl border p-3.5 transition ${selectedIndex === index ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]'}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button onClick={() => onCopy(snippet)} className="min-w-0 truncate text-left text-[13px] font-semibold">{snippet.pinned && <Pin size={11} className="mr-1.5 inline text-[var(--accent)]" />}{snippet.title}</button>
            <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <button aria-label={snippet.pinned ? 'Unpin snippet' : 'Pin snippet'} onClick={() => onPin(snippet)} className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--accent)]">{snippet.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
              <button aria-label="Edit snippet" onClick={() => onEdit(snippet)} className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--text)]"><Pencil size={13} /></button>
              <button aria-label="Copy snippet" onClick={() => onCopy(snippet)} className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--text)]"><Copy size={13} /></button>
              <button aria-label="Delete snippet" onClick={() => onDelete(snippet.id)} className="rounded-md p-1.5 text-[var(--muted)] hover:text-rose-500"><Trash2 size={13} /></button>
            </div>
          </div>
          <button onClick={() => onCopy(snippet)} className="block w-full text-left"><p className="line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-[var(--muted)]">{snippet.content}</p></button>
        </article>
      ))}
    </div>
  )
}

import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function SnippetEditor({ snippet, onSave, onCancel, busy, error }) {
  const [title, setTitle] = useState(snippet?.title ?? '')
  const [content, setContent] = useState(snippet?.content ?? '')
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  function submit(event) {
    event.preventDefault()
    onSave({ id: snippet?.id, title, content })
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/25 p-3 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <form onSubmit={submit} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">{snippet ? 'Edit snippet' : 'New snippet'}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">A small piece of text, ready when you need it.</p></div><button type="button" onClick={onCancel} aria-label="Close editor" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-soft)]"><X size={16} /></button></div>
        <label className="mb-3 block text-[11px] font-medium text-[var(--muted)]">Name<input ref={titleRef} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Meeting follow-up" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label>
        <label className="block text-[11px] font-medium text-[var(--muted)]">Text<textarea required maxLength={25000} rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write or paste your reusable text…" className="mt-1.5 w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm leading-5 text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label>
        {error && <p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-soft)]">Cancel</button><button disabled={busy || !title.trim() || !content.trim()} className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save snippet'}</button></div>
      </form>
    </div>
  )
}

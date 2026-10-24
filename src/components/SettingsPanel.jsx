import { ArrowLeft, Moon, Sun, Laptop2, ShieldCheck, Trash2 } from 'lucide-react'

const themes = [
  { value: 'system', label: 'System', icon: Laptop2 },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export default function SettingsPanel({ preferences, onUpdate, onBack, onClear, busy, error }) {
  if (!preferences) return <div className="grid h-64 place-items-center text-sm text-[var(--muted)]">Loading preferences…</div>
  const historyLimits = [...new Set([100, 250, 500, 1000, 2000, 5000, preferences.historyLimit])].sort((a, b) => a - b)
  return (
    <div className="space-y-6 px-4 pb-5 pt-2">
      <div className="flex items-center gap-3"><button onClick={onBack} aria-label="Back to history" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-soft)]"><ArrowLeft size={16} /></button><div><p className="text-sm font-semibold">Preferences</p><p className="text-[11px] text-[var(--muted)]">Make ClipVault feel like yours.</p></div></div>
      {error && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">{error}</p>}

      <section><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Sun size={14} className="text-[var(--accent)]" /> Appearance</div><div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--line)] bg-[var(--background)] p-1">
        {themes.map(({ value, label, icon: Icon }) => <button key={value} onClick={() => onUpdate({ theme: value })} aria-pressed={preferences.theme === value} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition ${preferences.theme === value ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}><Icon size={13} />{label}</button>)}
      </div><p className="mt-1.5 text-[10px] text-[var(--muted)]">{preferences.theme === 'system' ? 'Follows your macOS appearance.' : `Using ${preferences.theme} appearance.`}</p></section>

      <section><label htmlFor="history-limit" className="mb-2 flex items-center justify-between text-xs font-semibold"><span>History limit</span><span className="font-normal text-[var(--muted)]">{preferences.historyLimit} clips</span></label><select id="history-limit" value={preferences.historyLimit} onChange={(event) => onUpdate({ historyLimit: Number(event.target.value) })} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]">{historyLimits.map((limit) => <option key={limit} value={limit}>{limit.toLocaleString()} clips</option>)}</select><p className="mt-1.5 text-[10px] text-[var(--muted)]">Changing this limit removes the oldest clips above the new limit.</p></section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={14} className="text-emerald-500" /> Privacy</div><label className="flex cursor-pointer items-start justify-between gap-3"><span><span className="block text-xs font-medium">Resume capture at launch</span><span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">Turn off to keep capture paused when ClipVault next opens.</span></span><input type="checkbox" checked={preferences.captureOnStartup} onChange={(event) => onUpdate({ captureOnStartup: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" /></label><p className="mt-3 border-t border-[var(--line)] pt-3 text-[10px] leading-4 text-[var(--muted)]">History and snippets may contain sensitive information. They stay on this Mac in local JSON and are not automatically encrypted.</p></section>

      <button disabled={busy} onClick={onClear} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/20 px-3 py-2.5 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50"><Trash2 size={14} /> Clear all history</button>
    </div>
  )
}

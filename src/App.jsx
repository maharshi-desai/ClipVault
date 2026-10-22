import { ArrowDownUp, Archive, Command, Search, Settings2, Sparkles } from 'lucide-react'

const clips = [
  { kind: 'TEXT', title: 'Welcome to ClipVault', preview: 'Your copied snippets will be easy to find, organize, and reuse.', time: 'Just now', color: 'bg-violet-100 text-violet-700' },
  { kind: 'LINK', title: 'Getting started with React', preview: 'react.dev/learn — The library for web and native user interfaces.', time: '12 min ago', color: 'bg-blue-100 text-blue-700' },
  { kind: 'TEXT', title: 'Project note', preview: 'Keep the interface simple. Make the useful things feel effortless.', time: 'Yesterday', color: 'bg-amber-100 text-amber-700' },
]

function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6 sm:flex">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><Archive size={19} /></div>
            <span className="text-lg font-semibold tracking-tight">ClipVault</span>
          </div>
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Library</p>
          <button className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700"><Archive size={17} /> All clips <span className="ml-auto text-xs">03</span></button>
          <div className="mt-auto rounded-xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-indigo-600" /> Your space</div>
            <p className="text-xs leading-5 text-slate-500">A calm home for the things you copy. More tools are coming soon.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-6 py-8 sm:px-10">
          <header className="mb-10 flex items-start justify-between gap-4">
            <div><p className="mb-1 text-sm text-slate-500">Your personal clipboard</p><h1 className="text-3xl font-semibold tracking-tight">Good morning</h1></div>
            <button aria-label="Settings" className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-slate-900"><Settings2 size={18} /></button>
          </header>
          <div className="mb-8 flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><Search size={18} className="text-slate-400" /><input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search your clips..." /><kbd className="hidden items-center gap-1 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-400 sm:flex"><Command size={10} /> K</kbd></label>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"><ArrowDownUp size={16} /> Newest first</button>
          </div>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700">Recent clips <span className="ml-1 font-normal text-slate-400">3</span></h2><span className="text-xs text-slate-400">Saved locally</span></div>
          <div className="space-y-3">
            {clips.map((clip) => <article key={clip.title} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow"><div className="mb-3 flex items-center justify-between"><span className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${clip.color}`}>{clip.kind}</span><time className="text-xs text-slate-400">{clip.time}</time></div><h3 className="mb-1 text-sm font-semibold">{clip.title}</h3><p className="truncate text-sm text-slate-500">{clip.preview}</p></article>)}
          </div>
          <footer className="mt-10 text-center text-xs text-slate-400">ClipVault starter • Built for your ideas</footer>
        </section>
      </div>
    </main>
  )
}

export default App

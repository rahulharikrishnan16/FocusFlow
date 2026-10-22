import { useEffect, useReducer, useRef, useState, type ChangeEvent } from 'react'
import {
  KEY, PLABEL, PRIORITIES, TYPES, applyFilters, bucketOf, dashboard, load, ls, parse, progress, reducer, serialize, subjects, ymd,
  type Action, type Bucket, type Filters, type Priority, type Task,
} from './store.ts'
import { TaskCard } from './TaskCard.tsx'
import { TaskForm } from './TaskForm.tsx'

// Module scope on purpose: an initializer would run twice under StrictMode and back up damaged data twice
const initial = load(ls, new Date())

const LABEL: Record<Bucket, string> = { overdue: 'Overdue', today: 'Today', upcoming: 'Next 7 days', later: 'Later', completed: 'Completed' }
const EMPTY = { overdue: 'Nothing overdue', today: 'Nothing due today', upcoming: 'Nothing in the next 7 days' }
const THEME_KEY = 'focusflow:theme'
const ringText = (done: number, total: number) =>
  total === 0 ? 'No tasks due today' : done === total ? 'All done for today' : `${done} of ${total} done`

// Unfiltered on purpose: a filter shouldn't change how much of today is done
function Ring({ done, total }: { done: number; total: number }) {
  const C = 2 * Math.PI * 34
  return (
    <div className="ring" role="progressbar" aria-label="Done today" aria-valuemin={0} aria-valuemax={Math.max(total, 1)}
      aria-valuenow={done} aria-valuetext={ringText(done, total)}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="34" className="track" />
        {done > 0 && <circle cx="40" cy="40" r="34" className="fill" strokeDasharray={C} strokeDashoffset={C * (1 - done / total)} transform="rotate(-90 40 40)" />}
      </svg>
      <span aria-hidden="true">{total ? `${done}/${total}` : '–'}</span>
    </div>
  )
}

type Notice ={ text: string; sticky: boolean; damaged?: boolean }
type Toast = { text: string; undo?: Action } | null

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  return now
}

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// After a dispatch the clicked element may have moved or unmounted; fall back to the heading it left
const refocus = (id: string, fallback: string) => requestAnimationFrame(() => {
  const el = document.getElementById(id)
  el?.focus()
  if (document.activeElement !== el) document.getElementById(fallback)?.focus()
})

export default function App() {
  const [tasks, dispatch] = useReducer(reducer, initial.tasks)
  const now = useNow()
  const [filters, setFilters] = useState<Filters>({ subject: '', priority: '', type: '' })
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [notice, setNotice] = useState<Notice | null>(initial.notice && { ...initial.notice, damaged: initial.damaged !== null })
  const [paused, setPaused] = useState(ls !== null && !initial.canSave)
  const [saveError, setSaveError] = useState(false)
  const canSave = useRef(initial.canSave)
  const last = useRef(initial.last) // last string read or written; equal strings are skipped (stops tab echo)
  const fileInput = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme)

  // Reads the DOM, not state, so a stale closure can't flip the wrong way
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { ls?.setItem(THEME_KEY, next) } catch { /* preference only; nothing to lose */ }
    setTheme(next)
  }

  const persist = (ts: Task[]) => {
    if (!ls || !canSave.current) return
    const s = serialize(ts)
    if (s === last.current) return
    try { ls.setItem(KEY, s); last.current = s; setSaveError(false) } catch { setSaveError(true) }
  }
  useEffect(() => persist(tasks), [tasks]) // eslint-disable-line

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== ls) return
      if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        document.documentElement.dataset.theme = e.newValue
        return setTheme(e.newValue)
      }
      if (e.key !== KEY) return
      const p = parse(e.newValue)
      if (!p) return
      last.current = e.newValue
      dispatch({ type: 'replace', tasks: p.tasks })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ---- derived on every render, never stored
  const subs = subjects(tasks)
  const filt: Filters = { ...filters, subject: subs.some(s => s.toLowerCase() === filters.subject.toLowerCase()) ? filters.subject : '' }
  const visible = applyFilters(tasks, filt)
  const d = dashboard(visible, now)
  const prog = progress(tasks, now)
  const overdueAll = tasks.filter(t => bucketOf(t, now) === 'overdue').length
  const filtered = !!(filt.subject || filt.priority || filt.type)
  const clearFilters = () => setFilters({ subject: '', priority: '', type: '' })

  // ---- actions
  const toggle = (t: Task) => {
    const done = !t.done
    const b = bucketOf({ ...t, done }, now)
    dispatch({ type: 'patch', id: t.id, patch: { done } })
    setToast({
      text: !done ? `"${t.title}" marked not done` : b === 'completed' ? `"${t.title}" moved to Completed` : `"${t.title}" marked done`,
      undo: { type: 'patch', id: t.id, patch: { done: t.done } },
    })
    refocus(`chk-${t.id}`, `h-${bucketOf(t, now)}`)
  }
  const setPriority = (t: Task, p: Priority) => {
    dispatch({ type: 'patch', id: t.id, patch: { priority: p } })
    setToast({ text: `"${t.title}" priority set to ${PLABEL[p]}`, undo: { type: 'patch', id: t.id, patch: { priority: t.priority } } })
    refocus(`pri-${t.id}`, `h-${bucketOf(t, now)}`)
  }
  const save = (t: Task) => {
    const isNew = editing === 'new'
    const { id, ...patch } = t
    dispatch(isNew ? { type: 'add', task: t } : { type: 'patch', id, patch })
    const b = bucketOf(t, now)
    const hidden = applyFilters([t], filt).length === 0
    setToast({ text: `${isNew ? 'Added' : 'Saved'} "${t.title}" to ${LABEL[b]}${hidden ? ' · hidden by filters' : ''}` })
    setEditing(null)
    refocus(`edit-${id}`, `h-${b}`)
  }
  const remove = (t: Task) => {
    dispatch({ type: 'remove', id: t.id })
    setToast({ text: `Deleted "${t.title}"`, undo: { type: 'add', task: t } })
    setEditing(null)
    requestAnimationFrame(() => document.getElementById('toast-undo')?.focus())
  }
  const undo = (a: Action) => {
    dispatch(a)
    setToast({ text: 'Undone' })
    const id = a.type === 'add' ? a.task.id : a.type === 'patch' ? a.id : ''
    refocus(`edit-${id}`, 'new-btn')
  }
  const removeSamples = () => {
    dispatch({ type: 'replace', tasks: tasks.filter(t => !t.id.startsWith('seed-')) })
    setToast({ text: 'Sample tasks removed', undo: { type: 'replace', tasks } })
    requestAnimationFrame(() => document.getElementById('toast-undo')?.focus())
  }
  const exportAll = () => download(`focusflow-${ymd(now)}.json`, serialize(tasks))
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 1e6) return setNotice({ text: 'File too large (max 1 MB).', sticky: false })
    const p = parse(await f.text())
    if (!p || !p.tasks.length) return setNotice({ text: 'Not a FocusFlow backup.', sticky: false })
    if (!confirm(`Import ${p.tasks.length} task${p.tasks.length === 1 ? '' : 's'}${p.skipped ? `, ${p.skipped} unreadable will be skipped` : ''}? Same-id tasks will be replaced.`)) return
    dispatch({ type: 'merge', tasks: p.tasks })
    setToast({ text: `Imported ${p.tasks.length} task${p.tasks.length === 1 ? '' : 's'}` })
  }
  const resume = () => {
    if (!confirm('Resume saving? This overwrites the damaged data. Download it first if you need it.')) return
    canSave.current = true
    setPaused(false)
    setNotice(null)
    persist(tasks)
  }

  const section = (b: 'overdue' | 'today' | 'upcoming') => (
    <section key={b} aria-labelledby={`h-${b}`}>
      <h2 id={`h-${b}`} tabIndex={-1}>{LABEL[b]} <span className="count">({d[b].length})</span></h2>
      {d[b].length ? <ul className="list">{d[b].map(t => <TaskCard key={t.id} task={t} now={now} onToggle={toggle} onPriority={setPriority} onEdit={setEditing} />)}</ul> : <p className="empty">{EMPTY[b]}</p>}
    </section>
  )
  const details = (b: 'later' | 'completed') => (
    <details key={b}>
      <summary id={`h-${b}`}>{LABEL[b]} <span className="count">({d[b].length})</span></summary>
      {d[b].length ? <ul className="list">{d[b].map(t => <TaskCard key={t.id} task={t} now={now} onToggle={toggle} onPriority={setPriority} onEdit={setEditing} />)}</ul> : <p className="empty">Nothing here</p>}
    </details>
  )

  return (
    <>
      <header className="top">
        <h1>FocusFlow</h1>
        <div className="actions">
          <button id="new-btn" className="primary" onClick={() => setEditing('new')}>+ New<span className="wide"> task</span></button>
          <button className="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
        </div>
      </header>

      {notice && (
        <div className="banner" role="alert">
          <span>{notice.text}</span>
          {notice.damaged && <button onClick={() => download('focusflow-damaged.json', initial.damaged!)}>Download damaged data</button>}
          {paused && <button onClick={resume}>Resume saving</button>}
          {!notice.sticky && <button onClick={() => setNotice(null)}>Dismiss</button>}
        </div>
      )}
      {saveError && <div className="banner" role="alert"><span>Couldn't save. Export your tasks now.</span><button onClick={exportAll}>Export</button></div>}

      <main>
        <div className="filters" role="group" aria-label="Filters">
          <select aria-label="Subject" id="f-subject" value={filt.subject} onChange={e => setFilters({ ...filt, subject: e.target.value })}>
            <option value="">All subjects</option>
            {subs.map(s => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Priority" value={filt.priority} onChange={e => setFilters({ ...filt, priority: e.target.value as Filters['priority'] })}>
            <option value="">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{PLABEL[p]}</option>)}
          </select>
          <select aria-label="Type" value={filt.type} onChange={e => setFilters({ ...filt, type: e.target.value as Filters['type'] })}>
            <option value="">All types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <span className="showing" aria-live="polite">Showing {visible.length} of {tasks.length}</span>
          {filtered && <button onClick={clearFilters}>Clear</button>}
        </div>

        <div className="summary">
          <Ring done={prog.done} total={prog.total} />
          <p>
            {ringText(prog.done, prog.total)}{prog.total > 0 && prog.done < prog.total && ' today'}
            {overdueAll > 0 && ` · ${overdueAll} overdue`}
            {tasks.some(t => t.id.startsWith('seed-')) && <> · Sample tasks <button className="link" onClick={removeSamples}>Remove samples</button></>}
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="empty big"><p>No assignments yet</p><button className="primary" onClick={() => setEditing('new')}>+ New task</button></div>
        ) : (
          <>
            {visible.length === 0 && <p className="empty">No tasks match. <button className="link" onClick={clearFilters}>Clear filters</button></p>}
            <div className="grid">{(['overdue', 'today', 'upcoming'] as const).map(section)}</div>
            {(['later', 'completed'] as const).map(details)}
          </>
        )}
      </main>

      <div className="toast" role="status">
        {toast && <>
          <span>{toast.text}</span>
          {toast.undo && <button id="toast-undo" onClick={() => undo(toast.undo!)}>Undo</button>}
          <button aria-label="Dismiss message" onClick={() => { setToast(null); refocus('new-btn', 'new-btn') }}>✕</button>
        </>}
      </div>

      <footer>
        <button className="link" onClick={exportAll}>Export</button>
        <button className="link" onClick={() => fileInput.current?.click()}>Import</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
        <span>Built for VIT students around the DA / CAT / FAT cycle. Not affiliated with VIT.</span>
      </footer>

      {editing && (
        <TaskForm key={editing === 'new' ? 'new' : editing.id} task={editing === 'new' ? null : editing} today={ymd(now)}
          subjects={subs} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

// No React here. Erasable TS only (unions, no enums) so node can run the tests directly.
export const PRIORITIES = ['high', 'med', 'low'] as const
export const TYPES = ['DA', 'Quiz', 'CAT', 'FAT', 'Lab', 'Project', 'Other'] as const
export type Priority = (typeof PRIORITIES)[number]
export type TaskType = (typeof TYPES)[number]
export type Bucket = 'overdue' | 'today' | 'upcoming' | 'later' | 'completed'
export interface Task {
  id: string
  title: string
  subject: string
  type: TaskType
  due: string // 'YYYY-MM-DD' local, the raw <input type="date"> value
  time: string // 'HH:mm' local, '' = end of day
  priority: Priority
  done: boolean
}
export interface Filters { subject: string; priority: Priority | ''; type: TaskType | '' }

// ---- dates: local-time 'YYYY-MM-DD' strings only (never toISOString / new Date('YYYY-MM-DD'): both are UTC)
const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const toDate = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (k: string, n: number) => { const d = toDate(k); d.setDate(d.getDate() + n); return ymd(d) }
export const daysBetween = (a: string, b: string) => Math.round((+toDate(b) - +toDate(a)) / 864e5)
export const isDate = (k: unknown): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && ymd(toDate(k)) === k

// ---- selectors
const sortKey = (t: Task) => `${t.due}T${t.time || '24:00'}` // untimed sorts after 23:59
export const byDue = (a: Task, b: Task) => {
  const ka = sortKey(a), kb = sortKey(b)
  return ka < kb ? -1 : ka > kb ? 1 : PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
}
export function bucketOf(t: Task, now: Date): Bucket {
  const today = ymd(now)
  if (t.due === today) return 'today'
  if (t.done) return 'completed'
  return t.due < today ? 'overdue' : t.due <= addDays(today, 7) ? 'upcoming' : 'later'
}
export function dashboard(tasks: Task[], now: Date) {
  const out: Record<Bucket, Task[]> = { overdue: [], today: [], upcoming: [], later: [], completed: [] }
  for (const t of [...tasks].sort(byDue)) out[bucketOf(t, now)].push(t)
  out.today.sort((a, b) => +a.done - +b.done) // stable: open first
  out.completed.reverse() // newest first
  return out
}
export const isLate = (t: Task, now: Date) => !t.done && t.due === ymd(now) && t.time !== '' && t.time < hm(now)
export const progress = (tasks: Task[], now: Date) => {
  const t = tasks.filter(x => x.due === ymd(now))
  return { done: t.filter(x => x.done).length, total: t.length }
}
export const subjects = (ts: Task[]) =>
  [...new Map(ts.map(t => [t.subject.toLowerCase(), t.subject])).values()].sort((a, b) => a.localeCompare(b))
export const applyFilters = (ts: Task[], f: Filters) => ts.filter(t =>
  (!f.subject || t.subject.toLowerCase() === f.subject.toLowerCase()) &&
  (!f.priority || t.priority === f.priority) && (!f.type || t.type === f.type))
export const newId = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)

export const codeHint = (s: string) => {
  const w = s.trim().split(/[\s·\-–]+/)[0].toUpperCase()
  return /^[A-Z]{2,5}\d/.test(w) && !/^([A-Z]{4}\d{3}[A-Z]|[A-Z]{3}\d{4})$/.test(w)
    ? 'VIT course codes look like BCSE202L (or older CSE1001).' : ''
}

// ---- reducer
export type Action =
  | { type: 'add'; task: Task } // create, undo delete
  | { type: 'patch'; id: string; patch: Partial<Omit<Task, 'id'>> } // edit, toggle, drop, undo toggle
  | { type: 'remove'; id: string }
  | { type: 'replace'; tasks: Task[] } // other tab, remove samples
  | { type: 'merge'; tasks: Task[] } // import: incoming wins by id
export function reducer(s: Task[], a: Action): Task[] {
  switch (a.type) {
    case 'add': return [...s, a.task]
    case 'patch': return s.map(t => (t.id === a.id ? { ...t, ...a.patch } : t))
    case 'remove': return s.filter(t => t.id !== a.id)
    case 'replace': return a.tasks
    case 'merge': return [...new Map([...s, ...a.tasks].map(t => [t.id, t])).values()]
  }
}

// ---- validation: one gate for load, import and cross-tab events
const isStr = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max
export function isTask(x: unknown): Task | null {
  if (typeof x !== 'object' || x === null) return null
  const o = x as Record<string, unknown>
  if (!isStr(o.id, 1, 64) || !isStr(o.title, 1, 120) || !isStr(o.subject, 1, 60)) return null
  if (!(TYPES as readonly unknown[]).includes(o.type) || !(PRIORITIES as readonly unknown[]).includes(o.priority)) return null
  if (!isDate(o.due) || typeof o.time !== 'string' || !/^(([01]\d|2[0-3]):[0-5]\d)?$/.test(o.time) || typeof o.done !== 'boolean') return null
  return { id: o.id, title: o.title.trim(), subject: o.subject.trim(), type: o.type as TaskType, due: o.due, time: o.time, priority: o.priority as Priority, done: o.done }
}
export const VERSION = 1
export const serialize = (tasks: Task[]) => JSON.stringify({ version: VERSION, tasks })
export function parse(raw: string | null): { tasks: Task[]; skipped: number } | null {
  if (raw === null) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (typeof data !== 'object' || data === null) return null
  const d = data as { version?: unknown; tasks?: unknown }
  if (d.version !== VERSION || !Array.isArray(d.tasks)) return null
  const seen = new Set<string>(), tasks: Task[] = []
  for (const x of d.tasks) {
    const t = isTask(x)
    if (t && !seen.has(t.id)) { seen.add(t.id); tasks.push(t) }
  }
  return { tasks, skipped: d.tasks.length - tasks.length }
}

// ---- seed: relative to first visit so an evaluator on any date sees a full dashboard
export function seed(now: Date): Task[] {
  const today = ymd(now), d = (n: number) => addDays(today, n)
  const mk = (n: number, title: string, subject: string, type: TaskType, due: string, time: string, priority: Priority, done = false): Task =>
    ({ id: `seed-${n}`, title, subject, type, due, time, priority, done })
  return [
    mk(1, 'DA-2 upload', 'BCSE202L · Data Structures', 'DA', d(-1), '23:59', 'high'),
    mk(2, 'Lab record – Exp 7', 'BCSE202P · DSA Lab', 'Lab', today, '23:59', 'med'),
    mk(3, 'Quiz 2', 'Engineering Physics', 'Quiz', today, '14:00', 'med'),
    mk(4, 'CAT-II syllabus recap', 'BCSE202L · Data Structures', 'CAT', today, '', 'low', true),
    mk(5, 'Push FocusFlow to GitHub', 'Tech club', 'Other', d(1), '', 'high'),
    mk(6, 'DA-3 submission', 'BCSE202L · Data Structures', 'DA', d(2), '23:59', 'high'),
    mk(7, 'Review 3 / viva prep', 'Capstone project', 'Project', d(5), '', 'med'),
    mk(8, 'FAT revision – Units 4–5', 'BCSE202L · Data Structures', 'FAT', d(12), '', 'low'),
  ]
}

// ---- persistence
export const KEY = 'focusflow:data'
export type Store = Pick<Storage, 'getItem' | 'setItem'>
export interface Loaded {
  tasks: Task[]
  canSave: boolean
  notice: { text: string; sticky: boolean } | null
  damaged: string | null // raw text of unreadable data, offered as a download
  last: string | null // last string read/written, so we can skip echoes
}
// Chrome throws on merely reading window.localStorage when site data is blocked
export const ls: Storage | null = (() => { try { return localStorage } catch { return null } })()

export function load(st: Store | null, now: Date): Loaded {
  const base = { damaged: null, last: null }
  if (!st) return { ...base, tasks: seed(now), canSave: false, notice: { text: 'Storage blocked. Export to keep changes.', sticky: false } }
  let raw: string | null
  try { raw = st.getItem(KEY) } catch { return { ...base, tasks: seed(now), canSave: false, notice: { text: 'Storage blocked. Export to keep changes.', sticky: false } } }
  if (raw === null) return { ...base, tasks: seed(now), canSave: true, notice: null }
  const p = parse(raw)
  if (p && p.skipped === 0) return { ...base, tasks: p.tasks, canSave: true, notice: null, last: raw }
  const tasks = p?.tasks ?? []
  const what = p ? `${p.skipped} unreadable task${p.skipped === 1 ? '' : 's'} skipped` : 'Saved data was unreadable'
  try {
    st.setItem(`${KEY}:backup:${+now}`, raw)
    return { tasks, canSave: true, damaged: raw, last: raw, notice: { text: `${what}; backup kept.`, sticky: false } }
  } catch {
    return { tasks, canSave: false, damaged: raw, last: raw, notice: { text: `${what}. Saving paused so nothing is overwritten.`, sticky: true } }
  }
}

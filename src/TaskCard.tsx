import { PLABEL, PRIORITIES, daysBetween, isLate, toDate, ymd, type Priority, type Task } from './store.ts'

const dateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

function when(t: Task, now: Date) {
  if (t.done) return ''
  const n = daysBetween(ymd(now), t.due)
  if (n < 0) return `${-n} day${n < -1 ? 's' : ''} overdue`
  if (n === 0) return 'due today'
  return n === 1 ? 'tomorrow' : n <= 7 ? `in ${n} days` : ''
}

interface Props {
  task: Task
  now: Date
  onToggle: (t: Task) => void
  onPriority: (t: Task, p: Priority) => void
  onEdit: (t: Task) => void
}

export function TaskCard({ task: t, now, onToggle, onPriority, onEdit }: Props) {
  const [h, m] = t.time.split(':').map(Number)
  const date = dateFmt.format(toDate(t.due)) + (t.time ? ` · ${timeFmt.format(new Date(2000, 0, 1, h, m))}` : '')
  const rel = when(t, now)
  return (
    <li className={`card p-${t.priority}${t.done ? ' done' : ''}`}>
      <input type="checkbox" id={`chk-${t.id}`} checked={t.done} onChange={() => onToggle(t)} aria-label={`Mark ${t.title} done`} />
      <div className="body">
        <button type="button" id={`edit-${t.id}`} className="title" onClick={() => onEdit(t)}>{t.title}</button>
        <div className="meta">
          <span>{t.subject}</span>
          <span className="badge">{t.type}</span>
          <time dateTime={t.due}>{date}</time>
          {rel && <span>{rel}</span>}
          {isLate(t, now) && <span className="late">Late</span>}
        </div>
      </div>
      <select id={`pri-${t.id}`} aria-label={`Priority for ${t.title}`} value={t.priority} onChange={e => onPriority(t, e.target.value as Priority)}>
        {PRIORITIES.map(p => <option key={p} value={p}>{PLABEL[p]}</option>)}
      </select>
    </li>
  )
}

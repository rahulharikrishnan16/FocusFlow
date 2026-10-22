import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PLABEL, PRIORITIES, TYPES, codeHint, isTask, newId, type Task } from './store.ts'

interface Props {
  task: Task | null // null = new
  today: string
  subjects: string[]
  onSave: (t: Task) => void
  onDelete: (t: Task) => void
  onClose: () => void
}

export function TaskForm({ task, today, subjects, onSave, onDelete, onClose }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [due, setDue] = useState(task?.due ?? today)
  const [time, setTime] = useState(task?.time ?? '')
  const [subject, setSubject] = useState(task?.subject ?? '')

  // React's autoFocus fires before the dialog is visible; the guard survives StrictMode's double effect
  useEffect(() => {
    if (!dlg.current!.open) dlg.current!.showModal()
    titleRef.current?.focus()
  }, [])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const t = isTask({
      id: task?.id ?? newId(), title: f.get('title'), subject: f.get('subject'), type: f.get('type'),
      due: f.get('due'), time: f.get('time') ?? '', priority: f.get('priority'), done: task?.done ?? false,
    })
    if (t) onSave(t)
  }
  const hint = codeHint(subject)

  return (
    <dialog ref={dlg} onClose={onClose} aria-labelledby="form-title">
      <form onSubmit={submit}>
        <h2 id="form-title">{task ? 'Edit task' : 'New task'}</h2>
        <label>Title
          <input ref={titleRef} name="title" required maxLength={120} pattern=".*\S.*" title="Enter at least one non-space character" defaultValue={task?.title} />
        </label>
        <label>Subject
          <input name="subject" list="subjects" required maxLength={60} pattern=".*\S.*" title="Enter at least one non-space character"
            placeholder="e.g. BCSE202L · Data Structures" aria-describedby="subject-hint"
            value={subject} onChange={e => setSubject(e.target.value)} />
        </label>
        <datalist id="subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist>
        <p id="subject-hint" className="hint">{hint}</p>
        <div className="row">
          <label>Type
            <select name="type" defaultValue={task?.type ?? 'Other'}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
          </label>
          <label>Priority
            <select name="priority" defaultValue={task?.priority ?? 'med'}>{PRIORITIES.map(p => <option key={p} value={p}>{PLABEL[p]}</option>)}</select>
          </label>
        </div>
        <div className="row">
          <label>Due date
            <input type="date" name="due" required value={due} onChange={e => setDue(e.target.value)} />
          </label>
          <label>Time (optional)
            <span className="inline">
              <input type="time" name="time" value={time} onChange={e => setTime(e.target.value)} />
              <button type="button" onClick={() => setTime('')} disabled={!time}>No time</button>
            </span>
          </label>
        </div>
        {due && due < today && !task?.done && <p className="hint">Will show as overdue.</p>}
        <div className="row end">
          {task && <button type="button" className="danger" onClick={() => onDelete(task)}>Delete</button>}
          <button type="button" onClick={() => dlg.current?.close()}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </dialog>
  )
}

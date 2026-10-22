import type { ComponentProps } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { PLABEL, PRIORITIES, byDue, type Priority, type Task } from './store.ts'
import { TaskCard } from './TaskCard.tsx'

type CardProps = Omit<ComponentProps<typeof TaskCard>, 'drag'>

// The default keyboard step is 25px, which would take ~15 presses to cross a column.
// Any arrow key jumps the card to the next or previous column instead.
const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
const columnJump: KeyboardCoordinateGetter = (event, { context: { active, over, collisionRect, droppableRects } }) => {
  const step = STEP[event.code]
  if (!step || !collisionRect) return
  event.preventDefault()
  const cur = PRIORITIES.indexOf((over?.id ?? active?.data.current?.priority) as Priority)
  const next = PRIORITIES[Math.min(PRIORITIES.length - 1, Math.max(0, cur + step))]
  const rect = droppableRects.get(next)
  if (!rect || PRIORITIES.indexOf(next) === cur) return
  return { x: rect.left + (rect.width - collisionRect.width) / 2, y: rect.top + 48 }
}

function DraggableCard(props: CardProps) {
  const t = props.task
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: t.id, data: { priority: t.priority } })
  // touch-action: none is on the grip only, so the rest of the card still scrolls the page on phones
  const grip = <button type="button" id={`grip-${t.id}`} className="grip" ref={setActivatorNodeRef} {...listeners} {...attributes} aria-label={`Move ${t.title}`}><span aria-hidden="true">⠿</span></button>
  return <TaskCard {...props} drag={{
    ref: setNodeRef, grip,
    style: { transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, zIndex: isDragging ? 10 : undefined, boxShadow: isDragging ? '0 6px 16px rgb(0 0 0 / .25)' : undefined },
  }} />
}

function Column({ p, tasks, ...card }: { p: Priority; tasks: Task[] } & Omit<CardProps, 'task'>) {
  const { setNodeRef, isOver } = useDroppable({ id: p })
  return (
    <section ref={setNodeRef} className={`col${isOver ? ' over' : ''}`} aria-labelledby={`h-col-${p}`}>
      <h2 id={`h-col-${p}`} tabIndex={-1}>{PLABEL[p]} <span className="count">({tasks.length})</span></h2>
      {tasks.length
        ? <ul className="list">{tasks.map(t => <DraggableCard key={t.id} task={t} {...card} />)}</ul>
        : <p className="empty">Drop tasks here</p>}
    </section>
  )
}

interface Props extends Omit<CardProps, 'task'> {
  tasks: Task[] // open tasks only
  onMove: (t: Task, p: Priority) => void
  onDragState: (dragging: boolean) => void
}

export function Board({ tasks, onMove, onDragState, ...card }: Props) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: columnJump }))
  const byId = new Map(tasks.map(t => [t.id, t]))
  const name = (id: unknown) => `"${byId.get(String(id))?.title ?? 'task'}"`
  const label = (id: unknown) => PLABEL[id as Priority]
  // Custom, because the defaults read out the task's UUID
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) => over ? `${name(active.id)} is over ${label(over.id)}.` : `${name(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) => !over || over.id === active.data.current?.priority ? `${name(active.id)} stays where it was.` : `Moved ${name(active.id)} to ${label(over.id)}.`,
    onDragCancel: ({ active }) => `Cancelled. ${name(active.id)} stays where it was.`,
  }
  const end = ({ active, over }: DragEndEvent) => {
    onDragState(false)
    const t = byId.get(String(active.id)), p = over?.id as Priority | undefined
    if (t && p && t.priority !== p) onMove(t, p)
  }
  return (
    <DndContext id="board" sensors={sensors} onDragStart={() => onDragState(true)} onDragCancel={() => onDragState(false)} onDragEnd={end}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'To pick up, press Space. Arrow keys move between columns, Space drops, Escape cancels.' } }}>
      <div className="grid">
        {PRIORITIES.map(p => <Column key={p} p={p} tasks={tasks.filter(t => t.priority === p).sort(byDue)} {...card} />)}
      </div>
    </DndContext>
  )
}

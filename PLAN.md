# FocusFlow implementation plan

## 1. Summary

FocusFlow is an assignment dashboard for VIT students that runs entirely in the browser. You log DAs, quizzes, labs, CATs, FATs and reviews. It shows them as **Overdue**, **Today** and **Next 7 days**, with a daily progress ring and a drag-and-drop priority board.

- **Stack:** Vite 8, React 19 and TypeScript 6, with one CSS file and `@dnd-kit/core`. Tests use `node:test`.
- **State:** one `useReducer` over `Task[]` with 5 actions. Every view is a pure function of `(tasks, filters, now)`.
- **Storage:** one versioned localStorage key, with a backup of corrupt data, cross-tab sync and JSON export/import.

## 2. Tech stack

| Choice | Version | Why | Rejected (reason) |
|---|---|---|---|
| Vite via `npx -y create-vite@9.3.1 . --template react-ts` | 8.3.5 | Zero config and Vercel detects it. `npx` avoids npm 12's unverified `--` passthrough. | Next.js (SSR with no server) |
| React | 19.3.1, plugin-react 6.1.2 | One state value drives every view. | Vanilla (hand-written DOM diffing); Preact (dnd-kit needs a compat alias) |
| TypeScript | ~6.0.3 | Typed `Task`/`Action` unions. | 7.0.2 (no public API, no gain) |
| Lint | oxlint ^1.88 | Template default. | ESLint |
| State | `useReducer` | One pure, testable function. | Redux/Zustand (only 5 actions); Context (props go at most 3 levels) |
| CSS | `index.css` with custom properties | A theme is about 12 variables. | Tailwind 4.3.3 (2 packages, a plugin and `@custom-variant`) |
| DnD | `@dnd-kit/core` 6.3.1 | Pointer sensor (touch works on Samsung Internet), Keyboard sensor, announcements. | Native DnD (no touch on Samsung/Firefox Android, no keyboard; kept as the fallback); `sortable` (columns aren't reordered); `@dnd-kit/react` 0.5.1 (0.x) |
| Dates | `Date`, `Intl.DateTimeFormat('en-IN')`, `Intl.RelativeTimeFormat` | Local `YYYY-MM-DD` strings sort as text. | date-fns 4.4.0 (only 4 helpers needed); Temporal (no Safari/Samsung) |
| Storage | `localStorage` | Synchronous, 5 MiB, `storage` event. | IndexedDB (async for a few KB); json-server 1.0.0-beta.15 / MSW 3.0.3 (extra process, nothing for the user) |
| Dialogs | `<dialog>` + `showModal()` | Native focus trap, Esc and inert background. | Radix, react-modal |
| IDs | `crypto.randomUUID` + fallback | Built in. | nanoid |
| Tests | `node:test`, Node 24.19 type stripping | No dependencies. | Vitest 5.0.5 (a dev dependency for about 40 asserts) |
| Hosting | Vercel Hobby | HTTPS and `base:'/'`. | GitHub Pages (needs `base` and Actions; a blank page if forgotten) |

**Runtime dependencies:** `react`, `react-dom`, `@dnd-kit/core`. **Dev dependencies added:** none.

## 3. Scope matrix

| Item | Feature | Acceptance criteria |
|---|---|---|
| **B1** Create | `TaskForm` `<dialog>`, a checkbox on each card | <ul><li>Title is 1–120 characters and subject 1–60, both `required` with `pattern=".*\S.*"` and trimmed.</li><li>Date is required and defaults to local today. Time is optional, with a "No time" clear.</li><li>Defaults: Med and Other.</li><li>An invalid submit focuses the first bad field. A past date shows "Will show as overdue".</li><li>Edit pre-fills. The checkbox reads "Mark ⟨title⟩ done".</li><li>After saving, the task is visible or the status line says where it went ("Added 'FAT revision' to Later · hidden by filters").</li><li>After a toggle, priority change, edit or delete, focus stays on the task or moves to its old heading (Undo after a delete), and the move is announced.</li></ul> |
| **B2** Dashboard | Overdue, Today and Next 7 days, with Later and Completed collapsed | <ul><li>Follows the §5 rules, which are unit-tested.</li><li>Counts, and a message for each empty section.</li><li>"2 days overdue", "tomorrow", "Late".</li><li>Rolls over within 60 s of midnight or when the tab is reshown.</li></ul> |
| **B3** Filters | Subject, Priority and Type `<select>` + Clear | <ul><li>AND across both views.</li><li>Subject list ignores case.</li><li>"Showing X of Y · Clear" in `aria-live="polite"`.</li><li>A deleted subject counts as All.</li><li>The ring ignores filters.</li></ul> |
| **B4** Persist | `focusflow:data` `{version:1, tasks}` | <ul><li>Survives a reload.</li><li>Corrupt data is backed up, valid tasks still load, and the user can "Download damaged data".</li><li>A failed save shows a banner and the screen stays intact.</li><li>Blocked storage shows an in-memory banner.</li><li>A second tab updates live.</li><li>Export→import is lossless, and a bad file is rejected.</li></ul> |
| **P1** DnD board | High, Med and Low columns | <ul><li>Mouse, touch and keyboard all change and save priority.</li><li>Dropping in the same column does nothing.</li><li>Announcements use titles.</li><li>The card's `<select>` is the non-drag path (WCAG 2.5.7).</li><li>Phones still scroll.</li></ul> |
| **P2** Ring | Summary strip | <ul><li>done/total due today.</li><li>0 tasks shows "No tasks due today", 100% shows "All done for today".</li><li>`role="progressbar"`, "1 of 3 done".</li><li>Static under reduced motion.</li></ul> |
| **P3** Shortcuts | One `keydown` listener, `?` help | <ul><li>All §9 keys work, even right after ticking a checkbox.</li><li>Silent in text fields and selects, with modifiers, with a dialog open, and mid-drag.</li><li>Saved off switch (WCAG 2.1.4).</li></ul> |
| **P4** Theme | Inline-script `data-theme` | <ul><li>Defaults to the OS, and the toggle is saved.</li><li>No flash at 6× CPU throttle.</li><li>Native pickers are themed.</li><li>AA contrast in both themes, including on the accent.</li></ul> |
| **P5** Responsive | `auto-fit` grid | <ul><li>No horizontal scroll from 320 to 1440 px or at 200% zoom.</li><li>No blank columns at 1920 px.</li><li>Targets ≥44 px, inputs ≥16 px.</li><li>No keyboard hints on touch.</li><li>Tested on Android and iOS Safari.</li></ul> |
| **D1** Dashboard | Vercel production URL | Private window, mobile data: samples visible, ring at 1/3, zero console errors. |
| **D2** Repo | Public `focusflow` | <ul><li>One commit per feature.</li><li>Live link in the README.</li><li>`npm ci && npm run build && npm test` passes.</li></ul> |
| **D3** Write-up | README section | ≤300 words, plus the §6 diagram. |

## 4. VIT-specific touches

- **Type badge and filter:** `DA | Quiz | CAT | FAT | Lab | Project | Other`, matching the DA/CAT/FAT cycle on the same filter path.
- **Free-text subject** with a `<datalist>` of subjects already used. FFCS means no two timetables match, so there's no catalog. Placeholder: `e.g. BCSE202L · Data Structures`.
- **Soft code hint.** First word only, and only if it looks like a code. Accepts the current and older formats, never blocks saving, and uses `aria-describedby`:
  ```ts
  export const codeHint = (s: string) => {
    const w = s.trim().split(/[\s·\-–]+/)[0].toUpperCase()
    return /^[A-Z]{2,5}\d/.test(w) && !/^([A-Z]{4}\d{3}[A-Z]|[A-Z]{3}\d{4})$/.test(w)
      ? 'VIT course codes look like BCSE202L (or older CSE1001).' : ''
  }
  ```
- **Optional due time,** because DAs close at e.g. 23:59. Shown as "Thu, 23 Oct · 11:59 pm".
- **IST-safe today** for anyone working between 00:00 and 05:30.
- **Samples** cover a late-Fall week. BCSE202L/P are the only real codes.
- **Branding:** the name is FocusFlow. No VIT logo, crest, VTOP look, or "VIT" in the name. Footer and README: *"Built for VIT students around the DA / CAT / FAT cycle. Not affiliated with VIT."*
- **Skipped:** VTOP login/scraping, timetables, attendance/CGPA maths, calendar import, campus variants, notifications, catalogs.

## 5. Data model and date semantics

```ts
// src/store.ts — no React; erasable TS only (unions, no enums); no date work at module scope
export const PRIORITIES = ['high', 'med', 'low'] as const
export const TYPES = ['DA', 'Quiz', 'CAT', 'FAT', 'Lab', 'Project', 'Other'] as const
export type Priority = (typeof PRIORITIES)[number]
export type TaskType = (typeof TYPES)[number]
export type Bucket = 'overdue' | 'today' | 'upcoming' | 'later' | 'completed'
export interface Task {
  id: string; title: string; subject: string; type: TaskType
  due: string    // 'YYYY-MM-DD' local, raw <input type="date"> value
  time: string   // 'HH:mm' local, '' = end of day
  priority: Priority; done: boolean
}
export interface Filters { subject: string; priority: Priority | ''; type: TaskType | '' }

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const toDate = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (k: string, n: number) => { const d = toDate(k); d.setDate(d.getDate() + n); return ymd(d) }
export const daysBetween = (a: string, b: string) => Math.round((+toDate(b) - +toDate(a)) / 864e5)

const sortKey = (t: Task) => `${t.due}T${t.time || '24:00'}`   // untimed after 23:59
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
  out.today.sort((a, b) => +a.done - +b.done)   // stable: open first
  out.completed.reverse()                        // newest first
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
// Chrome throws on merely reading window.localStorage when site data is blocked
export const ls: Storage | null = (() => { try { return localStorage } catch { return null } })()
```

| Bucket (`today = ymd(now)`, exactly one per task) | Rule |
|---|---|
| Today | `due === today`, done or not. Open first, then by time. Feeds the ring. |
| Overdue | Open and `due < today`, by day |
| Next 7 days | Open and `today < due ≤ today+7` |
| Later / Completed (collapsed) | Open with `due > today+7` / done with `due ≠ today`, newest first |
| Late chip (not a bucket) | Open, due today, timed, `time < hm(now)` |

**Edge cases:**
- Never use `toISOString().slice(0,10)`: it returns yesterday from 00:00 to 05:30 IST. Avoid `new Date('YYYY-MM-DD')` and `valueAsDate` too, since both are UTC.
- `addDays(k,0) !== k` rejects dates like `2026-02-30`.
- `useNow()` ticks every 60 s and on `visibilitychange`.
- Untimed tasks are never Late.
- Date and time are separate inputs, because `datetime-local` can't leave the time blank.
- If the chosen subject is gone, `App` passes `subject: ''`.

**Seed** (only when the key is absent; ids `seed-1…8`; "BCSE202L" below is short for `BCSE202L · Data Structures`):

| Task | Due · priority | Bucket |
|---|---|---|
| DA-2 upload (BCSE202L · Data Structures, DA) | yesterday 23:59 · High | Overdue |
| Lab record – Exp 7 (BCSE202P · DSA Lab, Lab) | today 23:59 · Med | Today |
| Quiz 2 (Engineering Physics, Quiz) | today 14:00 · Med | Today, Late after 2 pm |
| CAT-II syllabus recap (BCSE202L, CAT), **done** | today · Low | Today, ring at 1/3 |
| Push FocusFlow to GitHub (Tech club, Other) | +1 · High | Next 7 days |
| DA-3 submission (BCSE202L, DA) | +2 23:59 · High | Next 7 days |
| Review 3 / viva prep (Capstone project, Project) | +5 · Med | Next 7 days |
| FAT revision – Units 4–5 (BCSE202L, FAT) | +12 · Low | Later |

## 6. State management (README-ready)

**Source of truth:** `tasks: Task[]`, held in `useReducer(reducer, initial.tasks)` in `App.tsx`. The logic lives in React-free, tested `store.ts`.

```ts
export type Action =
  | { type: 'add'; task: Task }                                     // create, undo delete
  | { type: 'patch'; id: string; patch: Partial<Omit<Task, 'id'>> } // edit, toggle, drop, priority, undo toggle
  | { type: 'remove'; id: string }
  | { type: 'replace'; tasks: Task[] }                              // other tab, remove samples
  | { type: 'merge'; tasks: Task[] }                                // import: file wins by id
export function reducer(s: Task[], a: Action): Task[] {
  switch (a.type) {
    case 'add': return [...s, a.task]
    case 'patch': return s.map(t => (t.id === a.id ? { ...t, ...a.patch } : t))
    case 'remove': return s.filter(t => t.id !== a.id)
    case 'replace': return a.tasks
    case 'merge': return [...new Map([...s, ...a.tasks].map(t => [t.id, t])).values()]
  }
}
```

The reducer is pure. IDs, trimming and `now` are resolved before `dispatch`, because StrictMode runs reducers twice.

**Derived on every render, never stored:**
- `visible = applyFilters(tasks, filters)` and `dashboard(visible, now)`
- `progress(tasks, now)`, which is unfiltered
- `subjects(tasks)`
- the board columns: open `visible` tasks per priority, sorted `byDue`

Nothing can drift, and no `useMemo` is needed under about 1,000 tasks.

**UI state** (`useState`, not persisted): `filters`, `view`, `editing: Task | 'new' | null`, `toast: { text; undo?: Action } | null`, `notice`, `now` and `dragging`. The `focusflow:theme` and `focusflow:shortcuts` preferences live outside React.

**Persistence:**
1. **One key with a `focusflow:` prefix,** because every app on `localhost:5173` shares storage.
2. **`parse(raw)` guards load, import and `storage` events.** It checks JSON, `version === 1` and an array. `isTask` checks lengths, enums, a date round-trip, and `time` against `/^(([01]\d|2[0-3]):[0-5]\d)?$/`. It drops duplicate ids and unknown fields, and returns `{tasks, skipped}` or `null`.
3. **`const initial = load(ls)` runs at module scope,** because an initializer would back up twice under StrictMode.
   - **No storage:** runs in memory with "Storage blocked. Export to keep changes."
   - **Missing:** seed. **Valid:** load.
   - **Corrupt:** copies the raw value to `focusflow:data:backup:<Date.now()>`, loads the valid tasks, and shows "2 unreadable tasks skipped; backup kept · Download damaged data".
   - **Backup fails:** `canSave = false`, with "Saving paused · Download damaged data · Resume saving (overwrites damaged data)" behind `confirm()`.
4. **Save** is an effect on `[tasks]`. It skips the write if `!canSave`, or if the JSON equals the last string read or written, which stops tab echo. `setItem` is wrapped in try/catch and shows "Couldn't save. Export your tasks now." on failure. Info banners can be dismissed; "Saving paused" can't.
5. **Cross-tab:** a `storage` listener runs `parse(e.newValue)`, marks it last-saved, and dispatches `replace`. Last write wins. The same listener applies the theme.
6. **Export** writes a Blob `focusflow-YYYY-MM-DD.json`, and the same helper downloads damaged raw data. **Import:**
   - takes a hidden `<input type="file" accept="application/json,.json">`, ≤1 MB
   - runs `parse(await file.text())`
   - on `null` or 0 tasks, shows "Not a FocusFlow backup"
   - otherwise asks ``confirm(`Import ${n} tasks${skipped ? `, ${skipped} unreadable will be skipped` : ''}? Same-id tasks will be replaced.`)`` and dispatches `merge`
7. **Toast and Undo:**
   - A delete sets `toast = { text: 'Deleted "DA-2 upload"', undo: { type: 'add', task } }`.
   - A toggle sets `'"DA-2 upload" moved to Completed'`, with the reverse `patch` as its undo.
   - Create and edit set a text-only toast naming `bucketOf(task, now)`, plus "· hidden by filters" when `applyFilters` would drop the task.
   - The toast is an always-mounted `role="status"` that stays until the next action, Dismiss or reload. It has no timer (WCAG 2.2.1).

```
UI event ─dispatch(Action)→ reducer → tasks ─┬→ selectors(tasks, filters, now) → render
                                             └→ effect: save() → localStorage['focusflow:data']
other tab: 'storage' event → parse() → dispatch(replace)
```

**Why not Redux, Zustand or Context?** One owner and 5 actions, and the stable `dispatch` goes at most 3 levels deep.

## 7. File and folder structure

```
FocusFlow/
├─ index.html          inline theme script, lang, <title>, meta description, favicon link
├─ package.json        + "test": "node --test src/store.test.ts"
├─ tsconfig.app.json   + "exclude": ["src/**/*.test.ts"]
├─ public/favicon.svg  own ring mark
├─ docs/               light.png, dark.png, mobile.png, demo.gif
├─ README.md
└─ src/
   ├─ main.tsx         template
   ├─ store.ts         types, dates, buckets, reducer, selectors, parse/isTask, load/save, seed, codeHint, newId, ls
   ├─ store.test.ts
   ├─ App.tsx          state, useNow, effects, header, filters, sections, Ring, banners, toast, shortcuts, help
   ├─ TaskCard.tsx     one card for both views
   ├─ TaskForm.tsx     <dialog> create/edit/delete
   ├─ Board.tsx        DndContext, columns, draggable cards
   └─ index.css
```

Delete `App.css`, `src/assets/` and `public/vite.svg`.

## 8. UI layout

```
┌────────────────────────────────────────────────────────────────┐
│ FocusFlow [Dashboard|Board]                    [+ New] [?] [☾] │
│ Subject[All▾] Priority[All▾] Type[All▾]  Showing 8 of 8 · Clear│
│ (◔ 1/3) 1 of 3 done today · 1 overdue   Sample tasks · Remove  │
├──────────────────┬─────────────────────┬───────────────────────┤
│ Overdue (1)      │ Today (3)           │ Next 7 days (3)       │
│ ☐ DA-2 upload    │ ☐ Quiz 2 2pm LATE   │ ☐ Push FocusFlow…     │
│   BCSE202L · DA  │ ☐ Lab record – Exp 7│ ☐ DA-3 · in 2 days    │
│   [High ▾]       │ ☑ CAT-II recap      │                       │
├──────────────────┴─────────────────────┴───────────────────────┤
│ ▸ Later (1)  ▸ Completed (0)       Deleted "Quiz 2" [Undo] [✕] │
│ Export · Import · Press ? for shortcuts · Not affiliated w/ VIT│
└────────────────────────────────────────────────────────────────┘
Board: | High (3) | Med (2) | Low (1) "Drop tasks here" |, ⠿ grip per card
```

- **Grid:** only the three bucket sections go in `.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%,18rem),1fr)) }`, giving 3, 2 or 1 columns. Later and Completed (`<details>`) sit *below* it. A `grid-column:1/-1` item inside the grid would stop empty tracks collapsing and leave blank columns on wide screens.
- **Mobile (<40rem):**
  - The header is `FocusFlow [+][?][☾]`, with the view switch below.
  - Subject is full width, with Priority and Type side by side.
  - Sections and board columns stack, and dnd-kit auto-scrolls.
  - The dialog is full width, and Export/Import stay in the footer.

**Components:**
- **`App`:**
  - The header has the `h1` and an `aria-pressed` view switch. Below it sit the filter bar, the summary strip with `Ring`, and a `role="alert"` banner.
  - Inside `<main>` there's one `<section aria-labelledby>` per bucket, each with `<h2 id="h-today" tabIndex={-1}>` and a count. The toast and footer follow.
  - **`refocus(elId, fallbackId)`** runs in `requestAnimationFrame` after a dispatch. It focuses `elId` (`chk-`, `pri-` or `edit-{id}`). If that isn't `document.activeElement` because it unmounted or sits in a closed `<details>`, it focuses the heading the task left. Delete focuses Undo. Never rely on the dialog's native focus return.
- **`TaskCard`:** checkbox, title `<button>` that opens edit, meta line (subject, type badge, `<time>`, Late), `<select aria-label="Priority for ⟨title⟩">`, grip slot.
- **`TaskForm`:** uncontrolled `FormData`, with `key={editing === 'new' ? 'new' : editing.id}`.
  - On mount it calls `if (!dlg.open) dlg.showModal(); titleRef.current?.focus()`. React's `autoFocus` fires before the dialog is visible, and the guard survives StrictMode.
  - `onClose` calls `setEditing(null)`.
  - It contains the datalist, hint, past-date note, "No time" and Delete.
- **`Board`:** `DndContext`, `useDroppable` columns and `useDraggable` cards, showing open tasks only.
- **Empty states:** "No assignments yet" with a real **+ New task** button, "Nothing due today", "Nothing overdue", "No tasks match · Clear filters".

## 9. Brownie point implementation notes

**Drag and drop.** Droppable ids are the priorities. In-column order comes from `byDue`, so there's no `order` field and no `sortable`. It uses the default sensors.

```tsx
onDragEnd={({ active, over }) => {
  setDragging(false)
  const t = byId.get(String(active.id)), p = over?.id as Priority | undefined
  if (t && p && t.priority !== p) dispatch({ type: 'patch', id: t.id, patch: { priority: p } })
}}
// onDragStart / onDragCancel set `dragging` (shortcuts check it)
// announcements: `Picked up ${title}.` / `Over ${LABEL[over.id as Priority]}.` / `Moved ${title} to …` / 'Cancelled, no change.'
// ponytail: default 25px keyboard steps; add a column-jump coordinateGetter if slow, the <select> is the fast path
```

- **The grip** is a `<button aria-label="Move ⟨title⟩">` with `setActivatorNodeRef`, listeners, attributes and `touch-action: none`, so the card body still scrolls.
- **No `DragOverlay`,** since columns don't scroll. Outline the column on `isOver`.
- **Custom announcements,** because the defaults read UUIDs.
- **Check focus returns to the grip** after a keyboard drop. If it doesn't, `refocus`.

**Progress ring.**
- **Drawing:** two SVG circles, r=34, with `C = 2πr`, `strokeDasharray={C}`, `strokeDashoffset={C*(1-done/total)}` and `rotate(-90 40 40)`.
- **Accessibility:** the SVG is `aria-hidden`. The wrapper is `role="progressbar"` with `aria-valuenow={done}`, `aria-valuemax={total}` and `aria-valuetext="1 of 3 done"`.
- **Empty:** `total === 0` renders "No tasks due today".
- **Motion:** `transition: stroke-dashoffset .4s` is off under `prefers-reduced-motion`.

**Shortcuts:**

| Key | Action |
|---|---|
| `n` | New task, Title focused |
| `/` | Subject filter (`preventDefault` stops Firefox quick-find) |
| `d` `b` `c` `t` | Dashboard, Board, Clear filters, theme |
| `?` | Help, with the "Enable single-key shortcuts" switch |
| `Esc` / `Enter` | Close dialog / save (native) |
| Grip `Space`, arrows, `Space` | Pick up, move, drop |

```ts
const onKey = (e: KeyboardEvent) => {
  if (!shortcutsOn || dragging || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing) return
  if ((e.target as Element).closest?.('input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable="true"]')) return
  if (document.querySelector('dialog[open]')) return
  const fn = keys[e.key.toLowerCase()]   // follows layout; Shift allowed so '?' works
  if (fn) { e.preventDefault(); fn() }
}  // in useEffect(..., [shortcutsOn, dragging]); handlers use stable setters/refs or read the DOM
```

- **`toggleTheme`** reads `document.documentElement.dataset.theme` rather than state, so its closure can't go stale. It sets the dataset, writes `ls` in try, and calls `setTheme(next)` for the label.
- **No Ctrl combos.** Buttons get `aria-keyshortcuts`.
- **"Press ? for shortcuts"** is a `.kbd-hint`, hidden under `@media (hover: none) and (pointer: coarse)`. The `[?]` button stays, because it holds the off switch.

**Theme without a flash.** This goes inline in `<head>`, before the module script:

```html
<script>var t;try{t=localStorage.getItem('focusflow:theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')</script>
```

```css
:root { color-scheme: light; --bg:#f6f7fb; --surface:#fff; --text:#16181d; --muted:#586070; --border:#d9dde5;
        --accent:#4f46e5; --on-accent:#fff; --high:#b42318; --med:#9a6700; --low:#1a7f37; }
[data-theme=dark] { color-scheme: dark; --bg:#0f1115; --surface:#181b21; --text:#e8eaef; --muted:#a2a9b6;
        --border:#2c313a; --accent:#8b8cf8; --on-accent:#0f1115; --high:#ff8a80; --med:#e3b341; --low:#56d364; }
```

- **Set `color-scheme` per theme.** `light dark` on `:root` lets the OS override a manual choice.
- **Order:** the dark rule comes after `:root`, which has equal specificity.
- **`--on-accent`:** white on `#8b8cf8` is only 2.9:1, while `#0f1115` gives 6.5:1.

**Responsive:**
- **Mobile-first.** Board columns reuse `.grid`.
- **≤40rem:** the header wraps, selects go full width, icon buttons keep their `aria-label`, and the dialog goes full width.
- **Everywhere:** 44 px `min-height`, `1rem` inputs, `overflow-wrap: anywhere`, `:focus-visible` and `:user-invalid`.

## 10. Milestones

About 31.5 h in total, including a 3 h buffer.

| # | Tasks | Check | h | Commit(s) |
|---|---|---|---|---|
| M0 | <ul><li>Scaffold and delete the demo files.</li><li>Add `favicon.svg`, `<link rel="icon">`, `<title>` and the meta description.</li><li>`git init -b main`, push, and import into Vercel.</li><li>30-min `@dnd-kit/core@6.3.1` spike on React 19.3, then delete it.</li></ul> | <ul><li>Build passes.</li><li>Production loads with no 404.</li><li>Spike noted. If it fails, M8 goes native.</li></ul> | 1.5 | `chore: scaffold Vite React TS app` |
| M1 | `store.ts` + tests | `npm test` passes, including 00:30 IST | 4.5 | `feat: task model, date selectors and reducer with tests` |
| M2 | `TaskForm`, `TaskCard` | B1 except focus/status | 3 | `feat: create, edit and complete tasks` |
| M3 | Sections, labels, Late, `useNow`, filters, `refocus`, toast | B2, B3, B1 focus/status | 3.5 | `feat: overdue/today/upcoming dashboard` · `feat: subject/priority/type filters` |
| M4 | <ul><li>`ls`, load and save.</li><li>Banners: Download, Resume, Dismiss.</li><li>Cross-tab sync.</li><li>Export/import, Undo, Remove samples.</li><li>README §6 stub.</li></ul> | B4; manual checks 3–7 | 4.5 | `feat: localStorage persistence with backup and cross-tab sync` · `feat: JSON export/import and undo` · `docs: README with state management` |
| — | **Base done (about 17 h). Redeploy and `git tag v0.1`.** | | | |
| M5 | <ul><li>Theme.</li><li>Layout at 320, 375, 768, 1280 and 1920 px.</li><li>Phone via `npm run dev -- --host`.</li></ul> | P4, P5. Adding over LAN `http://` works, which proves the ID fallback. | 2.5 | `feat: persisted dark/light theme` · `style: mobile-first responsive layout` |
| M6 | `Ring` | 0, partial and 100% | 1 | `feat: daily progress ring` |
| M6.5 | **Ship pass:** <ul><li>axe and a keyboard-only run in both themes.</li><li>10 minutes on a borrowed iPhone: add, focus return, pickers, No time, no zoom, theme.</li><li>README: URL first, brief checklist, run steps, 3 screenshots.</li></ul> | 0 axe violations; D1–D3 met | 1.5 | `fix: accessibility pass` · `docs: README and screenshots` |
| — | **Short-on-time cut line (about 22 h):** a complete, verified submission, with all base requirements and 3 of the 5 brownie points. | | | |
| M7 | Shortcuts, help, off switch, touch-hidden hints | P3. Tick a task, then `n` opens the form. Typing "n" in Title doesn't. | 1.5 | `feat: keyboard shortcuts with help and opt-out` |
| M8 | Board, grip, announcements | P1 on Chrome Android and Samsung Internet | 3 | `feat: drag-and-drop priority board` |
| M9 | NVDA, axe on the board, production Lighthouse | §11 targets | 1 | `fix: accessibility polish` |
| M10 | README shortcut and board sections, GIF | §12 | 1 | `docs: demo GIF and final README` |
| — | Buffer. Overruns above the cut line eat the brownie points below it first. | | 3 | |

**Behind on day 5?** Degrade in this order:
1. Drop the GIF.
2. Cut shortcuts to `n`, `?`, `Esc` and the off switch.
3. Switch to native HTML5 DnD (`draggable`, `dragover` + `preventDefault`, `drop`): about 30 lines, desktop only, and the `<select>` covers the rest.
4. Merge Later into Next 7 days.

**Never cut:**
- validation and `parse`/`isTask`
- the backup, `canSave`, and Download/Resume
- the save-failure banner
- cross-tab sync, since without it a stale tab overwrites the other's data
- Undo and export/import
- focus management, labels, visible focus and AA contrast
- the shortcut off switch, if shortcuts ship
- the README state section
- the production deploy

## 11. Testing and verification

**Unit tests** in `src/store.test.ts` with `node:test`:
- **Timezone:** the first line is `process.env.TZ = 'Asia/Kolkata'`. Node re-reads TZ, so `cross-env` isn't needed.
- **Imports:** use `import { ymd, dashboard, type Task } from './store.ts'`. Without the extension you get ERR_MODULE_NOT_FOUND, and value-importing `Task` fails at runtime.
- **Dates:** build them with `new Date(2026, 9, 22, h, m)`.

Cases:
1. **`ymd`** at 00:30 gives `'2026-10-22'`, which catches a "fix" that switches to `toISOString`.
2. **`addDays`** across a month end, a year end, 29 Feb 2028, and a negative offset.
3. **`dashboard`** at 16:00:
   - open yesterday is Overdue, done yesterday is Completed
   - done today is last in Today
   - +7 is in Next 7 days, +8 is in Later
   - bucket sizes add up to the input
4. **Midnight:** a task due on the 22nd is Today at 23:59 and Overdue at 00:00.
5. **`isLate`:** false at 14:00 and true at 14:01. Never true for untimed or done tasks.
6. **`byDue`:** timed before untimed, with priority as the tie-break.
7. **Filters:** `applyFilters` uses AND and is case-insensitive. `progress([])` gives `{done:0,total:0}`.
8. **`reducer`:** a frozen input is never mutated, and `merge` lets the incoming task win.
9. **`parse`:**
   - the seed round-trips
   - `'{bad'`, `version: 2` and non-arrays give `null`
   - `skipped` is counted and duplicates dropped
   - it rejects `2026-02-30`, `25:00`, a blank title, `'urgent'` and an array `due`
10. **`load`** with a `Map` fake:
    - missing gives the seed
    - corrupt gives one backup and keeps the original
    - a failing backup sets `canSave: false`
    - `null` runs in memory
11. **`codeHint`:** no hint for `'BCSE202L · DSA'`, `'CSE1001'` or `'Club'`, and a hint for `'BCS202L'`. `seed(now)` fills Overdue, Today (with one done) and Next 7 days.

**Manual checks on production:**
1. **Private window:** all sections filled and the ring at 1/3. "Remove samples" clears only `seed-*`.
2. **Form:** a blank title is blocked, and a past date goes to Overdue. A +12-day task, or one hidden by filters, gets a status message.
3. **Reload:** adds, edits, toggles and Undo persist. "No time" clears the time.
4. **Corrupt data:** run `localStorage.setItem('focusflow:data','{oops')`, then reload. Expect the banner and a backup key. Download works, and Dismiss hides it.
5. **Two tabs:** they stay in sync.
6. **Export/import:** export, delete all, then import, and the data is identical. Random JSON and a 2 MB file are rejected. A file with a bad row names the skip.
7. **Storage failures:** full storage shows the banner and keeps the task. With site data blocked in Chrome, the in-memory banner shows.
8. **Theme:** no flash at 6× throttle, and the date picker is themed.
9. **Shortcuts:** ignored in fields, dialogs and drags. They work right after a tick and stop when switched off.
10. **Keyboard:** a toggle or a board priority change keeps focus on the task or its old heading, and the toast announces it. Delete moves focus to Undo.
11. **Board:** mouse, touch (Chrome Android, Samsung Internet), grip keys and `<select>` all work, and the page scrolls.
12. **Midnight:** move the clock past midnight, and it rolls over within 60 s.
13. **Widths:** no horizontal scroll at 320 px or 200% zoom. At 1920 px, the three sections fill the width.

**A11y and Lighthouse:**
- **Lighthouse (mobile):** Accessibility 100, Best Practices 100, Performance ≥95.
- **axe/accesslint:** 0 violations in both views and themes.
- **Keyboard:** focus never lands on `<body>`.
- **NVDA:** names, heading counts, ring valuetext, board moves and the toast are all read.
- **Reduced motion:** emulated and checked.
- **Structure:** priority is shown as text, not colour alone. One `h1`, an `h2` per section, and `header`, `main` and `footer` landmarks.

## 12. Deployment and deliverables

**Hosting:**
1. Run `npm run build && npm run preview` and check for zero console errors.
2. Push `main` to the public `focusflow` repo.
3. In Vercel, Add New Project and import the repo. The Vite preset (`dist`) is auto-detected, so there's no `vercel.json`. If the build complains, set Node 22.x or 24.x.
4. Submit the **production domain**, not a preview URL, which may need a Vercel login. Check it in a private window on mobile data.
5. Put the URL on README line 1 and in the repo's About.

**README:**
1. Tagline: "Daily view of your DAs, labs, quizzes and FATs, built for VIT students around the DA/CAT/FAT cycle." Then the live link and GIF.
2. A checklist that mirrors the brief.
3. Light, dark and mobile screenshots.
4. Shortcuts.
5. Run steps: `npm ci`, `npm run dev`, `npm test`, `npm run build`.
6. State management.
7. Date rules.
8. Decisions: 3 dependencies; no Tailwind, date-fns or mock API.
9. Accessibility.
10. Limits:
    - data stays in one browser, so use Export
    - Safari may evict data after 7 days
    - last write wins across tabs
    - no notifications
11. "Not affiliated with VIT."

**State write-up** (≤300 words, with the §6 diagram), covering in order:
1. the source of truth versus local UI state
2. the 5 actions and why the reducer is pure
3. derived selectors, and why nothing derived is stored
4. persistence: version, validation, backup, and quota and blocked-storage handling
5. cross-tab sync
6. the theme living outside React
7. why not Redux, Zustand or Context

**Demo:**
- **GIF:** ≤20 s, under 5 MB, 1280×720, made with ScreenToGif:
  1. `N` to add a DA, which lands in Today
  2. tick it and watch the ring fill
  3. filter by subject
  4. drag to High
  5. `T` for the theme
  6. shrink to mobile
- **Screenshots:** `docs/light.png`, `docs/dark.png`, `docs/mobile.png` (360×800).

## 13. Risks and gotchas

| Risk | Mitigation |
|---|---|
| `@dnd-kit/core` 6.3.1 is untested on React 19.3, its docs say "Legacy", and its peer range `>=16.8` won't warn | Spike it in M0, with native DnD + `<select>` as the fallback |
| `touch-action: none` is unverified | Put it on the grip only and test on a real phone |
| UTC date bugs | Use only `ymd`/`toDate` (test 1). Grep for `new Date('` and `toISOString` before committing. |
| Reading `localStorage` throws when blocked, leaving a blank page | Guarded `ls`, plus an in-memory mode |
| `randomUUID` is undefined on LAN `http://` | `newId` fallback, tested in M5 |
| StrictMode runs things twice | Pure reducer, module-scope `load()`, idempotent effects (`if (!dlg.open)`) |
| Saving after a corrupt load wipes the data | Back up first, then `canSave = false` with Download/Resume |
| Cross-tab echo | Equal-string skip |
| Node type stripping | Erasable syntax, `.ts` + `type` imports, and tests excluded from `tsconfig.app.json`. Fallback: `npm i -D vitest@5.0.5`. |
| `TZ=… node` fails in cmd.exe | Set `process.env.TZ` in the test file |
| `Z:` network drive misses file events | `server.watch.usePolling: true` or a local disk |
| Focus lost on remount, and `autoFocus` in a hidden dialog | `refocus`, and focus Title after `showModal()` |
| Untrusted import text | `parse`, React text only, never `dangerouslySetInnerHTML` |
| Seeds return after "delete all" | Seed only when the key is missing |
| Evaluator opens it on another date | Seed dates are relative to the first visit |
| Safari eviction (unverified), iOS zoom, Firefox `/` | Export plus a README note, ≥16 px inputs, `preventDefault` |
| Branding | No VIT marks, a footer and README disclaimer, and only BCSE202L/P as real codes |
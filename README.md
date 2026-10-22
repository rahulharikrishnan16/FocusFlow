# FocusFlow

Daily view of your DAs, labs, quizzes and FATs, built for VIT students around the DA / CAT / FAT cycle.
Not affiliated with VIT.

> Live demo: _add the Vercel production URL here after deploy_

## Status

- [x] Create / edit / delete tasks: title, subject, type, due date (+ optional time), priority, done
- [x] Dashboard: Overdue, Today, Next 7 days, plus collapsed Later and Completed
- [x] Filter by subject, priority and type
- [x] Persistence in `localStorage` with backup of damaged data, cross-tab sync, JSON export/import, undo
- [ ] Dark/light theme, responsive polish, progress ring, keyboard shortcuts, drag-and-drop board (in progress)

## Run

```bash
npm ci
npm run dev      # http://localhost:5173
npm test         # date, bucket, reducer and persistence tests
npm run build
```

## State management

**Source of truth.** One `tasks: Task[]` held by `useReducer` in `App.tsx`. All logic lives in React-free `src/store.ts`, which is unit-tested with `node:test`.

**Actions.** Five: `add`, `patch`, `remove`, `replace` (other tab, remove samples), `merge` (import). The reducer is pure; ids, trimming and "now" are resolved before dispatch, so StrictMode's double-run is harmless. Undo is just the inverse action kept in the toast.

**Derived, never stored.** Overdue / Today / Next 7 days, the filtered list, the "x of y done today" summary and the subject list are all recomputed from `(tasks, filters, now)` on every render, so they cannot drift out of sync. `now` ticks every 60 s and when the tab is shown again, so the dashboard rolls over at midnight.

**UI state** (filters, open dialog, toast, banners) is plain `useState` and not persisted.

**Persistence.** One versioned key, `focusflow:data` (`{version, tasks}`). Every read (load, import, other-tab `storage` event) goes through `parse`, which validates each task and drops bad rows. Damaged data is copied to a backup key before anything is overwritten; if even the backup fails, saving pauses until the user resumes. A failed save (quota) shows a banner instead of losing the screen. Writes are skipped when the string is unchanged, which stops tab-to-tab echo. If storage is blocked the app runs in memory and says so.

```
UI event ─dispatch(Action)→ reducer → tasks ─┬→ selectors(tasks, filters, now) → render
                                             └→ effect: save() → localStorage['focusflow:data']
other tab: 'storage' event → parse() → dispatch(replace)
```

**Why not Redux, Zustand or Context?** One owner and five actions; `dispatch` goes at most three components deep.

## Date rules

Dates are local `YYYY-MM-DD` strings, never `toISOString()` or `new Date('YYYY-MM-DD')` (both are UTC and give yesterday between 00:00 and 05:30 IST). Today's tasks stay in Today even when done; open tasks before today are Overdue; open tasks up to 7 days out are Next 7 days.

process.env.TZ = 'Asia/Kolkata' // before any Date is built
import test from 'node:test'
import assert from 'node:assert/strict'
import { ymd, addDays, isDate, dashboard, bucketOf, isLate, byDue, applyFilters, progress, reducer, parse, load, seed, serialize, codeHint, KEY, type Task, type Store } from './store.ts'

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m)
const T = (o: Partial<Task> = {}): Task => ({ id: 'x', title: 't', subject: 'S', type: 'DA', due: '2026-10-22', time: '', priority: 'med', done: false, ...o })
const fake = (init: Record<string, string> = {}, failSet = false): Store & { m: Map<string, string> } => {
  const m = new Map(Object.entries(init))
  return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => { if (failSet) throw new Error('quota'); m.set(k, v) } }
}

test('ymd uses local time (00:30 IST is still the 22nd)', () => assert.equal(ymd(at(0, 30)), '2026-10-22'))

test('addDays crosses month, year and leap day', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2026-10-22', -22), '2026-09-30')
})

test('isDate rejects impossible dates', () => {
  assert.ok(isDate('2026-10-22'))
  assert.ok(!isDate('2026-02-30') && !isDate('2026-1-2') && !isDate(5))
})

test('dashboard buckets at 16:00', () => {
  const ts = [
    T({ id: 'a', due: '2026-10-21' }), T({ id: 'b', due: '2026-10-21', done: true }),
    T({ id: 'c', done: true }), T({ id: 'd' }), T({ id: 'e', due: '2026-10-29' }), T({ id: 'f', due: '2026-10-30' }),
  ]
  const d = dashboard(ts, at(16))
  assert.deepEqual(d.overdue.map(t => t.id), ['a'])
  assert.deepEqual(d.completed.map(t => t.id), ['b'])
  assert.deepEqual(d.today.map(t => t.id), ['d', 'c'], 'open first, done last')
  assert.deepEqual(d.upcoming.map(t => t.id), ['e'], '+7 is upcoming')
  assert.deepEqual(d.later.map(t => t.id), ['f'], '+8 is later')
  assert.equal(Object.values(d).flat().length, ts.length)
})

test('midnight rollover: due the 22nd is today at 23:59, overdue at 00:00 on the 23rd', () => {
  const t = T()
  assert.equal(bucketOf(t, at(23, 59)), 'today')
  assert.equal(bucketOf(t, at(0, 0, 23)), 'overdue')
})

test('isLate flips at 14:01 and ignores untimed or done tasks', () => {
  const t = T({ time: '14:00' })
  assert.ok(!isLate(t, at(14, 0)) && isLate(t, at(14, 1)))
  assert.ok(!isLate(T(), at(23, 0)) && !isLate(T({ time: '14:00', done: true }), at(15)))
})

test('byDue: timed before untimed, priority breaks ties', () => {
  const s = [T({ id: 'u' }), T({ id: 'lo', time: '10:00', priority: 'low' }), T({ id: 'hi', time: '10:00', priority: 'high' })].sort(byDue)
  assert.deepEqual(s.map(t => t.id), ['hi', 'lo', 'u'])
})

test('filters AND together, case-insensitively; empty progress', () => {
  const ts = [T({ id: '1', subject: 'Physics', priority: 'high' }), T({ id: '2', subject: 'physics', priority: 'low' }), T({ id: '3', subject: 'Maths', priority: 'high' })]
  assert.deepEqual(applyFilters(ts, { subject: 'PHYSICS', priority: 'high', type: '' }).map(t => t.id), ['1'])
  assert.deepEqual(progress([], at(9)), { done: 0, total: 0 })
})

test('reducer is pure and merge lets incoming win', () => {
  const s = Object.freeze([Object.freeze(T({ id: 'a' }))]) as Task[]
  assert.equal(reducer(s, { type: 'patch', id: 'a', patch: { done: true } })[0].done, true)
  assert.equal(s[0].done, false)
  const m = reducer(s, { type: 'merge', tasks: [T({ id: 'a', title: 'new' }), T({ id: 'b' })] })
  assert.deepEqual(m.map(t => t.title + t.id), ['newa', 'tb'])
  assert.deepEqual(reducer(s, { type: 'remove', id: 'a' }), [])
})

test('parse: seed round-trips, junk is null, bad rows are counted', () => {
  const now = at(10)
  assert.deepEqual(parse(serialize(seed(now)))?.tasks, seed(now))
  for (const bad of ['{bad', '{"version":2,"tasks":[]}', '{"version":1,"tasks":{}}', '[]', 'null', null]) assert.equal(parse(bad), null)
  const rows = [T({ id: 'ok' }), T({ id: 'ok' }), T({ id: 'd', due: '2026-02-30' }), T({ id: 't', time: '25:00' }), T({ id: 'e', title: '  ' }), { ...T({ id: 'p' }), priority: 'urgent' }, { ...T({ id: 'q' }), due: ['2026-10-22'] }]
  const p = parse(JSON.stringify({ version: 1, tasks: rows }))
  assert.equal(p?.tasks.length, 1)
  assert.equal(p?.skipped, 6)
})

test('load: missing seeds, corrupt backs up once and keeps the original', () => {
  const now = at(10)
  assert.equal(load(fake(), now).tasks.length, 8)
  const st = fake({ [KEY]: '{oops' })
  const l = load(st, now)
  assert.deepEqual(l.tasks, [])
  assert.ok(l.canSave && l.damaged === '{oops')
  assert.equal(st.m.get(KEY), '{oops', 'original untouched')
  assert.equal([...st.m.keys()].filter(k => k.includes('backup')).length, 1)
})

test('load: failing backup pauses saving; null storage runs in memory', () => {
  const l = load(fake({ [KEY]: '{oops' }, true), at(10))
  assert.ok(!l.canSave && l.notice?.sticky)
  assert.ok(!load(null, at(10)).canSave)
})

test('load: valid data is used as-is with no notice', () => {
  const l = load(fake({ [KEY]: serialize([T({ id: 'a' })]) }), at(10))
  assert.equal(l.tasks.length, 1)
  assert.equal(l.notice, null)
})

test('codeHint', () => {
  for (const ok of ['BCSE202L · DSA', 'CSE1001', 'Club', 'Engineering Physics']) assert.equal(codeHint(ok), '')
  assert.ok(codeHint('BCS202L'))
})

test('seed fills overdue, today (one done) and upcoming', () => {
  const d = dashboard(seed(at(10)), at(10))
  assert.ok(d.overdue.length && d.upcoming.length && d.later.length)
  assert.deepEqual(progress(seed(at(10)), at(10)), { done: 1, total: 3 })
})

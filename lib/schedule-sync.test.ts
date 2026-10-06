import test from 'node:test'
import assert from 'node:assert/strict'
import { diffSchedule, mergeSchedule, rosterRows, type DemandRow, type ScheduleState } from './schedule-sync.ts'
import type { RosterEntry } from './types.ts'

const slot = (id: string, over: Partial<DemandRow> = {}): DemandRow => ({
  id, vacancyId: 'v', date: '2027-03-01', placeId: 'hall-a', section: null,
  headcount: 2, start: '08:00', end: '16:30', note: null, ...over,
})
const shift = (id: string, over: Partial<RosterEntry> = {}): RosterEntry => ({
  id, vacancyId: 'v', date: '2027-03-01', placeId: 'hall-a', section: null, workerId: '2',
  extra: false, extraReason: null, standingId: null, start: '08:00', end: '16:30',
  outcome: 'planned', actualEnd: null, coversShiftId: null, note: null, ...over,
})
const state = (demand: DemandRow[], roster: RosterEntry[]): ScheduleState => ({
  demand, roster: rosterRows(roster), standing: [], offers: [],
})

test('an unchanged schedule sends nothing', () => {
  const base = state([slot('1'), slot('derived-9', { placeId: 'hall-b' })], [shift('10')])
  assert.equal(diffSchedule(base, structuredClone(base)), null)
})

test('one edit sends one row — not the whole schedule, not the inferred slots', () => {
  const base = state(
    [slot('1'), slot('derived-9', { placeId: 'hall-b' })],
    Array.from({ length: 600 }, (_, i) => shift(String(100 + i), { date: `2027-04-${String((i % 28) + 1).padStart(2, '0')}`, section: String(i) })),
  )
  const current = structuredClone(base)
  current.demand[0] = { ...current.demand[0], headcount: 3 }
  const diff = diffSchedule(base, current)
  assert.ok(diff)
  assert.deepEqual(diff.demand.map(row => row.id), ['1'])
  assert.equal(diff.roster.length, 0)
  assert.equal(diff.standing, undefined)
})

test('only rows the server stored are deleted on the server', () => {
  const base = state([slot('1'), slot('derived-9', { placeId: 'hall-b' }), slot('d-new')], [shift('10'), shift('r-tmp', { workerId: '5' })])
  const current = state([], [])
  const diff = diffSchedule(base, current)
  assert.ok(diff)
  assert.deepEqual(diff.deleteDemandIds, ['1'])
  assert.deepEqual(diff.deleteRosterIds, ['10'])
})

test('a change made elsewhere survives an unrelated edit here', () => {
  // Hall B's worker was changed by the Warehouse sync after the page loaded.
  const base = state([slot('1'), slot('2', { placeId: 'hall-b' })], [shift('10'), shift('11', { placeId: 'hall-b' })])
  const theirs = state([slot('1'), slot('2', { placeId: 'hall-b' })], [shift('10'), shift('11', { placeId: 'hall-b', workerId: '5' })])
  const mine = structuredClone(base)
  mine.demand[0] = { ...mine.demand[0], headcount: 3 }
  const merged = mergeSchedule(base, mine, theirs)
  assert.equal(merged.roster.find(row => row.id === '11')?.workerId, '5')
  assert.equal(merged.demand.find(row => row.id === '1')?.headcount, 3)
  const diff = diffSchedule(theirs, merged)
  assert.ok(diff)
  assert.deepEqual(diff.roster, [])
  assert.deepEqual(diff.demand.map(row => row.id), ['1'])
})

test('merge: my edit wins on the same row, their delete wins over my edit, my additions stay', () => {
  const base = state([slot('1'), slot('2', { placeId: 'hall-b' })], [])
  const theirs = state([slot('1', { headcount: 5 })], [])
  const mine = state([slot('1', { headcount: 4 }), slot('2', { placeId: 'hall-b', headcount: 9 }), slot('d-new', { placeId: 'hall-c' })], [])
  const merged = mergeSchedule(base, mine, theirs)
  assert.deepEqual(merged.demand.map(row => [row.id, row.headcount]), [['1', 4], ['d-new', 2]])
})

test('positions follow the order inside each slot', () => {
  const rows = rosterRows([shift('a'), shift('b', { placeId: 'hall-b' }), shift('c'), shift('d', { date: '2027-03-02' })])
  assert.deepEqual(rows.map(row => [row.id, row.position]), [['a', 0], ['b', 0], ['c', 1], ['d', 0]])
})

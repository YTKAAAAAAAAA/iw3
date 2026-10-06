import test from 'node:test'
import assert from 'node:assert/strict'
import { alreadyOnVacancy, availabilityLabel, availabilityOver, blockOn, isCourseDay } from './derive.ts'
import type { Leave, RosterEntry, Worker } from './types.ts'

const worker = (over: Partial<Worker> = {}): Worker => ({
  id: 'w-1', flexpediaId: null, initials: 'XX', firstName: 'Jan', insertion: null,
  lastName: 'Bakker', fullName: 'Jan Bakker', postCode: null,
  hasCar: true, hasBike: null, hasVog: true, courseDays: [], status: 'active', dismissedAt: null, companyAccess: [], ...over,
})
const shift = (vacancyId: string, date: string, workerId: string | null, outcome: RosterEntry['outcome'] = 'planned'): RosterEntry => ({
  id: `r-${vacancyId}-${date}`, vacancyId, date, placeId: null, section: null, workerId, extra: false,
  extraReason: null, standingId: null, start: null, end: null, outcome, actualEnd: null, coversShiftId: null, note: null,
})
const leave = (workerId: string, date: string): Leave => ({ id: `l-${date}`, workerId, date, reason: 'Holiday', paidLeave: true })

/* Mon 17 – Fri 21 June 2024. */
const WEEK = ['2024-06-17', '2024-06-18', '2024-06-19', '2024-06-20', '2024-06-21']

test('the same person cannot hold the same job twice on one day', () => {
  const roster = [shift('v-1', '2024-06-18', 'w-1')]
  assert.equal(alreadyOnVacancy(roster, 'v-1', '2024-06-18', 'w-1'), true)
  /* Another job the same day is a normal split, not a duplicate. */
  assert.equal(alreadyOnVacancy(roster, 'v-2', '2024-06-18', 'w-1'), false)
  /* A cancelled shift is not somebody being there. */
  assert.equal(alreadyOnVacancy([shift('v-1', '2024-06-18', 'w-1', 'cancelled')], 'v-1', '2024-06-18', 'w-1'), false)
})

test('a course day repeats every week without being entered', () => {
  const student = worker({ courseDays: ['wed'] })
  assert.equal(isCourseDay(student, '2024-06-19'), true)   // Wednesday
  assert.equal(isCourseDay(student, '2024-06-26'), true)   // the next one
  assert.equal(isCourseDay(student, '2024-06-18'), false)
})

test('each way of being unavailable is named, in the order that matters', () => {
  const w = worker({ courseDays: ['wed'] })
  assert.equal(blockOn(w, '2024-06-17', 'v-1', [], []), 'free')
  assert.equal(blockOn(w, '2024-06-19', 'v-1', [], []), 'course')
  assert.equal(blockOn(w, '2024-06-17', 'v-1', [], [leave('w-1', '2024-06-17')]), 'leave')
  assert.equal(blockOn(w, '2024-06-17', 'v-1', [shift('v-1', '2024-06-17', 'w-1')], []), 'duplicate')
  assert.equal(blockOn(w, '2024-06-17', 'v-1', [shift('v-2', '2024-06-17', 'w-1')], []), 'busy')
  /* Leave outranks a course: both stop the day, and leave is the exception. */
  assert.equal(blockOn(w, '2024-06-19', 'v-1', [], [leave('w-1', '2024-06-19')]), 'leave')
})

test('free for the whole run', () => {
  const a = availabilityOver(worker(), WEEK, 'v-1', [], [])
  assert.equal(a.fullyFree, true)
  assert.equal(a.freeFrom, '2024-06-17')
  assert.equal(availabilityLabel(a), 'Free all 5 days')
})

test('busy at the start reports the day they come free, not just "busy"', () => {
  const roster = [shift('v-2', '2024-06-17', 'w-1'), shift('v-2', '2024-06-18', 'w-1')]
  const a = availabilityOver(worker(), WEEK, 'v-1', roster, [])
  assert.equal(a.freeFrom, '2024-06-19')
  assert.equal(a.free.length, 3)
  assert.match(availabilityLabel(a), /^Free from 19\.06\.2024 · 2 of 5 taken \(2 on other work\)$/)
})

test('a gap in the middle means there is no day to be free from', () => {
  /* Free Mon–Tue, busy Wed, free Thu–Fri: the honest answer is not a date. */
  const a = availabilityOver(worker(), WEEK, 'v-1', [shift('v-2', '2024-06-19', 'w-1')], [])
  assert.equal(a.freeFrom, '2024-06-20')
  assert.equal(a.free.length, 4)
})

test('busy every single day says so instead of naming a date', () => {
  const roster = WEEK.map(d => shift('v-2', d, 'w-1'))
  const a = availabilityOver(worker(), WEEK, 'v-1', roster, [])
  assert.equal(a.freeFrom, null)
  assert.equal(availabilityLabel(a), 'Busy every day of this period')
})

test('the reasons are counted separately, so the row can say what is in the way', () => {
  const w = worker({ courseDays: ['wed'] })
  const a = availabilityOver(w, WEEK, 'v-1', [shift('v-1', '2024-06-17', 'w-1')], [leave('w-1', '2024-06-21')])
  assert.deepEqual(a.reasons, { leave: 1, course: 1, busy: 0, duplicate: 1 })
})

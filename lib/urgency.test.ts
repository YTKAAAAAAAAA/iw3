import test from 'node:test'
import assert from 'node:assert/strict'
import { dayNeed, sameDayClash, timeRange, vacancyAttention, vacancyStatus } from './derive.ts'
import type { Demand, Leave, RosterEntry, StandingAssignment, Vacancy } from './types.ts'

const TODAY = '2024-06-18' // a Tuesday

const vacancy = (id: string, startDate: string, endDate: string | null = null, count = 1): Vacancy => ({
  id, title: id, companyId: 'c', address: '', lat: null, lon: null, description: '',
  startDate, endDate, trackHoursManually: false, places: [], carOnly: false,
  defaultHours: null, projectCode: null,
  schedule: { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'], start: { kind: 'fixed', time: '08:00' },
    end: { kind: 'fixed', time: '16:00' }, headcount: { kind: 'fixed', count }, horizon: 'week' },
})
const shift = (vacancyId: string, date: string, workerId: string | null, over: Partial<RosterEntry> = {}): RosterEntry => ({
  id: `r-${vacancyId}-${date}-${workerId}`, vacancyId, date, placeId: 'p', section: null, workerId,
  extra: false, extraReason: null, standingId: null, start: '08:00', end: '16:00',
  outcome: 'planned', actualEnd: null, coversShiftId: null, note: null, ...over,
})
const standing = (vacancyId: string, workerId: string, to: string | null = null): StandingAssignment => ({
  id: `sa-${vacancyId}-${workerId}`, vacancyId, workerId, placeId: 'p', section: null,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'], start: null, end: null, from: '2024-01-01', to, note: null,
})
const slot = (vacancyId: string, date: string, headcount: number): Demand => ({
  id: `d-${vacancyId}-${date}`, vacancyId, date, placeId: 'p', section: null,
  headcount, start: null, end: null, note: null,
})
const leave = (workerId: string, date: string): Leave => ({ id: `l-${workerId}-${date}`, workerId, date, reason: 'Day off', paidLeave: false })

test('open until the first day, in progress from it — whoever is on it', () => {
  assert.equal(vacancyStatus(vacancy('a', '2024-06-25'), [], [shift('a', '2024-06-25', 'w')], TODAY), 'open')
  assert.equal(vacancyStatus(vacancy('a', TODAY), [], [], TODAY), 'in_progress')
  assert.equal(vacancyStatus(vacancy('a', '2024-06-01', '2024-06-17'), [], [], TODAY), 'archived')
  assert.equal(vacancyStatus({ ...vacancy('a', '2024-06-01'), archivedAt: '2024-06-10T10:00:00Z' }, [], [], TODAY), 'archived')
  assert.equal(vacancyStatus(vacancy('a', '2024-06-10', TODAY), [], [], TODAY), 'in_progress')
})

test('in progress: a future working day without its people needs attention; today never does', () => {
  const v = vacancy('a', '2024-06-10')
  const filledFromTomorrow = ['2024-06-19', '2024-06-20', '2024-06-21', '2024-06-24', '2024-06-25', '2024-06-26',
    '2024-06-27', '2024-06-28', '2024-07-01', '2024-07-02'].map(date => shift('a', date, 'w'))
  // Today is empty, every working day ahead is covered: nothing to do.
  assert.equal(vacancyAttention(v, [], filledFromTomorrow, [], [], TODAY).needsAttention, false)
  // Thursday loses its person: Thursday, and only Thursday, is short.
  const gap = filledFromTomorrow.filter(s => s.date !== '2024-06-20')
  const attention = vacancyAttention(v, [], gap, [], [], TODAY)
  assert.equal(attention.needsAttention, true)
  assert.deepEqual(attention.shortDays.map(d => d.date), ['2024-06-20'])
})

test('open: only within three days of the start does a gap need attention', () => {
  assert.equal(vacancyAttention(vacancy('a', '2024-06-24'), [], [], [], [], TODAY).needsAttention, false)
  const soon = vacancyAttention(vacancy('a', '2024-06-20'), [], [], [], [], TODAY)
  assert.equal(soon.status, 'open')
  assert.equal(soon.daysToStart, 2)
  assert.equal(soon.needsAttention, true)
  assert.equal(soon.shortDays[0].date, '2024-06-20')
})

test('standing people count, people on leave and extras do not', () => {
  const v = vacancy('a', '2024-06-10')
  assert.equal(dayNeed(v, '2024-06-20', [], [], [standing('a', 'w')], []).staffed, 1)
  assert.equal(dayNeed(v, '2024-06-20', [], [], [standing('a', 'w')], [leave('w', '2024-06-20')]).staffed, 0)
  assert.equal(dayNeed(v, '2024-06-20', [], [shift('a', '2024-06-20', 'x', { extra: true })], [], []).staffed, 0)
  // One person with both a shift and a standing arrangement is one person.
  assert.equal(dayNeed(v, '2024-06-20', [], [shift('a', '2024-06-20', 'w')], [standing('a', 'w')], []).staffed, 1)
})

test('an ordered slot sets the need — also on a day outside the fixed pattern', () => {
  const v = vacancy('a', '2024-06-10')
  assert.equal(dayNeed(v, '2024-06-22', [], [], [], []).needed, 0) // Saturday, no slot
  assert.equal(dayNeed(v, '2024-06-22', [slot('a', '2024-06-22', 3)], [], [], []).needed, 3)
  assert.equal(dayNeed(v, '2024-06-20', [slot('a', '2024-06-20', 2)], [], [], []).needed, 2)
})

test('two shifts one day: blocked under an hour apart, otherwise possible', () => {
  assert.equal(sameDayClash({ start: '08:00', end: '16:00' }, { start: '12:00', end: '18:00' }), 'blocked')
  assert.equal(sameDayClash({ start: '08:00', end: '16:30' }, { start: '17:00', end: '20:00' }), 'blocked')
  assert.equal(sameDayClash({ start: '08:00', end: '16:00' }, { start: '17:00', end: '20:00' }), 'possible')
  assert.equal(sameDayClash({ start: '17:00', end: '20:00' }, { start: '08:00', end: '16:00' }), 'possible')
  // The first job's end is unknown: they may leave early — offer, with a warning.
  assert.equal(sameDayClash({ start: '08:00', end: null }, { start: '13:00', end: null }), 'possible')
  assert.equal(sameDayClash({ start: '08:00', end: null }, { start: '08:30', end: null }), 'blocked')
  assert.equal(sameDayClash({ start: null, end: null }, { start: '08:00', end: '16:00' }), 'possible')
})

test('time ranges say what is known', () => {
  assert.equal(timeRange('08:00', '16:30'), '08:00–16:30')
  assert.equal(timeRange('08:00', null), 'from 08:00')
  assert.equal(timeRange(null, '16:30'), 'until 16:30')
  assert.equal(timeRange(null, null), '')
})

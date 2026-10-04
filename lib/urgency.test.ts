import test from 'node:test'
import assert from 'node:assert/strict'
import { sortByUrgency, urgencyNote, vacancyStatus, vacancyUrgency } from './derive.ts'
import type { Demand, RosterEntry, StandingAssignment, Vacancy } from './types.ts'

const TODAY = '2024-06-18'

const vacancy = (id: string, startDate: string, endDate: string | null = null): Vacancy => ({
  id, title: id, companyId: 'c', address: '', lat: null, lon: null, description: '',
  startDate, endDate, trackHoursManually: false, places: [], carOnly: false,
  defaultHours: null, projectCode: null,
  schedule: { weekdays: [], start: { kind: 'fixed', time: '08:00' }, end: { kind: 'fixed', time: '16:00' },
    headcount: { kind: 'fixed', count: 1 }, horizon: 'week' },
})
const shift = (vacancyId: string, date: string, workerId: string | null): RosterEntry => ({
  id: `r-${vacancyId}-${date}`, vacancyId, date, placeId: null, section: null, workerId,
  extra: false, extraReason: null, standingId: null, start: null, end: null,
  outcome: 'planned', actualEnd: null, coversShiftId: null, note: null,
})
const standing = (vacancyId: string, to: string | null): StandingAssignment => ({
  id: `sa-${vacancyId}`, vacancyId, workerId: 'w-1', placeId: null, section: null,
  weekdays: ['mon'], start: null, end: null, from: '2024-01-01', to, note: null,
})
const demand = (vacancyId: string, date = TODAY, headcount = 1): Demand => ({
  id: `d-${vacancyId}-${date}`, vacancyId, date, placeId: null, section: null,
  headcount, start: null, end: null, note: null,
})

test('started and empty is late; starting within three days is soon', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-10'), [], [], TODAY, [demand('a')]), 'late')
  assert.equal(vacancyUrgency(vacancy('a', TODAY), [], [], TODAY, [demand('a')]), 'soon')
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-21'), [], [], TODAY, [demand('a', '2024-06-21')]), 'soon')
})

test('the fourth day out is not urgent yet', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-22'), [], [], TODAY, [demand('a', '2024-06-22')]), 'none')
})

test('no dated demand or uncovered shift means the started vacancy is not unstaffed', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-17'), [], [], TODAY), 'none')
})

test('an uncovered shift or unmet dated headcount is unstaffed; filled demand is not', () => {
  const v = vacancy('a', '2024-06-10')
  assert.equal(vacancyUrgency(v, [], [shift('a', TODAY, 'w-1')], TODAY, [demand('a')]), 'none')
  assert.equal(vacancyUrgency(v, [standing('a', null)], [], TODAY), 'none')
  assert.equal(vacancyUrgency(v, [ { ...standing('a', null), weekdays: ['tue'] } ], [], TODAY, [demand('a')]), 'none')
  assert.equal(vacancyUrgency(v, [], [shift('a', TODAY, null)], TODAY), 'late')
  assert.equal(vacancyUrgency(v, [], [], TODAY, [demand('a', TODAY, 2)]), 'late')
  assert.equal(vacancyUrgency(v, [], [shift('a', TODAY, 'w-1')], TODAY, [demand('a', TODAY, 2)]), 'late')
  assert.equal(vacancyUrgency(v, [standing('a', '2024-06-01')], [], TODAY), 'none')
})

test('an ended vacancy is history, not an emergency', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-01-01', '2024-06-01'), [], [], TODAY), 'none')
})

test('manual archiving preserves vacancy dates and can be reversed', () => {
  const active = vacancy('a', TODAY, '2024-06-20')
  assert.equal(vacancyStatus(active, [], [], TODAY), 'open')
  assert.equal(vacancyStatus({ ...active, archivedAt: '2024-06-18T12:00:00Z' }, [], [], TODAY), 'archived')
  assert.equal(vacancyUrgency({ ...active, archivedAt: '2024-06-18T12:00:00Z' }, [], [], TODAY, [demand('a')]), 'none')
  assert.equal(vacancyStatus({ ...active, archivedAt: null }, [], [], TODAY), 'open')
})

test('a vacancy with an end date stays active for that entire date', () => {
  const active = vacancy('a', '2024-06-10', '2024-06-18')
  assert.equal(vacancyStatus(active, [], [], TODAY), 'open')
  assert.equal(vacancyStatus(active, [], [], '2024-06-19'), 'archived')
})

test('late first, then soon, and inside each group the nearest date', () => {
  const list = [
    vacancy('quiet', '2024-08-01'),
    vacancy('soon-later', '2024-06-21'),
    vacancy('late-old', '2024-05-01'),
    vacancy('soon-today', TODAY),
    vacancy('late-recent', '2024-06-17'),
  ]
  const demandRows = [
    demand('soon-later', '2024-06-21'),
    demand('late-old'),
    demand('soon-today'),
    demand('late-recent'),
  ]
  assert.deepEqual(sortByUrgency(list, [], [], TODAY, demandRows).map(v => v.id),
    ['late-old', 'late-recent', 'soon-today', 'soon-later', 'quiet'])
})

test('the row says why it is coloured', () => {
  assert.equal(urgencyNote(vacancy('a', TODAY), 'soon', TODAY), 'Starts today — nobody on it')
  assert.equal(urgencyNote(vacancy('a', '2024-06-19'), 'soon', TODAY), 'Starts tomorrow — nobody on it')
  assert.equal(urgencyNote(vacancy('a', '2024-06-17'), 'late', TODAY), 'Started yesterday — nobody on it')
  assert.equal(urgencyNote(vacancy('a', '2024-06-10'), 'none', TODAY), null)
})

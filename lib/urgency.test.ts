import test from 'node:test'
import assert from 'node:assert/strict'
import { sortByUrgency, urgencyNote, vacancyUrgency } from './derive.ts'
import type { RosterEntry, StandingAssignment, Vacancy } from './types.ts'

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

test('started and empty is late; starting within three days is soon', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-10'), [], [], TODAY), 'late')
  assert.equal(vacancyUrgency(vacancy('a', TODAY), [], [], TODAY), 'soon')
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-21'), [], [], TODAY), 'soon')
})

test('the fourth day out is not urgent yet', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-06-22'), [], [], TODAY), 'none')
})

test('somebody on it is the whole point — a staffed vacancy is never coloured', () => {
  const v = vacancy('a', '2024-06-10')
  assert.equal(vacancyUrgency(v, [], [shift('a', '2024-06-19', 'w-1')], TODAY), 'none')
  assert.equal(vacancyUrgency(v, [standing('a', null)], [], TODAY), 'none')
  /* An empty shift is not staffing: the slot exists and nobody is in it. */
  assert.equal(vacancyUrgency(v, [], [shift('a', '2024-06-19', null)], TODAY), 'late')
  /* Neither is an arrangement that has already ended. */
  assert.equal(vacancyUrgency(v, [standing('a', '2024-06-01')], [], TODAY), 'late')
})

test('an ended vacancy is history, not an emergency', () => {
  assert.equal(vacancyUrgency(vacancy('a', '2024-01-01', '2024-06-01'), [], [], TODAY), 'none')
})

test('late first, then soon, and inside each group the nearest date', () => {
  const list = [
    vacancy('quiet', '2024-08-01'),
    vacancy('soon-later', '2024-06-21'),
    vacancy('late-old', '2024-05-01'),
    vacancy('soon-today', TODAY),
    vacancy('late-recent', '2024-06-17'),
  ]
  assert.deepEqual(sortByUrgency(list, [], [], TODAY).map(v => v.id),
    ['late-old', 'late-recent', 'soon-today', 'soon-later', 'quiet'])
})

test('the row says why it is coloured', () => {
  assert.equal(urgencyNote(vacancy('a', TODAY), 'soon', TODAY), 'Starts today — nobody on it')
  assert.equal(urgencyNote(vacancy('a', '2024-06-19'), 'soon', TODAY), 'Starts tomorrow — nobody on it')
  assert.equal(urgencyNote(vacancy('a', '2024-06-17'), 'late', TODAY), 'Started yesterday — nobody on it')
  assert.equal(urgencyNote(vacancy('a', '2024-06-10'), 'none', TODAY), null)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { parseScheduleSave, type ScheduleSaveInput } from './schedule-persistence.ts'
import type { Weekday } from './types.ts'

const snapshot = (): Required<ScheduleSaveInput> => ({
  revision: 0,
  demand: [{
    id: 'warehouse-slot-1', vacancyId: 'warehouse', date: '2026-09-28',
    placeId: 'slego', section: null, headcount: 2, start: '07:00', end: '15:00', note: null,
  }],
  roster: [{
    id: 'r-123', vacancyId: 'warehouse', date: '2026-09-28',
    placeId: 'slego', section: null, workerId: '12', extra: false,
    extraReason: null, standingId: null, start: '07:00', end: '15:00', note: null,
  }],
  deleteDemandIds: [],
  deleteRosterIds: [],
  standing: [{
    id: 'standing-1', vacancyId: 'warehouse', workerId: '12',
    placeId: 'slego', section: null, weekdays: ['mon'], start: null, end: null,
    from: '2026-09-28', to: null, note: null,
  }],
  offers: [{
    id: 'offer-1', vacancyId: 'warehouse', workerId: '12', date: '2026-09-28',
    status: 'declined', note: null, at: '2026-09-27T10:00:00.000Z',
  }],
})

test('parses scoped schedule snapshots containing client temporary IDs', () => {
  const parsed = parseScheduleSave(snapshot(), 'warehouse')
  assert.ok(parsed)
  assert.equal(parsed.demand[0].id, 'warehouse-slot-1')
  assert.equal(parsed.roster[0].workerId, '12')
  assert.equal(parsed.offers?.[0].status, 'declined')
})

test('rejects invalid and duplicate candidate offer records', () => {
  const invalid = snapshot()
  invalid.offers[0].status = 'accepted' as 'declined'
  assert.equal(parseScheduleSave(invalid, 'warehouse'), null)

  const duplicate = snapshot()
  duplicate.offers.push({ ...duplicate.offers[0], id: 'offer-2' })
  assert.equal(parseScheduleSave(duplicate, 'warehouse'), null)
})

test('rejects snapshots that try to assign data to another vacancy', () => {
  const input = snapshot()
  input.roster[0].vacancyId = 'another-vacancy'
  assert.equal(parseScheduleSave(input, 'warehouse'), null)
})

test('rejects malformed time, invalid dates, duplicate IDs, and unsafe removals', () => {
  const badTime = snapshot()
  badTime.demand[0].start = '25:00'
  assert.equal(parseScheduleSave(badTime, 'warehouse'), null)

  const badDate = snapshot()
  badDate.roster[0].date = '2026-02-30'
  assert.equal(parseScheduleSave(badDate, 'warehouse'), null)

  const duplicate = snapshot()
  duplicate.roster.push({ ...duplicate.roster[0] })
  assert.equal(parseScheduleSave(duplicate, 'warehouse'), null)

  const unsafeDelete = snapshot()
  unsafeDelete.deleteRosterIds = ['tmp-r-123']
  assert.equal(parseScheduleSave(unsafeDelete, 'warehouse'), null)
})

test('a save of changes only may leave out the standing and offer lists', () => {
  const input: Partial<ScheduleSaveInput> = snapshot()
  delete input.standing
  delete input.offers
  const parsed = parseScheduleSave({ ...input, roster: [{ ...snapshot().roster[0], position: 3 }] }, 'warehouse')
  assert.ok(parsed)
  assert.equal(parsed.standing, undefined)
  assert.equal(parsed.roster[0].position, 3)
  assert.equal(parseScheduleSave({ ...snapshot(), roster: [{ ...snapshot().roster[0], position: -1 }] }, 'warehouse'), null)
})

test('requires standing assignments to have valid weekdays and bounded date ranges', () => {
  const badWeekday = snapshot()
  badWeekday.standing[0].weekdays = ['funday'] as unknown as Weekday[]
  assert.equal(parseScheduleSave(badWeekday, 'warehouse'), null)

  const badRange = snapshot()
  badRange.standing[0].to = '2026-09-27'
  assert.equal(parseScheduleSave(badRange, 'warehouse'), null)
})

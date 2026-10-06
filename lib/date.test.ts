import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDate, formatDateTime, formatShortDate, formatTimeOfDay, todayInAmsterdam } from './types.ts'

test('today follows the Amsterdam calendar date across the UTC date boundary', () => {
  assert.equal(todayInAmsterdam(new Date('2026-09-26T21:59:00.000Z')), '2026-09-26')
  assert.equal(todayInAmsterdam(new Date('2026-09-26T22:00:00.000Z')), '2026-09-27')
})

test('dates are written in the European numeric form', () => {
  assert.equal(formatDate('2026-10-04'), '04.10.2026')
  assert.equal(formatDate(null), '—')
  assert.equal(formatShortDate('2026-10-04'), '04.10')
})

test('timestamps are shown in Amsterdam time on a 24-hour clock', () => {
  // 22:30 UTC is already the next day in Amsterdam (UTC+2 in summer).
  assert.equal(formatDate('2026-09-26T22:30:00.000Z'), '27.09.2026')
  assert.equal(formatDateTime('2026-09-26T22:30:00.000Z'), '27.09.2026 00:30')
  assert.equal(formatDateTime('2026-12-01T13:05:00.000Z'), '01.12.2026 14:05')
  assert.equal(formatTimeOfDay('2026-12-01T13:05:00.000Z'), '14:05')
})

test('typed dates are read day first in every common form', async () => {
  const { parseDate } = await import('./types.ts')
  assert.equal(parseDate('05.10.2026'), '2026-10-05')
  assert.equal(parseDate('5.10.2026'), '2026-10-05')
  assert.equal(parseDate('05-10-2026'), '2026-10-05')
  assert.equal(parseDate('05/10/26'), '2026-10-05')
  assert.equal(parseDate('05102026'), '2026-10-05')
  assert.equal(parseDate('2026-10-05'), '2026-10-05')
  assert.equal(parseDate('31.02.2026'), null)
  assert.equal(parseDate('10/6'), null)
  assert.equal(parseDate(''), null)
})

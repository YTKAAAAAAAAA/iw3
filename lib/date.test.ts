import test from 'node:test'
import assert from 'node:assert/strict'
import { todayInAmsterdam } from './types.ts'

test('today follows the Amsterdam calendar date across the UTC date boundary', () => {
  assert.equal(todayInAmsterdam(new Date('2026-09-26T21:59:00.000Z')), '2026-09-26')
  assert.equal(todayInAmsterdam(new Date('2026-09-26T22:00:00.000Z')), '2026-09-27')
})

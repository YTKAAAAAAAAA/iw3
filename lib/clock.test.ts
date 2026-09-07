import test from 'node:test'
import assert from 'node:assert/strict'
import { parseClock } from './types.ts'

/* Typed times. Read on every schedule screen, and the one place a mistyped
   character could become a wrong hour rather than an empty field.
   (timingOf / slotTimeLabel next door are not covered here: lib/derive.ts
   imports './types' without a file extension, which Node's own resolver
   cannot follow — that is a job for a test runner with the bundler's
   resolution, not a reason to test a copy of the logic.) */

test('a bare hour is a time', () => {
  assert.equal(parseClock('7'), '07:00')
  assert.equal(parseClock('07'), '07:00')
  assert.equal(parseClock('18'), '18:00')
})

test('the separator is optional and may be a dot or a space', () => {
  for (const typed of ['730', '7:30', '7.30', '7 30', '07:30']) assert.equal(parseClock(typed), '07:30')
})

test('an hour that does not exist clears the field instead of guessing', () => {
  for (const typed of ['25:00', '7:75', 'half eight', '--:--', '7:3', '']) assert.equal(parseClock(typed), null)
})

test('midnight and the last minute of the day both survive', () => {
  assert.equal(parseClock('0'), '00:00')
  assert.equal(parseClock('2359'), '23:59')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { upcomingAbsences } from './derive.ts'
import type { Leave } from './types.ts'

const leave = (workerId: string, date: string, reason = 'Vacation'): Leave =>
  ({ id: `${workerId}-${date}`, workerId, date, reason, paidLeave: true })

test('consecutive leave days become one period and past periods are dropped', () => {
  const leaves = [
    leave('1', '2026-06-28'), leave('1', '2026-06-29'),
    leave('2', '2026-10-06'), leave('2', '2026-10-07'), leave('2', '2026-10-08'),
    leave('3', '2026-10-03'), leave('3', '2026-10-04'), leave('3', '2026-10-05', 'Course'),
  ]
  assert.deepEqual(upcomingAbsences(leaves, '2026-10-04'), [
    { workerId: '3', from: '2026-10-03', to: '2026-10-04', reason: 'Vacation' },
    { workerId: '3', from: '2026-10-05', to: '2026-10-05', reason: 'Course' },
    { workerId: '2', from: '2026-10-06', to: '2026-10-08', reason: 'Vacation' },
  ])
})

test('a gap of one day starts a new period', () => {
  assert.equal(upcomingAbsences([leave('1', '2026-10-05'), leave('1', '2026-10-07')], '2026-10-01').length, 2)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { findWorkerIdentityConflicts, manualWorkerIdentityKey } from './manual-worker.ts'

const existing = [
  { id: 1, fullName: '  Jan   de Vries ' },
  { id: 2, fullName: 'Jan de Vries' },
  { id: 3, fullName: 'Piet Jansen' },
]

test('manual entry flags every worker with the same normalized name without merging them', () => {
  assert.deepEqual(findWorkerIdentityConflicts('JAN de Vries', existing), [existing[0], existing[1]])
})

test('a new name does not create conflicts', () => {
  assert.deepEqual(findWorkerIdentityConflicts('Another person', existing), [])
})

test('identity decisions share a key for normalized names', () => {
  assert.equal(manualWorkerIdentityKey('  JAN   de Vries '), manualWorkerIdentityKey('Jan de Vries'))
})

test('identity keys do not contain the submitted personal data', () => {
  const key = manualWorkerIdentityKey('Jan de Vries')
  assert.match(key, /^[a-f0-9]{64}$/)
  assert.equal(key.includes('vries'), false)
})

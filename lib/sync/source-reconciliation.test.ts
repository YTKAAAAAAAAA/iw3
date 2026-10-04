import assert from 'node:assert/strict'
import test from 'node:test'
import { isImplausibleRemoval, sourceRecordsMissingLocally } from './source-reconciliation.ts'

test('finds imported records removed from the current source snapshot', () => {
  assert.deepEqual(
    sourceRecordsMissingLocally([11, 12, 13], [11, 13, 14]),
    [12],
  )
})

test('preserves local-only records and treats a complete empty snapshot as empty', () => {
  assert.deepEqual(sourceRecordsMissingLocally([null, 12, null], [12]), [])
  assert.deepEqual(sourceRecordsMissingLocally([12, null], []), [12])
})

test('an empty or truncated source snapshot is refused instead of wiping history', () => {
  assert.equal(isImplausibleRemoval(557, 557), true)
  assert.equal(isImplausibleRemoval(300, 557), true)
  assert.equal(isImplausibleRemoval(12, 12), true)
})

test('ordinary corrections and small imports are allowed', () => {
  assert.equal(isImplausibleRemoval(0, 557), false)
  assert.equal(isImplausibleRemoval(4, 557), false)
  assert.equal(isImplausibleRemoval(25, 30), false)
  assert.equal(isImplausibleRemoval(1, 1), false)
})

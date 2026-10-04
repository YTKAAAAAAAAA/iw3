import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceRecordsMissingLocally } from './source-reconciliation.ts'

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

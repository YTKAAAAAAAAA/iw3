import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  normalizeWorkerName,
  parseCourseDays,
  resolveWarehouseWorkerMatch,
  summarizeFlexpediaMatches,
  warehouseSiteSlug,
} from './warehouse-mapping.ts'

test('worker names are compared without case or repeated whitespace', () => {
  assert.equal(normalizeWorkerName('  Ana   van der Meer '), 'ana van der meer')
})

test('warehouse sync stops rather than matching a new source worker to a manually created worker by name', () => {
  assert.deepEqual(resolveWarehouseWorkerMatch(17, 'Ana van der Meer', [
    { id: 4, fullName: 'Ana van der Meer', supabaseWorkerId: null, manuallyCreated: true },
  ]), { kind: 'manual-conflict' })
})

test('an existing explicit source id wins over name matches', () => {
  assert.deepEqual(resolveWarehouseWorkerMatch(17, 'Ana van der Meer', [
    { id: 4, fullName: 'Ana van der Meer', supabaseWorkerId: null, manuallyCreated: true },
    { id: 8, fullName: 'Different name', supabaseWorkerId: '17', manuallyCreated: false },
  ]), { kind: 'matched', workerId: 8 })
})

test('warehouse sync refuses an ambiguous name match', () => {
  assert.deepEqual(resolveWarehouseWorkerMatch(17, 'Ana van der Meer', [
    { id: 4, fullName: 'Ana van der Meer', supabaseWorkerId: null, manuallyCreated: false },
    { id: 8, fullName: '  ANA  van der Meer ', supabaseWorkerId: null, manuallyCreated: false },
  ]), { kind: 'ambiguous' })
})

test('Warehouse site labels map only to the known local sites', () => {
  assert.equal(warehouseSiteSlug('Slego'), 'slego')
  assert.equal(warehouseSiteSlug('Conakry'), 'conakry')
  assert.equal(warehouseSiteSlug(null), null)
  assert.throws(() => warehouseSiteSlug('Unknown site'), /Unknown Warehouse site/)
})

test('course days accept the source comma-separated full weekday names', () => {
  assert.deepEqual(parseCourseDays('Wednesday, Thursday, Friday'), ['wed', 'thu', 'fri'])
  assert.deepEqual(parseCourseDays(''), [])
  assert.throws(() => parseCourseDays('not a weekday'), /Unsupported recurring course day/)
})

test('Flexpedia test matching reports counts without returning employee data', () => {
  const result = summarizeFlexpediaMatches([
    { id: 1, firstname: 'Ana', insertion: 'van der', lastname: 'Meer' },
    { id: 2, firstname: 'Noor', insertion: null, lastname: 'Jansen' },
    { id: 3, firstname: 'Sam', insertion: null, lastname: 'Dubbel' },
  ], [
    { fullName: 'Ana van der Meer', flexpediaId: null },
    { fullName: 'Sam Dubbel', flexpediaId: null },
    { fullName: 'Sam  Dubbel', flexpediaId: null },
  ])
  assert.deepEqual(result, { matched: 1, unmatched: 1, ambiguous: 1 })
})

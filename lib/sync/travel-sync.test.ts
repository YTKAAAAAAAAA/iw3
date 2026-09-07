/**
 * Proof that a changed Flexpedia address really does propagate: the worker's
 * address is stored, and the distance to EVERY vacancy is recomputed.
 *
 * Run with:  npm test
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  addressChanges, composeAddress, recomputeQueue, refreshTravel, sameAddress,
  type FlexpediaEmployee, type StoredTravel, type StoredVacancy, type StoredWorker, type TravelPorts,
} from './travel-sync.ts'

const employee = (id: number, street: string, nr: string, post: string, city: string): FlexpediaEmployee =>
  ({ id, street, streetNumber: nr, streetNumberAddition: null, postCode: post, city })

const workers: StoredWorker[] = [
  { id: 'w-1', flexpediaId: 1001, address: 'Havenstraat 12 3024 AB Rotterdam', lat: 51.91, lon: 4.45 },
  { id: 'w-2', flexpediaId: 1002, address: 'Damrak 7 1012 LG Amsterdam', lat: 52.37, lon: 4.89 },
]
const vacancies: StoredVacancy[] = [
  { id: 'v-1', address: 'Distributieweg 40 Delfgauw', lat: 52.00, lon: 4.38 },
  { id: 'v-2', address: 'Weena 505 Rotterdam', lat: 51.92, lon: 4.47 },
  { id: 'v-3', address: 'De Passage 100 Amsterdam', lat: 52.31, lon: 4.94 },
]
const travel: StoredTravel[] = workers.flatMap(w =>
  vacancies.map(v => ({ workerId: w.id, vacancyId: v.id, workerAddress: w.address, vacancyAddress: v.address })))

function stubPorts(overrides: Partial<TravelPorts> = {}) {
  const superseded: { workerId: string; vacancyId: string; km: number }[] = []
  const saved: { workerId: string; address: string }[] = []
  let matrixCalls = 0
  const ports: TravelPorts = {
    geocode: async () => ({ lat: 51.5, lon: 4.5 }),
    routeMatrix: async (_origin, destinations) => { matrixCalls++; return destinations.map((_, i) => ({ km: 10 + i, minutes: 15 + i })) },
    supersede: async row => { superseded.push({ workerId: row.workerId, vacancyId: row.vacancyId, km: row.leg.km }) },
    saveWorkerAddress: async (workerId, address) => { saved.push({ workerId, address }) },
    ...overrides,
  }
  return { ports, superseded, saved, calls: () => matrixCalls }
}

test('an address is composed the same way every time', () => {
  assert.equal(composeAddress(employee(1, 'Havenstraat', '12', '3024 AB', 'Rotterdam')), 'Havenstraat 12 3024 AB Rotterdam')
  assert.ok(sameAddress('Havenstraat  12   3024 AB Rotterdam', 'havenstraat 12 3024 ab rotterdam'))
})

test('reformatting is not a move', () => {
  const incoming = [employee(1001, 'Havenstraat', '12', '3024 AB', 'ROTTERDAM')]
  assert.deepEqual(addressChanges(workers, incoming), [])
})

test('a real move is detected', () => {
  const incoming = [employee(1001, 'Kruiskade', '48', '3012 EH', 'Rotterdam')]
  const changes = addressChanges(workers, incoming)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].workerId, 'w-1')
  assert.equal(changes[0].to, 'Kruiskade 48 3012 EH Rotterdam')
})

test('an employee we do not hold is ignored', () => {
  assert.deepEqual(addressChanges(workers, [employee(9999, 'Spui', '1', '1012 XX', 'Amsterdam')]), [])
})

test('a blank address is missing data, not a move', () => {
  const incoming: FlexpediaEmployee[] = [{ id: 1001, street: null, streetNumber: null, streetNumberAddition: null, postCode: null, city: null }]
  assert.deepEqual(addressChanges(workers, incoming), [])
})

test('nothing is queued while everything matches', () => {
  assert.deepEqual(recomputeQueue(workers, vacancies, travel), [])
})

test('a move queues that worker against EVERY vacancy, and nobody else', () => {
  const moved = workers.map(w => (w.id === 'w-1' ? { ...w, address: 'Kruiskade 48 3012 EH Rotterdam' } : w))
  const queue = recomputeQueue(moved, vacancies, travel)
  assert.equal(queue.length, vacancies.length)
  assert.deepEqual(new Set(queue.map(q => q.vacancyId)), new Set(['v-1', 'v-2', 'v-3']))
  assert.ok(queue.every(q => q.workerId === 'w-1' && q.reason === 'worker_address_changed'))
})

test('a vacancy that moves queues every worker', () => {
  const movedSites = vacancies.map(v => (v.id === 'v-2' ? { ...v, address: 'Coolsingel 60 Rotterdam' } : v))
  const queue = recomputeQueue(workers, movedSites, travel)
  assert.equal(queue.length, workers.length)
  assert.ok(queue.every(q => q.vacancyId === 'v-2' && q.reason === 'vacancy_address_changed'))
})

test('a pair that was never computed is queued as missing', () => {
  const queue = recomputeQueue(workers, vacancies, travel.filter(t => !(t.workerId === 'w-2' && t.vacancyId === 'v-3')))
  assert.deepEqual(queue, [{ workerId: 'w-2', vacancyId: 'v-3', reason: 'missing' }])
})

test('end to end: Flexpedia sends a new address, storage and all distances follow', async () => {
  const { ports, superseded, saved, calls } = stubPorts()
  const report = await refreshTravel(
    { workers, vacancies, travel, incoming: [employee(1001, 'Kruiskade', '48', '3012 EH', 'Rotterdam')] },
    ports,
  )
  assert.equal(report.moved.length, 1)
  assert.deepEqual(saved, [{ workerId: 'w-1', address: 'Kruiskade 48 3012 EH Rotterdam' }])
  assert.equal(report.recomputed, 3, 'all three vacancies recomputed')
  assert.deepEqual(new Set(superseded.map(s => s.vacancyId)), new Set(['v-1', 'v-2', 'v-3']))
  assert.ok(superseded.every(s => s.workerId === 'w-1'), 'nobody else was touched')
  assert.equal(calls(), 3, 'one matrix call per vacancy, not one per person')
  assert.equal(report.unresolved.length, 0)
})

test('a sync with no moves recomputes nothing and calls no router', async () => {
  const { ports, superseded, calls } = stubPorts()
  const report = await refreshTravel(
    { workers, vacancies, travel, incoming: [employee(1001, 'Havenstraat', '12', '3024 AB', 'Rotterdam')] },
    ports,
  )
  assert.deepEqual(report.moved, [])
  assert.equal(report.recomputed, 0)
  assert.equal(superseded.length, 0)
  assert.equal(calls(), 0)
})

test('an address the geocoder cannot place leaves the old distances alone', async () => {
  const { ports, superseded } = stubPorts({ geocode: async () => null })
  const report = await refreshTravel(
    { workers, vacancies, travel, incoming: [employee(1001, 'Nowhere', '1', '0000 ZZ', 'Nowhere')] },
    ports,
  )
  assert.equal(report.unresolved.length, 1)
  assert.equal(report.recomputed, 0)
  assert.equal(superseded.length, 0, 'a stale distance beats an invented one')
  assert.equal(report.skipped.length, 3)
})

test('a route the router cannot find is reported, not stored as zero', async () => {
  const { ports, superseded } = stubPorts({ routeMatrix: async (_origin, destinations) => destinations.map(() => null) })
  const report = await refreshTravel(
    { workers, vacancies, travel, incoming: [employee(1001, 'Kruiskade', '48', '3012 EH', 'Rotterdam')] },
    ports,
  )
  assert.equal(report.recomputed, 0)
  assert.equal(superseded.length, 0)
  assert.ok(report.skipped.every(s => s.reason === 'no route found'))
})

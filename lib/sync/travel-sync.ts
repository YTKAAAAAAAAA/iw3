/**
 * Keeping travel distances true after a Flexpedia sync.
 *
 * Flexpedia is the source of a worker's address, and it exposes no
 * `updated_at` and no change feed — its employee model is personal and
 * contact fields only. So "did this address change?" cannot be answered by
 * asking Flexpedia; it can only be answered by comparing what arrived with
 * what we stored.
 *
 * Everything here is pure except `refreshTravel`, and that takes its
 * geocoder, router and storage as arguments. That is what makes the rule
 * testable without a network or a database: the tests below drive the whole
 * pipeline with stubs.
 */

export type FlexpediaEmployee = {
  id: number
  street: string | null
  streetNumber: string | null
  streetNumberAddition: string | null
  postCode: string | null
  city: string | null
}

export type StoredWorker = {
  id: string
  flexpediaId: number | null
  address: string
  lat: number | null
  lon: number | null
}

export type StoredVacancy = { id: string; address: string; lat: number | null; lon: number | null }

/** A live travel row: what it says, and what it was computed from. */
export type StoredTravel = {
  workerId: string
  vacancyId: string
  workerAddress: string
  vacancyAddress: string
}

export type Coordinates = { lat: number; lon: number }
export type Leg = { km: number; minutes: number }

/**
 * One canonical way of writing an address, used both for storage and for
 * comparison. Without this, "Havenstraat 12 A" and "havenstraat  12a" look
 * like a move and would trigger a pointless recompute of every vacancy.
 */
export function composeAddress(e: FlexpediaEmployee): string {
  const house = [e.streetNumber, e.streetNumberAddition].filter(Boolean).join('')
  return [e.street, house, e.postCode, e.city].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export const sameAddress = (a: string | null, b: string | null) =>
  (a ?? '').toLowerCase().replace(/\s+/g, ' ').trim() === (b ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export type AddressChange = { workerId: string; from: string; to: string }

/** Who moved in this sync. Employees we do not hold are ignored here; adding
 *  new people is a separate concern from re-routing existing ones. */
export function addressChanges(stored: StoredWorker[], incoming: FlexpediaEmployee[]): AddressChange[] {
  const byFlexpediaId = new Map(stored.filter(w => w.flexpediaId !== null).map(w => [w.flexpediaId!, w]))
  const changes: AddressChange[] = []
  for (const employee of incoming) {
    const worker = byFlexpediaId.get(employee.id)
    if (!worker) continue
    const arrived = composeAddress(employee)
    if (!arrived) continue // an empty address is missing data, not a move
    if (!sameAddress(worker.address, arrived)) changes.push({ workerId: worker.id, from: worker.address, to: arrived })
  }
  return changes
}

export type QueueItem = {
  workerId: string
  vacancyId: string
  reason: 'missing' | 'worker_address_changed' | 'vacancy_address_changed'
}

/**
 * Every (worker, vacancy) pair whose stored distance no longer matches the
 * current addresses.
 *
 * A worker who moved needs recomputing against EVERY vacancy, not only the one
 * they are working now: they may be offered any of them tomorrow, and the
 * radius filter reads all of them.
 */
export function recomputeQueue(
  workers: StoredWorker[],
  vacancies: StoredVacancy[],
  travel: StoredTravel[],
): QueueItem[] {
  const live = new Map(travel.map(t => [`${t.workerId}|${t.vacancyId}`, t]))
  const queue: QueueItem[] = []
  for (const worker of workers) {
    for (const vacancy of vacancies) {
      const row = live.get(`${worker.id}|${vacancy.id}`)
      if (!row) { queue.push({ workerId: worker.id, vacancyId: vacancy.id, reason: 'missing' }); continue }
      if (!sameAddress(row.workerAddress, worker.address)) {
        queue.push({ workerId: worker.id, vacancyId: vacancy.id, reason: 'worker_address_changed' }); continue
      }
      if (!sameAddress(row.vacancyAddress, vacancy.address)) {
        queue.push({ workerId: worker.id, vacancyId: vacancy.id, reason: 'vacancy_address_changed' })
      }
    }
  }
  return queue
}

/** The outside world, injected so the pipeline can be exercised offline. */
export type TravelPorts = {
  /** null when the address cannot be resolved — a real answer, not an error. */
  geocode: (address: string) => Promise<Coordinates | null>
  /** One call per origin: a matrix, not a request per person. */
  routeMatrix: (origin: Coordinates, destinations: Coordinates[]) => Promise<(Leg | null)[]>
  /** Closes the previous row and writes the new one; never overwrites. */
  supersede: (row: {
    workerId: string; vacancyId: string; leg: Leg
    workerAddress: string; workerCoordinates: Coordinates
    vacancyAddress: string; vacancyCoordinates: Coordinates
  }) => Promise<void>
  saveWorkerAddress: (workerId: string, address: string, coordinates: Coordinates | null) => Promise<void>
}

export type RefreshReport = {
  moved: AddressChange[]
  recomputed: number
  /** Addresses the geocoder could not place. Their rows are left untouched:
   *  a stale distance is better than a wrong one, and worse than neither. */
  unresolved: { workerId: string; address: string }[]
  skipped: { workerId: string; vacancyId: string; reason: string }[]
}

/**
 * The whole cycle: take what Flexpedia sent, store any new addresses, and
 * bring every affected distance up to date.
 *
 * Routing is done one vacancy at a time so each vacancy costs a single matrix
 * call however many people moved.
 */
export async function refreshTravel(
  input: {
    workers: StoredWorker[]
    vacancies: StoredVacancy[]
    travel: StoredTravel[]
    incoming: FlexpediaEmployee[]
  },
  ports: TravelPorts,
): Promise<RefreshReport> {
  const report: RefreshReport = { moved: [], recomputed: 0, unresolved: [], skipped: [] }

  // 1. Apply the addresses that actually changed, geocoding each one once.
  report.moved = addressChanges(input.workers, input.incoming)
  const workers = input.workers.map(w => ({ ...w }))
  for (const change of report.moved) {
    const worker = workers.find(w => w.id === change.workerId)!
    const coordinates = await ports.geocode(change.to)
    worker.address = change.to
    worker.lat = coordinates?.lat ?? null
    worker.lon = coordinates?.lon ?? null
    await ports.saveWorkerAddress(worker.id, change.to, coordinates)
    if (!coordinates) report.unresolved.push({ workerId: worker.id, address: change.to })
  }

  // 2. Recompute everything the change invalidated, vacancy by vacancy.
  const queue = recomputeQueue(workers, input.vacancies, input.travel)
  const byVacancy = new Map<string, QueueItem[]>()
  for (const item of queue) byVacancy.set(item.vacancyId, [...(byVacancy.get(item.vacancyId) ?? []), item])

  for (const [vacancyId, items] of byVacancy) {
    const vacancy = input.vacancies.find(v => v.id === vacancyId)!
    if (vacancy.lat == null || vacancy.lon == null) {
      items.forEach(i => report.skipped.push({ ...i, reason: 'vacancy has no coordinates' }))
      continue
    }
    const routable = items
      .map(item => ({ item, worker: workers.find(w => w.id === item.workerId)! }))
      .filter(({ item, worker }) => {
        if (worker.lat == null || worker.lon == null) {
          report.skipped.push({ ...item, reason: 'worker address could not be geocoded' })
          return false
        }
        return true
      })
    if (!routable.length) continue

    const legs = await ports.routeMatrix(
      { lat: vacancy.lat, lon: vacancy.lon },
      routable.map(({ worker }) => ({ lat: worker.lat!, lon: worker.lon! })),
    )

    for (let i = 0; i < routable.length; i++) {
      const leg = legs[i]
      const { item, worker } = routable[i]
      if (!leg) { report.skipped.push({ ...item, reason: 'no route found' }); continue }
      await ports.supersede({
        workerId: worker.id, vacancyId,
        leg,
        workerAddress: worker.address, workerCoordinates: { lat: worker.lat!, lon: worker.lon! },
        vacancyAddress: vacancy.address, vacancyCoordinates: { lat: vacancy.lat, lon: vacancy.lon },
      })
      report.recomputed++
    }
  }

  return report
}

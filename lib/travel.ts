/**
 * Home → site travel: how far a worker actually drives to a job, and how long.
 *
 * The distances are computed on the server from the worker's Flexpedia address
 * and stored per address pair (lib/travel/refresh.ts). This module only reads
 * them, so the map and the candidate lists agree on every number.
 *
 * Why road distance and not a straight line: the radius filter is meant to
 * answer "who is within a twenty-kilometre drive", not "who sits inside a
 * twenty-kilometre circle". Those are different people — a river, a lack of
 * bridges or a motorway detour easily doubles the driving distance. The same
 * kilometres are what travel compensation is paid on, so the number has to be
 * a real driving distance or it is not defensible.
 */
import type { TravelDistance } from './types.ts'

export type Travel = {
  /** One-way road distance in kilometres. */
  km: number
  /** Driving time in minutes for the same route. */
  minutes: number
  /** When this pair was computed — the number is frozen per address pair. */
  computedAt: string
  profile: string
}

export type TravelIndex = Map<string, Travel>

const key = (vacancyId: string, workerId: string) => `${vacancyId}\u0000${workerId}`

export function travelIndex(distances: TravelDistance[]): TravelIndex {
  return new Map(distances.map(d => [key(d.vacancyId, d.workerId), d]))
}

/** Travel for one person to one site, or null when it is not known: the
 *  address is missing or could not be geocoded, or the pair has not been
 *  computed yet. Callers must handle null rather than pretending zero —
 *  "unknown" and "next door" are opposite answers. */
export function travelFor(index: TravelIndex, workerId: string, vacancyId: string): Travel | null {
  return index.get(key(vacancyId, workerId)) ?? null
}

/** Everyone whose drive to this site is within `radiusKm`, nearest first.
 *  People with no known travel are returned separately rather than dropped —
 *  silently hiding them is how someone stops being offered work. */
export function withinDrive(index: TravelIndex, workerIds: string[], vacancyId: string, radiusKm: number) {
  const inside: { workerId: string; travel: Travel }[] = []
  const outside: { workerId: string; travel: Travel }[] = []
  const unknown: string[] = []
  for (const workerId of workerIds) {
    const travel = travelFor(index, workerId, vacancyId)
    if (!travel) {
      unknown.push(workerId)
      continue
    }
    ;(travel.km <= radiusKm ? inside : outside).push({ workerId, travel })
  }
  inside.sort((a, b) => a.travel.km - b.travel.km)
  outside.sort((a, b) => a.travel.km - b.travel.km)
  return { inside, outside, unknown }
}

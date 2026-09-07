/**
 * Home → site travel: how far a worker actually drives to a job, and how long.
 *
 * This is the ONE place the rest of the app asks about distance. Today it
 * answers from a cache generated with OSRM; when the backend exists it will
 * answer from the server, and nothing that calls it has to change.
 *
 * Why road distance and not a straight line: the radius filter is meant to
 * answer "who is within a twenty-kilometre drive", not "who sits inside a
 * twenty-kilometre circle". Those are different people — a river, a lack of
 * bridges or a motorway detour easily doubles the driving distance. The same
 * kilometres are what travel compensation is paid on, and compensation is paid
 * by car even for someone who takes the metro, so the number has to be a real
 * driving distance or it is not defensible.
 */
import { TRAVEL_CACHE, TRAVEL_COMPUTED_AT, TRAVEL_PROFILE } from './travel-cache'

export type Travel = {
  /** One-way road distance in kilometres. */
  km: number
  /** Driving time in minutes for the same route. */
  minutes: number
  /** When this pair was computed — the number is frozen, see travel-cache.ts. */
  computedAt: string
  profile: string
}

/** Travel for one person to one site, or null when it is not known: the
 *  address could not be geocoded, or the pair has never been computed. Callers
 *  must handle null rather than pretending zero — "unknown" and "next door"
 *  are opposite answers. */
export function travelFor(workerId: string, siteId: string): Travel | null {
  const entry = TRAVEL_CACHE[siteId]?.[workerId]
  if (!entry) return null
  return { km: entry.km, minutes: entry.minutes, computedAt: TRAVEL_COMPUTED_AT, profile: TRAVEL_PROFILE }
}

/** Everyone whose drive to this site is within `radiusKm`, nearest first.
 *  People with no known travel are returned separately rather than dropped —
 *  silently hiding them is how someone stops being offered work. */
export function withinDrive(workerIds: string[], siteId: string, radiusKm: number) {
  const inside: { workerId: string; travel: Travel }[] = []
  const outside: { workerId: string; travel: Travel }[] = []
  const unknown: string[] = []
  for (const workerId of workerIds) {
    const travel = travelFor(workerId, siteId)
    if (!travel) { unknown.push(workerId); continue }
    ;(travel.km <= radiusKm ? inside : outside).push({ workerId, travel })
  }
  inside.sort((a, b) => a.travel.km - b.travel.km)
  outside.sort((a, b) => a.travel.km - b.travel.km)
  return { inside, outside, unknown }
}

export { TRAVEL_COMPUTED_AT, TRAVEL_PROFILE }

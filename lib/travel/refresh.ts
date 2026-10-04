import 'server-only'

import { withDb } from '@/lib/db'
import { normalizeAddress } from './address'
import { geocodeAddress, routeToSite, type Point } from './services'

const ROUTING_BASE_URL = process.env.ROUTING_BASE_URL ?? 'https://router.project-osrm.org'
const PROFILE = 'osrm/driving (fastest)'
/* Nominatim's usage policy allows one request a second; PDOK answers most
   Dutch addresses first, but the pause keeps every fallback within policy. */
const GEOCODE_PAUSE_MS = 1_100
const GEOCODE_PER_RUN = 60

export type TravelRefreshReport = {
  geocoded: number
  unresolved: number
  recomputed: number
  skipped: number
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Brings road distances up to date: geocodes addresses it has not seen, gives
 * vacancies without coordinates the position of their address, then drains
 * travel_recompute_queue — every active worker × open vacancy pair whose
 * stored distance is missing or was computed from an older address.
 *
 * Distances are frozen per address pair and never overwritten
 * (supersede_travel closes the old row), so past travel compensation stays
 * reproducible. Only one refresh runs at a time across all app instances.
 */
export async function refreshTravelDistances(): Promise<TravelRefreshReport | null> {
  if (!ROUTING_BASE_URL) return null
  return withDb(async db => {
    const { rows: lock } = await db.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('international-at-work:travel-refresh')) AS locked",
    )
    if (!lock[0]?.locked) return null
    try {
      const report: TravelRefreshReport = { geocoded: 0, unresolved: 0, recomputed: 0, skipped: 0 }

      // 1. Geocode new worker and vacancy addresses, a bounded number per run.
      const { rows: pending } = await db.query<{ address: string }>(
        `
        WITH addresses AS (
          SELECT home_address AS address FROM worker
          WHERE is_active AND NOT is_fired AND home_address IS NOT NULL
          UNION
          SELECT vacancy_address FROM travel_recompute_queue
        )
        SELECT DISTINCT a.address FROM addresses a
        WHERE NOT EXISTS (
          SELECT 1 FROM geocode_cache g WHERE g.address_norm = lower(regexp_replace(btrim(a.address), '\\s+', ' ', 'g'))
        )
        LIMIT $1
      `,
        [GEOCODE_PER_RUN],
      )
      for (const { address } of pending) {
        const found = await geocodeAddress(address)
        await db.query(
          `
          INSERT INTO geocode_cache (address_norm, address_raw, lat, lon, resolved, provider)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (address_norm) DO NOTHING
        `,
          [
            normalizeAddress(address),
            address,
            found?.point.lat ?? null,
            found?.point.lon ?? null,
            Boolean(found),
            found?.provider ?? 'none',
          ],
        )
        if (found) report.geocoded++
        else report.unresolved++
        await pause(GEOCODE_PAUSE_MS)
      }

      // 2. Vacancies picked without the address picker get their address's position.
      await db.query(`
        UPDATE vacancy v SET latitude = g.lat, longitude = g.lon
        FROM geocode_cache g
        WHERE v.latitude IS NULL AND v.worksite_address IS NULL AND g.resolved
          AND g.address_norm = lower(regexp_replace(btrim((
            SELECT s.address FROM vacancy_site vs JOIN site s ON s.slug = vs.site_slug
            WHERE vs.vacancy_id = v.id ORDER BY s.name LIMIT 1
          )), '\\s+', ' ', 'g'))
      `)

      // 3. Route every stale pair, one table request per vacancy.
      const { rows: queue } = await db.query<{
        worker_id: number
        vacancy_id: number
        worker_address: string
        vacancy_address: string
        worker_lat: number | null
        worker_lon: number | null
        vacancy_lat: number | null
        vacancy_lon: number | null
      }>(`
        SELECT q.worker_id, q.vacancy_id, q.worker_address, q.vacancy_address,
          wg.lat AS worker_lat, wg.lon AS worker_lon,
          COALESCE(v.latitude, vg.lat) AS vacancy_lat, COALESCE(v.longitude, vg.lon) AS vacancy_lon
        FROM travel_recompute_queue q
        JOIN vacancy v ON v.id = q.vacancy_id
        LEFT JOIN geocode_cache wg ON wg.resolved
          AND wg.address_norm = lower(regexp_replace(btrim(q.worker_address), '\\s+', ' ', 'g'))
        LEFT JOIN geocode_cache vg ON vg.resolved
          AND vg.address_norm = lower(regexp_replace(btrim(q.vacancy_address), '\\s+', ' ', 'g'))
        ORDER BY q.vacancy_id, q.worker_id
        LIMIT 5000
      `)
      const byVacancy = new Map<number, typeof queue>()
      for (const row of queue) byVacancy.set(row.vacancy_id, [...(byVacancy.get(row.vacancy_id) ?? []), row])

      for (const rows of byVacancy.values()) {
        const { vacancy_lat: siteLat, vacancy_lon: siteLon } = rows[0]
        const routable = rows.filter(row => row.worker_lat !== null && row.worker_lon !== null)
        report.skipped += rows.length - routable.length
        if (siteLat === null || siteLon === null || !routable.length) {
          report.skipped += routable.length
          continue
        }
        const site: Point = { lat: siteLat, lon: siteLon }
        const legs = await routeToSite(
          ROUTING_BASE_URL,
          site,
          routable.map(row => ({ lat: row.worker_lat!, lon: row.worker_lon! })),
        )
        for (const [index, row] of routable.entries()) {
          const leg = legs[index]
          if (!leg) {
            report.skipped++
            continue
          }
          await db.query('SELECT supersede_travel($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, $11)', [
            row.worker_id,
            row.vacancy_id,
            leg.km,
            leg.minutes,
            PROFILE,
            row.worker_address,
            row.worker_lat,
            row.worker_lon,
            row.vacancy_address,
            site.lat,
            site.lon,
          ])
          report.recomputed++
        }
      }
      return report
    } finally {
      await db.query("SELECT pg_advisory_unlock(hashtext('international-at-work:travel-refresh'))")
    }
  })
}

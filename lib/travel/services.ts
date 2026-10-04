/**
 * The two outside services travel distances depend on, as plain functions.
 *
 * Geocoding asks PDOK Locatieserver first: it is the Dutch government's own
 * address register (BAG), free, keyless and exact for Dutch addresses, which
 * is where almost every worker lives. Nominatim (OpenStreetMap) is the
 * fallback for anything abroad. Routing uses an OSRM table request: one call
 * returns every worker's drive to a site, instead of one request per person.
 *
 * Parsing is separate from fetching so the formats can be tested offline.
 */

export type Point = { lat: number; lon: number }
export type Leg = { km: number; minutes: number }
type Fetch = typeof fetch

const PDOK_URL =
  process.env.PDOK_LOCATIESERVER_URL ?? 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'
const NOMINATIM_URL = process.env.GEOCODER_BASE_URL ?? 'https://nominatim.openstreetmap.org'
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT ??
  'Mozilla/5.0 (compatible; IAWPlatform/1.0; +https://international-work.example)'

const validPoint = (lat: number, lon: number): Point | null =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { lat, lon }
    : null

/** PDOK answers `{ response: { docs: [{ centroide_ll: "POINT(4.75 52.39)" }] } }`. */
export function parsePdokPoint(body: unknown): Point | null {
  const docs = (body as { response?: { docs?: Array<{ centroide_ll?: unknown; type?: unknown }> } })?.response
    ?.docs
  const doc = Array.isArray(docs) ? (docs.find(item => item?.type === 'adres') ?? docs[0]) : undefined
  const match =
    typeof doc?.centroide_ll === 'string' ? doc.centroide_ll.match(/^POINT\(([-\d.]+) ([-\d.]+)\)$/) : null
  return match ? validPoint(Number(match[2]), Number(match[1])) : null
}

/** Nominatim answers `[{ lat: "52.39", lon: "4.75", ... }]`. */
export function parseNominatimPoint(body: unknown): Point | null {
  const first = Array.isArray(body) ? (body[0] as { lat?: unknown; lon?: unknown } | undefined) : undefined
  return first ? validPoint(Number(first.lat), Number(first.lon)) : null
}

export async function geocodeAddress(
  address: string,
  fetchImpl: Fetch = fetch,
): Promise<{ point: Point; provider: 'pdok' | 'nominatim' } | null> {
  const pdok = new URL(PDOK_URL)
  pdok.searchParams.set('q', address)
  pdok.searchParams.set('rows', '1')
  pdok.searchParams.set('fq', 'type:adres')
  try {
    const response = await fetchImpl(pdok, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    const point = response.ok ? parsePdokPoint(await response.json()) : null
    if (point) return { point, provider: 'pdok' }
  } catch (error) {
    console.error('PDOK geocoding failed.', error)
  }

  const nominatim = new URL(`${NOMINATIM_URL}/search`)
  nominatim.searchParams.set('q', address)
  nominatim.searchParams.set('format', 'jsonv2')
  nominatim.searchParams.set('limit', '1')
  try {
    const response = await fetchImpl(nominatim, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'nl,en' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    const point = response.ok ? parseNominatimPoint(await response.json()) : null
    return point ? { point, provider: 'nominatim' } : null
  } catch (error) {
    console.error('Nominatim geocoding failed.', error)
    return null
  }
}

/** One OSRM table request: every origin (a worker's home) to one destination
 *  (the site). Coordinates are `lon,lat`, the site goes first. */
export function osrmTableUrl(base: string, site: Point, homes: Point[]): string {
  const coordinates = [site, ...homes]
    .map(point => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`)
    .join(';')
  const sources = homes.map((_, index) => index + 1).join(';')
  return `${base.replace(/\/+$/, '')}/table/v1/driving/${coordinates}?sources=${sources}&destinations=0&annotations=distance,duration`
}

/** Metres and seconds per origin, as one-way kilometres (0.1) and minutes. */
export function parseOsrmTable(body: unknown, count: number): Array<Leg | null> {
  const table = body as { code?: unknown; distances?: unknown; durations?: unknown }
  if (table?.code !== 'Ok' || !Array.isArray(table.distances) || !Array.isArray(table.durations)) {
    throw new Error('The routing service returned an invalid table.')
  }
  return Array.from({ length: count }, (_, index) => {
    const metres = (table.distances as unknown[][])[index]?.[0]
    const seconds = (table.durations as unknown[][])[index]?.[0]
    if (typeof metres !== 'number' || typeof seconds !== 'number' || metres < 0 || seconds < 0) return null
    return { km: Math.round(metres / 100) / 10, minutes: Math.round(seconds / 60) }
  })
}

/** OSRM's public and default servers accept about a hundred coordinates per
 *  request, so large groups are routed in batches. */
export async function routeToSite(
  base: string,
  site: Point,
  homes: Point[],
  fetchImpl: Fetch = fetch,
  batchSize = 50,
): Promise<Array<Leg | null>> {
  const legs: Array<Leg | null> = []
  for (let start = 0; start < homes.length; start += batchSize) {
    const batch = homes.slice(start, start + batchSize)
    const response = await fetchImpl(osrmTableUrl(base, site, batch), {
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`The routing service returned HTTP ${response.status}.`)
    legs.push(...parseOsrmTable(await response.json(), batch.length))
  }
  return legs
}

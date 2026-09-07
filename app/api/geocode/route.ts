import { NextResponse } from 'next/server'

/**
 * Address search, proxied to Nominatim.
 *
 * It goes through the server rather than straight from the browser for two
 * reasons. Nominatim's usage policy requires a real contact in the
 * User-Agent, and a browser cannot set that header at all. And searching from
 * every open form would scatter identical requests across users' machines
 * where nothing can be cached or rate-limited.
 *
 * The same route is what the real backend will expose, so the picker does not
 * change when the backend arrives.
 */
const NOMINATIM = process.env.GEOCODER_BASE_URL ?? 'https://nominatim.openstreetmap.org'
/* Nominatim wants a real contact, but it also rejects User-Agents that do not
   look like a conventional client string: 'IAW-Platform/1.0 (+mailto:…)' is
   answered with 403, while the customary 'Mozilla/5.0 (compatible; App/1.0;
   +url)' form is accepted. Tested both. */
const CONTACT = process.env.GEOCODER_USER_AGENT
  ?? 'Mozilla/5.0 (compatible; IAWPlatform/1.0; +https://international-work.example)'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query || query.length < 3) return NextResponse.json({ results: [] })

  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')
  /* The agency and every site are in the Netherlands, so results are kept
     there: it removes a whole class of wrong answers where a street name
     exists in a dozen countries. */
  url.searchParams.set('countrycodes', 'nl')

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': CONTACT, 'Accept-Language': 'nl,en' },
      next: { revalidate: 86400 },
    })
    if (!response.ok) return NextResponse.json({ results: [], error: `geocoder returned ${response.status}` }, { status: 502 })

    const raw = (await response.json()) as Array<{
      display_name: string; lat: string; lon: string
      address?: Record<string, string>
    }>

    const results = raw.map(item => {
      const a = item.address ?? {}
      const house = [a.road, a.house_number].filter(Boolean).join(' ')
      const town = a.city ?? a.town ?? a.village ?? a.municipality ?? ''
      return {
        /* A tidy one-line address for storage, and the full one for the list
           so an ambiguous hit can be told apart. */
        label: [house, a.postcode, town].filter(Boolean).join(', ') || item.display_name,
        detail: item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon),
      }
    })
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [], error: 'geocoder unreachable' }, { status: 502 })
  }
}

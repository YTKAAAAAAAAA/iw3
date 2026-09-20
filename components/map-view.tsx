'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Minus, Plus } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel, StateBlock } from './app-shell'
import { assignments, leaves, roster, vacancies, workers } from '@/lib/mock-data'
import { dayStatus } from '@/lib/derive'
import { travelFor, withinDrive, TRAVEL_COMPUTED_AT, TRAVEL_PROFILE } from '@/lib/travel'
import { formatDate, TODAY } from '@/lib/types'

/* Leaflet writes colours straight into SVG attributes, so it cannot take a CSS
   variable — it has to be handed a resolved string. Reading the token at draw
   time keeps the map on the same palette as the rest of the product instead of
   pinning three hex values that drift away from it. */
const token = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
const stateColour = (state: string) => token(
  state === 'free' ? '--status-free' : state === 'leave' ? '--status-leave' : '--status-working',
  state === 'free' ? '#047857' : state === 'leave' ? '#b45309' : '#1d4ed8',
)
const STATE_LABEL: Record<string, string> = { free: 'Free', leave: 'On leave', working: 'Working' }
type Filter = 'all' | 'free' | 'working'

/** The map, usable on its own page or dropped at the bottom of a vacancy.
 *  When `vacancyId` is given the site is fixed and the picker disappears —
 *  with a hundred vacancies, hunting for one in a dropdown is worse than
 *  opening the vacancy you were already looking at. */
export function MapPanel({ vacancyId }: { vacancyId?: string }) {
  const sites = vacancies.filter(v => v.lat !== null && v.lon !== null)
  const [chosen, setChosen] = useState(vacancyId ?? sites[0]?.id ?? '')
  const siteId = vacancyId ?? chosen
  const [radius, setRadius] = useState(20)
  const [filter, setFilter] = useState<Filter>('all')
  /* Own transport, kept apart from availability because it is a different
     question: free or working is about the day, a car is about whether the
     person can get here at all. Dutch public transport strikes are the reason
     it is a switch rather than a note — on a strike day the only list worth
     looking at is the people who drive. */
  const [carOnly, setCarOnly] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [basemap, setBasemap] = useState<'plain' | 'satellite'>('plain')

  const site = vacancies.find(v => v.id === siteId)!
  /* `workers` is a module constant, so this list never actually changes —
     but recreating the array on every render made every memo downstream of it
     recompute, which re-ran the marker effect, which refitted the map. That is
     how selecting somebody was resetting the zoom. */
  const active = useMemo(() => workers.filter(w => w.status === 'active'), [])
  const stateOf = (workerId: string) => dayStatus(workerId,TODAY,roster, leaves, vacancies)
  const workerById = useMemo(() => new Map(workers.map(w => [w.id, w])), [])

  const pool = useMemo(
    () => active
      .filter(w => filter === 'all' || (filter === 'free' ? stateOf(w.id) === 'free' : stateOf(w.id) === 'working'))
      .filter(w => !carOnly || w.hasCar),
    [active, filter, carOnly],
  )
  const { inside, outside, unknown } = useMemo(
    () => withinDrive(pool.map(w => w.id), siteId, radius),
    [pool, siteId, radius],
  )

  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const ringRef = useRef<L.Circle | null>(null)
  const tilesRef = useRef<{ plain: L.TileLayer; satellite: L.TileLayer } | null>(null)
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    /* A view must exist before any layer is added — Leaflet projects layers
       against the current view and throws without one. Leaflet's own zoom and
       layer controls are switched off; ours are React buttons so they use the
       app's own styling instead of fighting Leaflet's CSS. */
    const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: false }).setView([52.1, 5.1], 7)
    const plain = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery &copy; Esri' })
    plain.addTo(map)
    tilesRef.current = { plain, satellite }
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    /* Effects run twice in development: every ref into the old map dies with it. */
    return () => {
      map.remove()
      mapRef.current = null; layerRef.current = null; ringRef.current = null; tilesRef.current = null
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const t = tilesRef.current, map = mapRef.current
    if (!t || !map) return
    map.removeLayer(basemap === 'plain' ? t.satellite : t.plain)
    ;(basemap === 'plain' ? t.plain : t.satellite).addTo(map)
  }, [basemap])

  /* Markers and framing. Deliberately does NOT depend on `selected`: refitting
     the view every time somebody is picked was zooming the map out from under
     the user. Selection is handled separately, below. */
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer || site.lat == null || site.lon == null) return
    layer.clearLayers()
    markersRef.current.clear()

    /* A tooltip is a hover affordance and announces to nobody. Leaflet renders
       these as focusable elements, so without a name a screen reader reads the
       map as a row of unlabelled buttons. */
    const sitePin = L.marker([site.lat, site.lon], {
      icon: L.divIcon({ className: 'site-pin', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 1000,
    }).bindTooltip(`<strong>${site.title}</strong><br>${site.address}`).addTo(layer)
    sitePin.getElement()?.setAttribute('aria-label', `${site.title}, ${site.address}`)

    const place = (workerId: string, travel: { km: number; minutes: number }, isInside: boolean) => {
      const worker = workerById.get(workerId)
      if (!worker?.lat || !worker?.lon) return
      const state = stateOf(workerId)
      const marker = L.circleMarker([worker.lat, worker.lon], {
        radius: 8, weight: 2.5, color: token('--card', '#ffffff'),
        fillColor: stateColour(state),
        fillOpacity: isInside ? 1 : 0.35, opacity: isInside ? 1 : 0.4,
      })
      marker.bindTooltip(
        `<strong>${worker.fullName}</strong><br>${travel.km} km · ${travel.minutes} min by car<br>${STATE_LABEL[state]}`,
        { direction: 'top' })
      marker.on('click', () => setSelected(workerId))
      marker.addTo(layer)
      const el = marker.getElement()
      if (el) {
        el.setAttribute('role', 'button')
        el.setAttribute('aria-label',
          `${worker.fullName}, ${travel.km} km, ${travel.minutes} min by car, ${STATE_LABEL[state]}`)
      }
      markersRef.current.set(workerId, marker)
    }
    inside.forEach(x => place(x.workerId, x.travel, true))
    outside.forEach(x => place(x.workerId, x.travel, false))

    /* The ring is straight-line, drawn only for scale; membership is decided
       by road distance. Faint on purpose, and the legend says so. */
    if (!ringRef.current) {
      ringRef.current = L.circle([site.lat, site.lon], { radius: radius * 1000, interactive: false,
        color: token('--primary', '#2563eb'), weight: 2, dashArray: '7 6', fillColor: token('--primary', '#2563eb'), fillOpacity: 0.07 }).addTo(map)
    } else {
      ringRef.current.setLatLng([site.lat, site.lon]).setRadius(radius * 1000)
    }

  }, [site, inside, outside, radius, workerById])

  /* Framing lives on its own and keys off PRIMITIVES. Array identity cannot
     reach it, so no amount of re-rendering can steal the zoom the user chose:
     the view is refitted when the site, the radius or the filter changes, and
     at no other time. */
  const insideRef = useRef(inside)
  insideRef.current = inside
  const framedRef = useRef(false)

  /** Fit the site and everyone inside the radius. Returns false when the
   *  container has no width yet — there is nothing to fit against, and
   *  Leaflet would answer with the whole world. */
  const frame = () => {
    const map = mapRef.current, el = containerRef.current
    if (!map || !el || site.lat == null || site.lon == null) return false
    if (el.clientWidth === 0 || el.clientHeight === 0) return false
    /* Leaflet caches the container size; anything that changed the box since
       it last looked has to be announced. */
    map.invalidateSize()
    const bounds = L.latLngBounds([[site.lat, site.lon]])
    for (const x of insideRef.current) {
      const w = workerById.get(x.workerId)
      if (w?.lat && w?.lon) bounds.extend([w.lat, w.lon])
    }
    bounds.extend(L.latLng(site.lat, site.lon).toBounds(radius * 2000))
    const padded = bounds.pad(0.08)
    if (!padded.isValid()) return false
    map.fitBounds(padded, { maxZoom: 13 })
    return true
  }
  const frameRef = useRef(frame)
  frameRef.current = frame

  const frameKey = `${siteId}|${radius}|${filter}|${carOnly}`
  useEffect(() => {
    framedRef.current = frameRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey])

  /* Leaflet measures its container exactly once, at creation. A page that
     loads in a background tab — or behind the entrance animation — measures
     nothing, and the map is left showing the whole world with no way back.
     So the box is watched rather than trusted: the first time it has a real
     size the view is framed, and after that a resize only tells Leaflet the
     new size, which keeps whatever zoom the user has chosen. */
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (!mapRef.current) return
      if (!framedRef.current) framedRef.current = frameRef.current()
      else mapRef.current.invalidateSize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /* Selection only restyles and pans. The zoom is left exactly where the user
     put it. */
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.setStyle({ radius: id === selected ? 11 : 8, weight: id === selected ? 4 : 2.5 })
      if (id === selected) marker.bringToFront()
    })
    if (!selected) return
    const worker = workerById.get(selected)
    if (worker?.lat && worker?.lon) mapRef.current?.panTo([worker.lat, worker.lon], { animate: true })
    markersRef.current.get(selected)?.openTooltip()
  }, [selected, workerById, inside])

  const zoom = (delta: number) => { const m = mapRef.current; if (m) m.setZoom(m.getZoom() + delta) }

  return (
    <>
      <div className="map-toolbar">
        {!vacancyId && (
          <select value={siteId} onChange={e => { setChosen(e.target.value); setSelected(null) }} aria-label="Vacancy">
            {sites.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        )}
        <label>Within <input type="number" min={1} max={200} value={radius}
          onChange={e => setRadius(Math.max(1, Number(e.target.value) || 1))} /> km by car</label>
        <div className="seg">
          {(['all', 'free', 'working'] as Filter[]).map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => { setFilter(f); setSelected(null) }}>
              {f === 'all' ? 'Everyone' : f === 'free' ? 'Free' : 'Working'}
            </button>
          ))}
        </div>
        <label className="checkbox-inline">
          <input type="checkbox" checked={carOnly} onChange={e => { setCarOnly(e.target.checked); setSelected(null) }} />
          With car
        </label>
        <span>{inside.length} of {pool.length} within {radius} km{carOnly ? ', with a car' : ''}</span>
      </div>

      <div className="map-layout">
        <Panel className="map-canvas">
          <div ref={containerRef} className="leaflet-host" />
          <div className="map-controls">
            <div className="seg seg-vertical">
              <button onClick={() => zoom(1)} aria-label="Zoom in"><Plus /></button>
              <button onClick={() => zoom(-1)} aria-label="Zoom out"><Minus /></button>
            </div>
            <div className="seg">
              <button className={basemap === 'plain' ? 'active' : ''} onClick={() => setBasemap('plain')}>Map</button>
              <button className={basemap === 'satellite' ? 'active' : ''} onClick={() => setBasemap('satellite')}>Satellite</button>
            </div>
          </div>
        </Panel>

        <Panel className="distance-list">
          <div className="panel-header"><div><h2>People nearby</h2><p>Road distance · driving time, one way</p></div></div>
          {inside.map(({ workerId, travel }) => {
            const worker = workerById.get(workerId)!
            const state = stateOf(workerId)
            return (
              <button key={workerId} className={`distance-row ${selected === workerId ? 'selected' : ''}`}
                onClick={() => setSelected(workerId)}>
                <span><strong>{worker.fullName}</strong><small>{travel.km} km · {travel.minutes} min · {worker.city}{worker.hasCar ? ' · car' : ''}</small></span>
                <Badge tone={state === 'free' ? 'green' : state === 'leave' ? 'orange' : 'blue'}>{STATE_LABEL[state]}</Badge>
              </button>
            )
          })}
          {!inside.length && <StateBlock title={carOnly ? 'Nobody with a car within this drive' : 'Nobody within this drive'}
            description={carOnly ? 'Widen the radius, or switch the car filter off to see everyone.' : 'Widen the radius, or change the filter.'} />}
          {unknown.length > 0 && (
            <p className="map-note">{unknown.length} {unknown.length === 1 ? 'person has' : 'people have'} no travel on record — their address has not been geocoded.</p>
          )}
        </Panel>
      </div>

      <p className="map-legend-note">
        <span><i style={{ background: 'var(--status-free)' }} />Free</span>
        <span><i style={{ background: 'var(--status-leave)' }} />On leave</span>
        <span><i style={{ background: 'var(--status-working)' }} />Working</span>
        <span className="ring-note">The dashed ring is straight-line {radius} km, shown only for scale — membership is decided by road distance.</span>
      </p>
      <p className="map-note">
        Road distances to {site.address}, one way, computed {formatDate(TRAVEL_COMPUTED_AT)} with {TRAVEL_PROFILE}.
        Frozen deliberately: travel money is paid on these kilometres, so they change only when an address does.
        {selected && workerById.get(selected) && (
          <> Selected: <Link href={`/people/${selected}`}>{workerById.get(selected)!.fullName}</Link> — {travelFor(selected, siteId)?.km} km.</>
        )}
      </p>
    </>
  )
}

export function MapView() {
  return (
    <AppShell title="Map">
      <div className="content-inner">
        <PageHeading eyebrow="Matching" title="Map & travel" description="Who is within a drive of a site, and how far each of them actually travels." />
        <MapPanel />
      </div>
    </AppShell>
  )
}

'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Minus, Plus } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel, StateBlock } from './app-shell'
import { useWorkforceData } from './workforce-data-context'
import { dayStatus } from '@/lib/derive'
import { travelFor, travelIndex, withinDrive } from '@/lib/travel'
import { formatDate, joinDetails } from '@/lib/types'
import { useLanguage } from '@/lib/i18n'
import { useToday } from '@/lib/today'

/* Leaflet writes colours straight into SVG attributes, so it cannot take a CSS
   variable — it has to be handed a resolved string. Reading the token at draw
   time keeps the map on the same palette as the rest of the product instead of
   pinning three hex values that drift away from it. */
const token = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
const stateColour = (state: string) =>
  token(
    state === 'free' ? '--status-free' : state === 'leave' ? '--status-leave' : '--status-working',
    state === 'free' ? '#047857' : state === 'leave' ? '#b45309' : '#1d4ed8',
  )
const STATE_LABEL: Record<string, string> = { free: 'Free', leave: 'On leave', working: 'Working' }
/* Leaflet tooltips are HTML. Names and addresses come from Flexpedia, Supabase
   and the vacancy form, so every value is escaped before it is put in one. */
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  )
type Filter = 'all' | 'free' | 'working'

/** The map, usable on its own page or dropped at the bottom of a vacancy.
 *  When `vacancyId` is given the site is fixed and the picker disappears —
 *  with a hundred vacancies, hunting for one in a dropdown is worse than
 *  opening the vacancy you were already looking at. */
export function MapPanel({ vacancyId }: { vacancyId?: string }) {
  const today = useToday()
  const { leaves, roster, vacancies, workers, travel: distances, homeAreas } = useWorkforceData()
  const travel = useMemo(() => travelIndex(distances), [distances])
  const homes = useMemo(() => new Map(homeAreas.map(h => [h.workerId, h])), [homeAreas])
  const { t } = useLanguage()
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

  /* A vacancy without coordinates cannot be mapped; on a fresh install that
     is every vacancy, and the page shows how to fix it instead of failing. */
  const site = vacancies.find(v => v.id === siteId && v.lat !== null && v.lon !== null)
  /* `workers` is a module constant, so this list never actually changes —
     but recreating the array on every render made every memo downstream of it
     recompute, which re-ran the marker effect, which refitted the map. That is
     how selecting somebody was resetting the zoom. */
  const active = useMemo(() => workers.filter(w => w.status === 'active'), [workers])
  const stateOf = (workerId: string) => dayStatus(workerId, today, roster, leaves, vacancies)
  const workerById = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers])

  const pool = useMemo(
    () =>
      active
        .filter(
          w =>
            filter === 'all' || (filter === 'free' ? stateOf(w.id) === 'free' : stateOf(w.id) === 'working'),
        )
        .filter(w => !carOnly || w.hasCar === true),
    [active, filter, carOnly, roster, leaves, vacancies],
  )
  const { inside, outside, unknown } = useMemo(
    () =>
      withinDrive(
        travel,
        pool.map(w => w.id),
        siteId,
        radius,
      ),
    [travel, pool, siteId, radius],
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
    const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: false }).setView(
      [52.1, 5.1],
      7,
    )
    const plain = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery &copy; Esri' },
    )
    plain.addTo(map)
    tilesRef.current = { plain, satellite }
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    /* Effects run twice in development: every ref into the old map dies with it. */
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      ringRef.current = null
      tilesRef.current = null
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const t = tilesRef.current,
      map = mapRef.current
    if (!t || !map) return
    map.removeLayer(basemap === 'plain' ? t.satellite : t.plain)
    ;(basemap === 'plain' ? t.plain : t.satellite).addTo(map)
  }, [basemap])

  /* Markers and framing. Deliberately does NOT depend on `selected`: refitting
     the view every time somebody is picked was zooming the map out from under
     the user. Selection is handled separately, below. */
  useEffect(() => {
    const map = mapRef.current,
      layer = layerRef.current
    if (!map || !layer || !site || site.lat == null || site.lon == null) return
    layer.clearLayers()
    markersRef.current.clear()

    /* A tooltip is a hover affordance and announces to nobody. Leaflet renders
       these as focusable elements, so without a name a screen reader reads the
       map as a row of unlabelled buttons. */
    const sitePin = L.marker([site.lat, site.lon], {
      icon: L.divIcon({
        className: 'site-pin',
        html: '<span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      zIndexOffset: 1000,
    })
      .bindTooltip(`<strong>${escapeHtml(site.title)}</strong><br>${escapeHtml(site.address)}`)
      .addTo(layer)
    sitePin.getElement()?.setAttribute('aria-label', `${site.title}, ${site.address}`)

    const place = (workerId: string, travel: { km: number; minutes: number }, isInside: boolean) => {
      const worker = workerById.get(workerId)
      const home = homes.get(workerId)
      if (!worker || !home) return
      const state = stateOf(workerId)
      const marker = L.circleMarker([home.lat, home.lon], {
        radius: 8,
        weight: 2.5,
        color: token('--card', '#ffffff'),
        fillColor: stateColour(state),
        fillOpacity: isInside ? 1 : 0.35,
        opacity: isInside ? 1 : 0.4,
      })
      marker.bindTooltip(
        `<strong>${escapeHtml(worker.fullName)}</strong><br>${travel.km} km · ${travel.minutes} min ${escapeHtml(t('by car'))}<br>${escapeHtml(t(STATE_LABEL[state]))}`,
        { direction: 'top' },
      )
      marker.on('click', () => setSelected(workerId))
      marker.addTo(layer)
      const el = marker.getElement()
      if (el) {
        el.setAttribute('role', 'button')
        el.setAttribute(
          'aria-label',
          `${worker.fullName}, ${travel.km} km, ${travel.minutes} min ${t('by car')}, ${t(STATE_LABEL[state])}`,
        )
      }
      markersRef.current.set(workerId, marker)
    }
    inside.forEach(x => place(x.workerId, x.travel, true))
    outside.forEach(x => place(x.workerId, x.travel, false))

    /* The ring is straight-line, drawn only for scale; membership is decided
       by road distance. Faint on purpose, and the legend says so. */
    if (!ringRef.current) {
      ringRef.current = L.circle([site.lat, site.lon], {
        radius: radius * 1000,
        interactive: false,
        color: token('--primary', '#2563eb'),
        weight: 2,
        dashArray: '7 6',
        fillColor: token('--primary', '#2563eb'),
        fillOpacity: 0.07,
      }).addTo(map)
    } else {
      ringRef.current.setLatLng([site.lat, site.lon]).setRadius(radius * 1000)
    }
  }, [site, inside, outside, radius, workerById, homes, t])

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
    const map = mapRef.current,
      el = containerRef.current
    if (!map || !el || !site || site.lat == null || site.lon == null) return false
    if (el.clientWidth === 0 || el.clientHeight === 0) return false
    /* Leaflet caches the container size; anything that changed the box since
       it last looked has to be announced. */
    map.invalidateSize()
    const bounds = L.latLngBounds([[site.lat, site.lon]])
    for (const x of insideRef.current) {
      const home = homes.get(x.workerId)
      if (home) bounds.extend([home.lat, home.lon])
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
    const home = homes.get(selected)
    if (home) mapRef.current?.panTo([home.lat, home.lon], { animate: true })
    markersRef.current.get(selected)?.openTooltip()
  }, [selected, homes, inside])

  const zoom = (delta: number) => {
    const m = mapRef.current
    if (m) m.setZoom(m.getZoom() + delta)
  }
  const computed = inside.concat(outside).map(x => x.travel)
  const latest = computed.reduce<string | null>(
    (max, x) => (!max || x.computedAt > max ? x.computedAt : max),
    null,
  )

  if (!site) {
    return (
      <StateBlock
        title="No vacancy has a location yet"
        description="Open a vacancy, choose Edit and pick its work address. Travel distances are calculated for everyone with a home address from Flexpedia."
      />
    )
  }

  return (
    <>
      <div className="map-toolbar">
        {!vacancyId && (
          <select
            value={siteId}
            onChange={e => {
              setChosen(e.target.value)
              setSelected(null)
            }}
            aria-label={t('Vacancy')}
          >
            {sites.map(v => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        )}
        <label>
          {t('Within')}{' '}
          <input
            type="number"
            min={1}
            max={200}
            value={radius}
            onChange={e => setRadius(Math.max(1, Number(e.target.value) || 1))}
          />{' '}
          {t('km by car')}
        </label>
        <div className="seg">
          {(['all', 'free', 'working'] as Filter[]).map(f => (
            <button
              key={f}
              className={filter === f ? 'active' : ''}
              onClick={() => {
                setFilter(f)
                setSelected(null)
              }}
            >
              {t(f === 'all' ? 'Everyone' : f === 'free' ? 'Free' : 'Working')}
            </button>
          ))}
        </div>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={carOnly}
            onChange={e => {
              setCarOnly(e.target.checked)
              setSelected(null)
            }}
          />
          {t('With car')}
        </label>
        <span>
          {t(
            carOnly
              ? '{inside} of {pool} within {radius} km, with a car'
              : '{inside} of {pool} within {radius} km',
            { inside: inside.length, pool: pool.length, radius },
          )}
        </span>
      </div>

      <div className="map-layout">
        <Panel className="map-canvas">
          <div ref={containerRef} className="leaflet-host" />
          <div className="map-controls">
            <div className="seg seg-vertical">
              <button onClick={() => zoom(1)} aria-label={t('Zoom in')}>
                <Plus />
              </button>
              <button onClick={() => zoom(-1)} aria-label={t('Zoom out')}>
                <Minus />
              </button>
            </div>
            <div className="seg">
              <button className={basemap === 'plain' ? 'active' : ''} onClick={() => setBasemap('plain')}>
                {t('Map')}
              </button>
              <button
                className={basemap === 'satellite' ? 'active' : ''}
                onClick={() => setBasemap('satellite')}
              >
                {t('Satellite')}
              </button>
            </div>
          </div>
        </Panel>

        <Panel className="distance-list">
          <div className="panel-header">
            <div>
              <h2>{t('People nearby')}</h2>
              <p>{t('Road distance · driving time, one way')}</p>
            </div>
          </div>
          {inside.map(({ workerId, travel }) => {
            const worker = workerById.get(workerId)!
            const state = stateOf(workerId)
            return (
              <button
                key={workerId}
                className={`distance-row ${selected === workerId ? 'selected' : ''}`}
                onClick={() => setSelected(workerId)}
              >
                <span>
                  <strong>{worker.fullName}</strong>
                  <small>
                    {joinDetails(
                      `${travel.km} km`,
                      `${travel.minutes} min`,
                      worker.city,
                      worker.hasCar && t('car'),
                    )}
                  </small>
                </span>
                <Badge tone={state === 'free' ? 'green' : state === 'leave' ? 'orange' : 'blue'}>
                  {t(STATE_LABEL[state])}
                </Badge>
              </button>
            )
          })}
          {!inside.length && (
            <StateBlock
              title={carOnly ? t('Nobody with a car within this drive') : t('Nobody within this drive')}
              description={
                carOnly
                  ? 'Widen the radius, or switch the car filter off to see everyone.'
                  : 'Widen the radius, or change the filter.'
              }
            />
          )}
          {unknown.length > 0 && (
            <p className="map-note">
              {t(
                '{count} without a calculated distance: no home address from Flexpedia yet, or it could not be located.',
                { count: unknown.length },
              )}
            </p>
          )}
        </Panel>
      </div>

      <p className="map-legend-note">
        <span>
          <i style={{ background: 'var(--status-free)' }} />
          {t('Free')}
        </span>
        <span>
          <i style={{ background: 'var(--status-leave)' }} />
          {t('On leave')}
        </span>
        <span>
          <i style={{ background: 'var(--status-working)' }} />
          {t('Working')}
        </span>
        <span className="ring-note">
          {t(
            'The dashed ring is straight-line {radius} km, shown only for scale — membership is decided by road distance.',
            { radius },
          )}
        </span>
      </p>
      <p className="map-note">
        {latest
          ? t(
              'Road distances to {address}, one way, last calculated {date} with {profile}. Frozen deliberately: travel money is paid on these kilometres, so they change only when an address does.',
              { address: site.address, date: formatDate(latest), profile: computed[0].profile },
            )
          : t('Road distances are calculated every hour for people whose Flexpedia address is known.')}
        {selected && workerById.get(selected) && (
          <>
            {' '}
            {t('Selected:')} <Link href={`/people/${selected}`}>{workerById.get(selected)!.fullName}</Link> —{' '}
            {t('{km} km', { km: travelFor(travel, selected, siteId)?.km ?? '—' })}
          </>
        )}
      </p>
    </>
  )
}

export function MapView() {
  return (
    <AppShell title="Map">
      <div className="content-inner">
        <PageHeading
          eyebrow="Matching"
          title="Map & travel"
          description="Who is within a drive of a site, and how far each of them actually travels."
        />
        <MapPanel />
      </div>
    </AppShell>
  )
}

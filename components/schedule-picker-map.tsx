'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type PickerStatus = 'free' | 'other' | 'busy' | 'leave' | 'blocked'
export type Transport = 'car' | 'bike' | 'both' | 'none' | 'unknown'
export type PickerPerson = {
  id: string
  name: string
  lat: number
  lon: number
  status: PickerStatus
  transport: Transport
  detail: string
  selected: boolean
  selectable: boolean
}

/* Leaflet writes colours into SVG and HTML attributes, so the theme's tokens
   are resolved to strings when the markers are drawn. */
const token = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  )

/* Line icons in the marker itself, so the map answers "how do they get here"
   without a hover. Drawn after lucide's car and bike. */
const CAR =
  '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'
const BIKE =
  '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
const glyph = (transport: Transport) =>
  transport === 'car' || transport === 'both'
    ? svg(CAR) + (transport === 'both' ? '<i class="pick-marker-plus"></i>' : '')
    : transport === 'bike'
      ? svg(BIKE)
      : transport === 'none'
        ? '<b>–</b>'
        : '<b>?</b>'

/* Homes are stored rounded to the neighbourhood, so neighbours share a point.
   Fanning them out a little keeps every one of them clickable. */
function spread(people: PickerPerson[]) {
  const groups = new Map<string, PickerPerson[]>()
  for (const person of people) {
    const key = `${person.lat.toFixed(3)},${person.lon.toFixed(3)}`
    groups.set(key, [...(groups.get(key) ?? []), person])
  }
  const placed: { person: PickerPerson; lat: number; lon: number }[] = []
  for (const group of groups.values()) {
    group.forEach((person, index) => {
      if (group.length === 1) {
        placed.push({ person, lat: person.lat, lon: person.lon })
        return
      }
      const angle = (index / group.length) * Math.PI * 2
      const radius = 0.0016 * (1 + Math.floor(index / 8))
      placed.push({ person, lat: person.lat + radius * Math.sin(angle), lon: person.lon + radius * 1.6 * Math.cos(angle) })
    })
  }
  return placed
}

export function PickerMap({
  site,
  people,
  radiusKm,
  highlighted,
  onToggle,
  onHover,
}: {
  site: { lat: number; lon: number; title: string }
  people: PickerPerson[]
  radiusKm: number | null
  highlighted: string | null
  onToggle: (id: string) => void
  onHover: (id: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const ringRef = useRef<L.Circle | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())
  const framedRef = useRef(false)
  const toggleRef = useRef(onToggle)
  const hoverRef = useRef(onHover)
  toggleRef.current = onToggle
  hoverRef.current = onHover

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(
      [site.lat, site.lon],
      11,
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    /* The dialog animates in; measure again once it has its final size. */
    const resize = window.setTimeout(() => map.invalidateSize(), 250)
    const markers = markersRef.current
    return () => {
      window.clearTimeout(resize)
      map.remove()
      mapRef.current = null
      layerRef.current = null
      ringRef.current = null
      markers.clear()
      framedRef.current = false
    }
  }, [site.lat, site.lon])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markersRef.current.clear()

    L.marker([site.lat, site.lon], {
      icon: L.divIcon({ className: 'site-pin', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 1000,
      keyboard: false,
    })
      .bindTooltip(`<strong>${escapeHtml(site.title)}</strong>`)
      .addTo(layer)

    ringRef.current = radiusKm
      ? L.circle([site.lat, site.lon], {
          radius: radiusKm * 1000,
          color: token('--green-ink', '#4f8a58'),
          weight: 1.5,
          fillOpacity: 0.05,
          dashArray: '6 6',
          interactive: false,
        }).addTo(layer)
      : null

    const placed = spread(people)
    for (const { person, lat, lon } of placed) {
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: '',
          html: `<span class="pick-marker status-${person.status}${person.selected ? ' selected' : ''}${person.selectable ? '' : ' unselectable'}">${glyph(person.transport)}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: person.name,
        alt: person.name,
        riseOnHover: true,
        zIndexOffset: person.selected ? 500 : 0,
      })
        .bindTooltip(`<strong>${escapeHtml(person.name)}</strong><br>${escapeHtml(person.detail)}`, {
          direction: 'top',
          offset: [0, -14],
        })
        .on('click', () => {
          if (person.selectable) toggleRef.current(person.id)
        })
        .on('mouseover', () => hoverRef.current(person.id))
        .on('mouseout', () => hoverRef.current(null))
        .addTo(layer)
      markersRef.current.set(person.id, marker)
    }

    /* Frame the site and the people once; after that the user's own pan and
       zoom stay put while they tick people. */
    if (!framedRef.current) {
      const points: L.LatLngExpression[] = [[site.lat, site.lon], ...placed.map(p => [p.lat, p.lon] as L.LatLngTuple)]
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 13 })
      framedRef.current = true
    }
  }, [people, radiusKm, site.lat, site.lon, site.title])

  /* The list row under the pointer lights up its marker. */
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const element = marker.getElement()?.querySelector('.pick-marker')
      element?.classList.toggle('highlighted', id === highlighted)
      if (id === highlighted) marker.setZIndexOffset(800)
    }
  }, [highlighted, people])

  return <div ref={containerRef} className="picker-map" role="region" aria-label="Map of where people live" />
}

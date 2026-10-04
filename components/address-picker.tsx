'use client'
import { useEffect, useRef, useState } from 'react'
import { Crosshair, MapPin, Search } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

export type PickedAddress = { label: string; lat: number; lon: number }
type Result = PickedAddress & { detail: string }

/**
 * Choosing a site address without typing one.
 *
 * A free-typed address is the single biggest source of wrong distances: it may
 * not resolve at all, or it may resolve to a same-named street in another town,
 * and nobody notices until travel money is paid on it. So the address is never
 * stored as prose — it is searched, picked from real results, and stored with
 * the coordinates that came with it.
 *
 * Deliberately NOT a "paste a Google Maps link" box. Short links carry no
 * coordinates and have to be followed server-side, long ones carry the map's
 * viewport rather than the place, and scraping either is against those terms.
 * Pasting a plain "52.3138, 4.9377" is supported instead — every maps app can
 * copy that, and it means exactly one thing.
 */
export function AddressPicker({ value, onChange }: {
  value: PickedAddress | null
  onChange: (picked: PickedAddress | null) => void
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [state, setState] = useState<'idle' | 'searching' | 'empty' | 'error'>('idle')

  useEffect(() => {
    const text = query.trim()
    if (text.length < 3) { setResults([]); setState('idle'); return }

    /* Coordinates pasted straight in. Accepts "52.3138, 4.9377" and the same
       with a space — the two forms every maps app puts on the clipboard. */
    const pair = text.match(/^\s*(-?\d{1,3}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)\s*$/)
    if (pair) {
      setResults([{ label: `${pair[1]}, ${pair[2]}`, detail: t('Coordinates entered directly'), lat: Number(pair[1]), lon: Number(pair[2]) }])
      setState('idle')
      return
    }

    /* Typing is throttled: the geocoder is a shared public service and it asks
       for roughly one request a second. */
    const timer = setTimeout(async () => {
      setState('searching')
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`)
        const data = await response.json()
        setResults(data.results ?? [])
        setState(data.error ? 'error' : (data.results ?? []).length ? 'idle' : 'empty')
      } catch { setState('error') }
    }, 600)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="address-picker">
      <div className="address-search">
        <Search />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t('Search an address, or paste 52.3138, 4.9377')} aria-label={t('Search the site address')} />
      </div>

      {state === 'searching' && <p className="address-note">{t('Searching…')}</p>}
      {state === 'empty' && <p className="address-note">{t('Nothing found. Try the postcode and house number — in the Netherlands that pair is unique.')}</p>}
      {state === 'error' && <p className="address-note warn">{t('The address service did not answer. You can paste coordinates instead.')}</p>}

      {results.length > 0 && (
        <ul className="address-results">
          {results.map(r => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" onClick={() => { onChange({ label: r.label, lat: r.lat, lon: r.lon }); setResults([]); setQuery('') }}>
                <MapPin />
                <span><strong>{r.label}</strong><small>{r.detail}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && (
        <div className="address-chosen">
          <div>
            <strong>{value.label}</strong>
            <small>{value.lat.toFixed(5)}, {value.lon.toFixed(5)}</small>
          </div>
          <button type="button" className="button button-secondary button-small" onClick={() => onChange(null)}>{t('Change')}</button>
        </div>
      )}
      {value && <PinMap value={value} onMove={(lat, lon) => onChange({ ...value, lat, lon })} />}
      {!value && <p className="address-note">{t('Nothing is saved until an address is picked — an address with no coordinates cannot be used for distances.')}</p>}
    </div>
  )
}

/** A small map with a draggable pin, so the chosen point can be seen and
 *  corrected. Geocoders put a house on the right street but not always on the
 *  right side of it, and for a large site the gate matters. */
function PinMap({ value, onMove }: { value: PickedAddress; onMove: (lat: number, lon: number) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)

  useEffect(() => {
    let cancelled = false
    /* Leaflet reaches for `window` at import time, so it is pulled in only
       once this panel is actually on screen. */
    import('leaflet').then(L => {
      if (cancelled || !hostRef.current || mapRef.current) return
      const map = L.map(hostRef.current, { zoomControl: false, attributionControl: true }).setView([value.lat, value.lon], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap',
      }).addTo(map)
      const marker = L.marker([value.lat, value.lon], {
        draggable: true,
        icon: L.divIcon({ className: 'site-pin', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(map)
      marker.on('dragend', () => { const p = marker.getLatLng(); onMove(p.lat, p.lng) })
      mapRef.current = map
      markerRef.current = marker
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Picking a different result moves the existing map instead of rebuilding it. */
  useEffect(() => {
    markerRef.current?.setLatLng([value.lat, value.lon])
    mapRef.current?.setView([value.lat, value.lon], 16)
  }, [value.lat, value.lon])

  return (
    <>
      <div ref={hostRef} className="address-map" />
      <p className="address-note"><Crosshair /> Drag the pin if it landed on the wrong entrance — the distance is measured from exactly here.</p>
    </>
  )
}

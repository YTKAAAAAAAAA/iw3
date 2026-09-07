'use client'
import dynamic from 'next/dynamic'

/* Leaflet reaches for `window` the moment it is imported, so it must never be
   pulled in during server rendering. */
const MapView = dynamic(() => import('@/components/map-view').then(m => m.MapView), {
  ssr: false,
  loading: () => <div style={{ padding: 32, color: 'var(--muted-foreground)', fontSize: 13 }}>Loading map…</div>,
})

export default function Page() { return <MapView /> }

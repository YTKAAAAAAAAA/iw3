'use client'

import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/map-view').then(module => module.MapView), {
  ssr: false,
  loading: () => <div style={{ padding: 32, color: 'var(--muted-foreground)', fontSize: 13 }}>Loading map…</div>,
})

export function MapWorkspace() {
  return <MapView />
}

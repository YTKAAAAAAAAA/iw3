'use client'

import { RefreshCw } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from './workforce-data-context'
import { formatDate } from '@/lib/types'

export function SyncView() {
  const { workers, sync } = useWorkforceData()
  return <AppShell title="Sync sources"><div className="content-inner"><PageHeading eyebrow="Data connections" title="Sync sources" description="External synchronization is not connected in this version."/><div className="sync-grid">{sync.map(source=><Panel key={source.source}><div className="panel-header"><div><h2>{source.source==='flexpedia'?'Flexpedia':'Manatal'}</h2><p>{source.source==='flexpedia'?'Workers and employment status':'Candidate links and CV references'}</p></div><Badge tone="neutral">Not connected</Badge></div><div className="sync-meta"><span>Last sync</span><strong>{formatDate(source.lastSyncAt)}</strong></div><button className="button button-secondary" disabled title="Provider credentials and synchronization are not configured"><RefreshCw/> Sync unavailable</button></Panel>)}</div><Panel><div className="panel-header"><div><h2>Workforce records</h2><p>Imported Warehouse people, absences, and shifts.</p></div><Badge tone="neutral">{workers.length} workers</Badge></div><StateBlock title="External sync is not configured" description="No provider API call was made. Current worker and schedule data remains in PostgreSQL; Flexpedia identifiers can be attached without replacing local worker IDs." /></Panel></div></AppShell>
}

import type { FlexpediaFixturePreview } from './flexpedia-fixture'

export type WarehouseSyncSummary = {
  workersAdded: number
  workersUpdated: number
  shiftsAdded: number
  shiftsUpdated: number
  shiftsProtected: number
  shiftsDeleted: number
  absencesAdded: number
  absencesUpdated: number
  absencesDeleted: number
}

export type WarehouseSyncStatus = {
  enabled: boolean
  configured: boolean
  lastSyncAt: string | null
  lastSummary: WarehouseSyncSummary | null
  lastError: string | null
}

export type FlexpediaTestResult = {
  employees: number
  pages: number
  matched: number
  unmatched: number
  ambiguous: number
  writesPerformed: false
}

export type FlexpediaSyncSummary = {
  employeesAdded: number
  employeesUpdated: number
}

export type FlexpediaSyncStatus = {
  lastSyncAt: string | null
  lastSummary: FlexpediaSyncSummary | null
  lastError: string | null
}

export type FlexpediaFixturePreviewResult = FlexpediaFixturePreview

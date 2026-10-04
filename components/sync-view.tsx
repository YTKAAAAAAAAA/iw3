'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from './workforce-data-context'
import { useLanguage } from '@/lib/i18n'
import { formatDateTime } from '@/lib/types'
import type {
  FlexpediaFixturePreviewResult,
  FlexpediaSyncStatus,
  FlexpediaSyncSummary,
  FlexpediaTestResult,
  WarehouseSyncStatus,
  WarehouseSyncSummary,
} from '@/lib/sync/types'

type SyncResponse = {
  scheduleMinutes?: number
  status?: WarehouseSyncStatus
  summary?: WarehouseSyncSummary
  error?: string
  flexpediaConfigured?: boolean
  flexpediaStatus?: FlexpediaSyncStatus
  flexpediaSummary?: FlexpediaSyncSummary
  fixturePreview?: FlexpediaFixturePreviewResult
}

type SyncMessage = {
  key: string
  values?: Record<string, string | number>
}

function isWarehouseSyncSummary(value: unknown): value is WarehouseSyncSummary {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.workersAdded) &&
    Number.isSafeInteger(value.workersUpdated) &&
    Number.isSafeInteger(value.shiftsAdded) &&
    Number.isSafeInteger(value.shiftsUpdated) &&
    Number.isSafeInteger(value.shiftsProtected) &&
    Number.isSafeInteger(value.shiftsDeleted) &&
    Number.isSafeInteger(value.absencesAdded) &&
    Number.isSafeInteger(value.absencesUpdated) &&
    Number.isSafeInteger(value.absencesDeleted)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSyncStatus(value: unknown): value is WarehouseSyncStatus {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.configured === 'boolean' &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === 'string') &&
    (value.lastError === null || typeof value.lastError === 'string') &&
    (value.lastSummary === null || isWarehouseSyncSummary(value.lastSummary))
  )
}

function isFlexpediaResult(value: unknown): value is FlexpediaTestResult {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.employees) &&
    Number.isSafeInteger(value.pages) &&
    Number.isSafeInteger(value.matched) &&
    Number.isSafeInteger(value.unmatched) &&
    Number.isSafeInteger(value.ambiguous) &&
    value.writesPerformed === false
  )
}

function isFlexpediaSyncSummary(value: unknown): value is FlexpediaSyncSummary {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.employeesAdded) &&
    Number.isSafeInteger(value.employeesUpdated)
  )
}

function isFlexpediaSyncStatus(value: unknown): value is FlexpediaSyncStatus {
  return (
    isRecord(value) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === 'string') &&
    (value.lastError === null || typeof value.lastError === 'string') &&
    (value.lastSummary === null || isFlexpediaSyncSummary(value.lastSummary))
  )
}

function isFlexpediaFixturePreview(value: unknown): value is FlexpediaFixturePreviewResult {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.existingMatched) &&
    Number.isSafeInteger(value.existingWouldEnrich) &&
    Number.isSafeInteger(value.newWouldAdd) &&
    Number.isSafeInteger(value.existingFieldsChanged) &&
    Number.isSafeInteger(value.apiFieldsCovered) &&
    Number.isSafeInteger(value.assignedShiftsPreserved) &&
    Number.isSafeInteger(value.courseDaysPreserved) &&
    Number.isSafeInteger(value.absencesPreserved) &&
    value.writesPerformed === false
  )
}

async function readResponse(response: Response): Promise<SyncResponse> {
  // A proxy timeout answers with an HTML page, not JSON.
  const value: unknown = await response.json().catch(() => {
    throw new Error('The sync service did not answer. Try again in a minute.')
  })
  if (!isRecord(value)) throw new Error('The sync service returned an invalid response.')
  return value as SyncResponse
}

export function SyncView() {
  const router = useRouter()
  const { workers } = useWorkforceData()
  const { t } = useLanguage()
  const [scheduleMinutes, setScheduleMinutes] = useState(0)
  const [status, setStatus] = useState<WarehouseSyncStatus | null>(null)
  const [flexpediaStatus, setFlexpediaStatus] = useState<FlexpediaSyncStatus | null>(null)
  const [flexpediaConfigured, setFlexpediaConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<SyncMessage | null>(null)
  const [flexpediaResult, setFlexpediaResult] = useState<FlexpediaTestResult | null>(null)
  const [fixturePreview, setFixturePreview] = useState<FlexpediaFixturePreviewResult | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/sync', { cache: 'no-store' })
      .then(async response => {
        const body = await readResponse(response)
        if (!response.ok) throw new Error(body.error ?? 'Could not load sync status.')
        if (!isSyncStatus(body) || !isFlexpediaSyncStatus(body.flexpediaStatus)) {
          throw new Error('The sync service returned an invalid status.')
        }
        return {
          status: body,
          flexpediaStatus: body.flexpediaStatus,
          flexpediaConfigured: body.flexpediaConfigured === true,
          scheduleMinutes: typeof body.scheduleMinutes === 'number' ? body.scheduleMinutes : 0,
        }
      })
      .then(result => {
        if (!active) return
        setStatus(result.status)
        setFlexpediaStatus(result.flexpediaStatus)
        setFlexpediaConfigured(result.flexpediaConfigured)
        setScheduleMinutes(result.scheduleMinutes)
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load sync status.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function submit(action: string) {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        cache: 'no-store',
      })
      const body = await readResponse(response)
      if (!response.ok) throw new Error(body.error ?? 'The sync request failed.')
      if (action === 'test-flexpedia') {
        if (!isFlexpediaResult(body)) throw new Error('Flexpedia returned an invalid test result.')
        setFlexpediaResult(body)
        setMessage({ key: 'Flexpedia connection test completed. No data was written.' })
        return
      }
      if (action === 'sync-flexpedia') {
        if (!isFlexpediaSyncSummary(body.flexpediaSummary) || !isFlexpediaSyncStatus(body.flexpediaStatus)) {
          throw new Error('Flexpedia synchronization returned an invalid summary.')
        }
        setFlexpediaStatus(body.flexpediaStatus)
        router.refresh()
        setMessage({
          key: 'Flexpedia sync completed — new employees added: {employeesAdded}; profiles updated: {employeesUpdated}. Employment status is managed manually.',
          values: body.flexpediaSummary,
        })
        return
      }
      if (action === 'preview-flexpedia-fixture') {
        if (!isFlexpediaFixturePreview(body)) {
          throw new Error('The Flexpedia fixture preview returned an invalid result.')
        }
        setFixturePreview(body)
        setMessage({ key: 'Isolated Flexpedia fixture preview completed. No database records were written.' })
        return
      }
      if (action === 'sync-supabase') {
        if (!isSyncStatus(body.status) || !isWarehouseSyncSummary(body.summary)) {
          throw new Error('The Warehouse sync returned an invalid summary.')
        }
        setStatus(body.status)
        router.refresh()
        setMessage({
          key: 'Warehouse snapshot reconciled. Source-linked shifts and absences now match Supabase; local-only records remain.',
        })
        return
      }
      if (!isSyncStatus(body)) throw new Error('The sync service returned an invalid status.')
      setStatus(body)
      router.refresh()
      setMessage({
        key:
          action === 'enable-supabase'
            ? 'Supabase sync enabled. Existing records were not changed.'
            : 'Supabase sync disabled. Imported Warehouse history remains in the database.',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The sync request failed.')
    } finally {
      setWorking(false)
    }
  }

  const lastSync = status?.lastSyncAt ? formatDateTime(status.lastSyncAt) : t('Never')
  const flexpediaLastSync = flexpediaStatus?.lastSyncAt
    ? formatDateTime(flexpediaStatus.lastSyncAt)
    : t('Never')
  const scheduleNote = scheduleMinutes
    ? t('Syncs automatically every {minutes} minutes. You can also sync now.', { minutes: scheduleMinutes })
    : t('Automatic sync is off on this server. Sync manually here.')

  return (
    <AppShell title="Sync sources">
      <div className="content-inner">
        <PageHeading eyebrow="Data connections" title="Sync sources" description={scheduleNote} />
        {error && <StateBlock kind="error" title="Sync request failed" description={t(error)} />}
        {message && (
          <p role="status" className="field-hint">
            {t(message.key, message.values)}
          </p>
        )}
        <div className="sync-grid">
          <Panel>
            <div className="panel-header">
              <div>
                <h2>{t('Warehouse — Supabase snapshot')}</h2>
                <p>{t('Workers, Warehouse shifts, and absence periods.')}</p>
              </div>
              <Badge tone={status?.enabled ? 'success' : 'neutral'}>
                {loading ? t('Loading') : status?.enabled ? t('Enabled') : t('Disabled')}
              </Badge>
            </div>
            <div className="sync-body">
              <div className="sync-meta">
                <span>{t('Last sync')}</span>
                <strong>{lastSync}</strong>
              </div>
              {status?.lastError && (
                <p role="status" className="field-hint">
                  {t('Last sync error:')} {t(status.lastError)}
                </p>
              )}
              {status?.lastSummary && (
                <p className="field-hint">
                  {t(
                    'Last result: {workersAdded} workers added, {workersUpdated} updated; {shiftsAdded} shifts added, {shiftsUpdated} updated, {shiftsDeleted} deleted; {absencesAdded} absences added, {absencesUpdated} updated, {absencesDeleted} deleted.',
                    status.lastSummary,
                  )}
                </p>
              )}
              <div className="button-row">
                <button
                  className="button button-primary"
                  type="button"
                  disabled={loading || working || !status?.enabled || !status.configured}
                  onClick={() => submit('sync-supabase')}
                >
                  <RefreshCw aria-hidden="true" />
                  {working ? t('Working…') : t('Sync Warehouse now')}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={loading || working}
                  onClick={() => submit(status?.enabled ? 'disable-supabase' : 'enable-supabase')}
                >
                  {status?.enabled ? t('Disable Supabase sync') : t('Enable Supabase sync')}
                </button>
              </div>
              {!status?.configured && !loading && (
                <p className="field-hint">
                  {t('Supabase is not connected on this server yet. Ask the administrator to set it up.')}
                </p>
              )}
              <p className="field-hint">
                {t(
                  'Sync is a read-only Supabase snapshot. Imported shifts and absences are reconciled by source ID, including source deletions. Local-only records are not removed. When a source shift is deleted, its shift and attached offer records are deleted too.',
                )}
              </p>
            </div>
          </Panel>

          <Panel>
            <div className="panel-header">
              <div>
                <h2>{t('Flexpedia employee sync')}</h2>
                <p>
                  {t('Flexpedia updates employee profiles only. Manage employment status manually here.')}
                </p>
              </div>
              <Badge tone={flexpediaConfigured ? 'success' : 'neutral'}>
                {flexpediaConfigured ? t('Connected') : t('Not connected')}
              </Badge>
            </div>
            <div className="sync-body">
              <div className="sync-meta">
                <span>{t('Last sync')}</span>
                <strong>{flexpediaLastSync}</strong>
              </div>
              {flexpediaStatus?.lastError && (
                <p role="status" className="field-hint">
                  {t('Last sync error:')} {t(flexpediaStatus.lastError)}
                </p>
              )}
              {flexpediaStatus?.lastSummary && (
                <p className="field-hint">
                  {t(
                    'Last Flexpedia result: {employeesAdded} added, {employeesUpdated} profiles updated. Employment status is managed manually.',
                    flexpediaStatus.lastSummary,
                  )}
                </p>
              )}
              <div className="button-row">
                <button
                  className="button button-primary"
                  type="button"
                  disabled={loading || working || !flexpediaConfigured}
                  onClick={() => submit('sync-flexpedia')}
                >
                  <RefreshCw aria-hidden="true" />
                  {working ? t('Working…') : t('Sync Flexpedia employees')}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={working || !flexpediaConfigured}
                  onClick={() => submit('test-flexpedia')}
                >
                  {t('Test Flexpedia connection')}
                </button>
              </div>
              {!flexpediaConfigured && !loading && (
                <p className="field-hint">
                  {t(
                    'Flexpedia is not connected on this server yet. Ask the administrator to add the API token.',
                  )}
                </p>
              )}
              <p className="field-hint">
                {t(
                  'Flexpedia profile fields are authoritative, including null values. Flexpedia sync never dismisses or reactivates employees. Use the People page to change employment status; shifts, absences, hours, and work history remain. New employees are added without company access until assigned locally.',
                )}
              </p>
              {flexpediaResult && (
                <p role="status" className="field-hint">
                  {t(
                    'Read {employees} employees in {pages} pages; {matched} matched, {unmatched} unmatched, {ambiguous} ambiguous. No records were changed.',
                    {
                      employees: flexpediaResult.employees,
                      pages: flexpediaResult.pages,
                      matched: flexpediaResult.matched,
                      unmatched: flexpediaResult.unmatched,
                      ambiguous: flexpediaResult.ambiguous,
                    },
                  )}
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="panel-header">
              <div>
                <h2>{t('Flexpedia — isolated merge fixture')}</h2>
                <p>
                  {t(
                    'One existing worker and one synthetic new employee, using all 18 documented EmployeeModel fields.',
                  )}
                </p>
              </div>
              <Badge tone="neutral">{t('No database writes')}</Badge>
            </div>
            <div className="sync-body">
              <p className="field-hint">
                {t(
                  'Optional fields may be null in real API responses. The preview replaces the profile from Flexpedia; shifts, course days, and absences stay unchanged.',
                )}
              </p>
              <div className="button-row">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={working || loading}
                  onClick={() => submit('preview-flexpedia-fixture')}
                >
                  {t('Preview one-time fixture')}
                </button>
              </div>
              {fixturePreview && (
                <p role="status" className="field-hint">
                  {t(
                    '{existingMatched} existing worker matched; {existingWouldEnrich} would be updated ({existingFieldsChanged} profile fields changed); {newWouldAdd} new demo worker would be added. Preserved: {assignedShiftsPreserved} shifts, {courseDaysPreserved} course days, {absencesPreserved} absence periods. Covered {apiFieldsCovered} schema fields. No records were written.',
                    {
                      existingMatched: fixturePreview.existingMatched,
                      existingWouldEnrich: fixturePreview.existingWouldEnrich,
                      existingFieldsChanged: fixturePreview.existingFieldsChanged,
                      newWouldAdd: fixturePreview.newWouldAdd,
                      assignedShiftsPreserved: fixturePreview.assignedShiftsPreserved,
                      courseDaysPreserved: fixturePreview.courseDaysPreserved,
                      absencesPreserved: fixturePreview.absencesPreserved,
                      apiFieldsCovered: fixturePreview.apiFieldsCovered,
                    },
                  )}
                </p>
              )}
            </div>
          </Panel>
        </div>

        <Panel>
          <div className="panel-header">
            <div>
              <h2>{t('Local workforce history')}</h2>
              <p>{t('Synced records and local scheduling stay in the dispatcher database.')}</p>
            </div>
            <Badge tone="neutral">{t('{count} workers', { count: workers.length })}</Badge>
          </div>
          <div className="sync-body">
            <p className="field-hint">
              {t(
                'Turning off Supabase only stops future imports. It does not clear Warehouse records already imported. Flexpedia sync updates employee profiles; employment status is managed manually, while shift schedules, absence history, and manually entered hours remain in the local database.',
              )}
            </p>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from './workforce-data-context'
import { useLanguage } from '@/lib/i18n'
import type {
  FlexpediaFixturePreviewResult,
  FlexpediaSyncStatus,
  FlexpediaSyncSummary,
  FlexpediaTestResult,
  WarehouseSyncStatus,
  WarehouseSyncSummary,
} from '@/lib/sync/types'

type SyncResponse = {
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
  const value: unknown = await response.json()
  if (!isRecord(value)) throw new Error('The sync service returned an invalid response.')
  return value as SyncResponse
}

export function SyncView() {
  const { workers } = useWorkforceData()
  const { t, locale } = useLanguage()
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
        }
      })
      .then(result => {
        if (!active) return
        setStatus(result.status)
        setFlexpediaStatus(result.flexpediaStatus)
        setFlexpediaConfigured(result.flexpediaConfigured)
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
        setMessage({
          key: 'Warehouse snapshot reconciled. Source-linked shifts and absences now match Supabase; local-only records remain.',
        })
        return
      }
      if (!isSyncStatus(body)) throw new Error('The sync service returned an invalid status.')
      setStatus(body)
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

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB')
    : t('Never')
  const flexpediaLastSync = flexpediaStatus?.lastSyncAt
    ? new Date(flexpediaStatus.lastSyncAt).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB')
    : t('Never')

  return (
    <AppShell title="Sync sources">
      <div className="content-inner">
        <PageHeading
          eyebrow={t('Data connections')}
          title="Sync sources"
          description={t('Warehouse history stays in PostgreSQL when you switch data sources.')}
        />
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
            <div className="sync-meta">
              <span>{t('Last sync')}</span>
              <strong>{lastSync}</strong>
            </div>
            {status?.lastError && (
              <p role="status" className="field-hint">
                {t('Last sync error:')} {status.lastError}
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
                {t('Set SUPABASE_DATABASE_URL in .env and restart the app to enable sync.')}
              </p>
            )}
            <p className="field-hint">
              {t(
                'Sync is a read-only Supabase snapshot. Imported shifts and absences are reconciled by source ID, including source deletions. Local-only records are not removed. When a source shift is deleted, its shift and attached offer records are deleted too.',
              )}
            </p>
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
                {flexpediaConfigured ? t('Token configured') : t('Not configured')}
              </Badge>
            </div>
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
              <RefreshCw aria-hidden="true" />
              {t('Test Flexpedia connection')}
            </button>
            {!flexpediaConfigured && (
              <p className="field-hint">
                {t('Set FLEXPEDIA_API_TOKEN in .env and restart the app before testing.')}
              </p>
            )}
            <p className="field-hint">
              {t(
                'Flexpedia profile fields are authoritative, including null values. Flexpedia sync never dismisses or reactivates employees. Use the People page to change employment status; shifts, absences, hours, and work history remain. New employees are added without company access until assigned locally.',
              )}
            </p>
            {flexpediaResult && (
              <p role="status" className="field-hint">
                Read {flexpediaResult.employees} employees in {flexpediaResult.pages} pages;{' '}
                {flexpediaResult.matched} matched, {flexpediaResult.unmatched} unmatched,{' '}
                {flexpediaResult.ambiguous} ambiguous. No records were changed.
              </p>
            )}
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
              <Badge tone="neutral">No database writes</Badge>
            </div>
            <p className="field-hint">
              {t(
                'Optional fields may be null in real API responses. The preview replaces the profile from Flexpedia; shifts, course days, and absences stay unchanged.',
              )}
            </p>
            <button
              className="button button-secondary"
              type="button"
              disabled={working || loading}
              onClick={() => submit('preview-flexpedia-fixture')}
            >
              <RefreshCw aria-hidden="true" />
              {t('Preview one-time fixture')}
            </button>
            {fixturePreview && (
              <p role="status" className="field-hint">
                {fixturePreview.existingMatched} existing worker matched; {fixturePreview.existingWouldEnrich}{' '}
                would be updated ({fixturePreview.existingFieldsChanged} profile fields changed);{' '}
                {fixturePreview.newWouldAdd} new demo worker would be added. Preserved:{' '}
                {fixturePreview.assignedShiftsPreserved} shifts, {fixturePreview.courseDaysPreserved} course
                days, {fixturePreview.absencesPreserved} absence periods. Covered{' '}
                {fixturePreview.apiFieldsCovered} schema fields. No records were written.
              </p>
            )}
          </Panel>
        </div>

        <Panel>
          <div className="panel-header">
            <div>
              <h2>{t('Local workforce history')}</h2>
              <p>{t('Synced records and local scheduling remain in the Docker PostgreSQL database.')}</p>
            </div>
            <Badge tone="neutral">{workers.length} workers</Badge>
          </div>
          <p className="field-hint">
            {t(
              'Turning off Supabase only stops future imports. It does not clear Warehouse records already imported. Flexpedia sync updates employee profiles; employment status is managed manually, while shift schedules, absence history, and manually entered hours remain in the local database.',
            )}
          </p>
        </Panel>
      </div>
    </AppShell>
  )
}

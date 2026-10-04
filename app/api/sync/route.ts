import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import {
  getWarehouseSyncStatus,
  recordWarehouseSyncFailure,
  setWarehouseSupabaseEnabled,
  syncWarehouseFromSupabase,
  SyncConfigurationError,
  SyncDisabledError,
  SyncSourceError,
} from '@/lib/sync/supabase-warehouse'
import {
  FlexpediaConfigurationError,
  FlexpediaRequestError,
  previewFlexpediaMergeFixture,
  testFlexpediaConnection,
} from '@/lib/sync/flexpedia-test'
import {
  FlexpediaSyncError,
  getFlexpediaSyncStatus,
  recordFlexpediaSyncFailure,
  syncFlexpediaEmployees,
} from '@/lib/sync/flexpedia-sync'
import { syncIntervalMinutes } from '@/lib/sync/scheduler'
import { refreshTravelDistances } from '@/lib/travel/refresh'

export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  try {
    return NextResponse.json({
      ...await getWarehouseSyncStatus(),
      flexpediaStatus: await getFlexpediaSyncStatus(),
      flexpediaConfigured: Boolean(process.env.FLEXPEDIA_API_TOKEN),
      scheduleMinutes: syncIntervalMinutes(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Could not load sync status.', error)
    return NextResponse.json({ error: 'Could not load sync status.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 1_024) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request must be valid JSON.' }, { status: 400 })
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'A sync action is required.' }, { status: 400 })
  }

  if (body.action === 'enable-supabase' || body.action === 'disable-supabase') {
    try {
      const status = await setWarehouseSupabaseEnabled(body.action === 'enable-supabase')
      return NextResponse.json(status, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      console.error('Could not change Warehouse sync setting.', error)
      return NextResponse.json({ error: 'Could not change the sync setting.' }, { status: 503 })
    }
  }

  if (body.action === 'test-flexpedia') {
    try {
      const result = await testFlexpediaConnection()
      return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      if (error instanceof FlexpediaConfigurationError) {
        return NextResponse.json({ error: error.message }, { status: 424 })
      }
      if (error instanceof FlexpediaRequestError) {
        return NextResponse.json({ error: error.message }, { status: 502 })
      }
      console.error('Flexpedia read-only test failed.', error)
      return NextResponse.json({ error: 'Could not test the Flexpedia connection.' }, { status: 503 })
    }
  }

  if (body.action === 'sync-all') {
    // The header button: every configured, enabled source, then distances.
    const status = await getWarehouseSyncStatus().catch(() => null)
    const failures: string[] = []
    if (status?.enabled && status.configured) {
      try {
        await syncWarehouseFromSupabase()
      } catch (error) {
        const message = error instanceof SyncConfigurationError || error instanceof SyncSourceError
          ? error.message : 'Warehouse synchronization failed.'
        failures.push(message)
        await recordWarehouseSyncFailure(message).catch(cause => console.error('Could not save sync failure.', cause))
        if (!(error instanceof SyncSourceError)) console.error('Warehouse synchronization failed.', error)
      }
    }
    if (process.env.FLEXPEDIA_API_TOKEN) {
      try {
        await syncFlexpediaEmployees()
      } catch (error) {
        const message = error instanceof FlexpediaRequestError || error instanceof FlexpediaSyncError
          ? error.message : 'Flexpedia synchronization failed.'
        failures.push(message)
        await recordFlexpediaSyncFailure(message).catch(cause => console.error('Could not save sync failure.', cause))
        if (!(error instanceof FlexpediaSyncError)) console.error('Flexpedia synchronization failed.', error)
      }
    }
    void refreshTravelDistances().catch(error => console.error('Travel distance refresh failed.', error))
    return NextResponse.json(
      failures.length ? { error: failures.join(' ') } : { ok: true },
      { status: failures.length ? 502 : 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  if (body.action === 'sync-flexpedia') {
    try {
      const summary = await syncFlexpediaEmployees()
      void refreshTravelDistances().catch(error => console.error('Travel distance refresh failed.', error))
      return NextResponse.json({
        flexpediaSummary: summary,
        flexpediaStatus: await getFlexpediaSyncStatus(),
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      if (!(error instanceof FlexpediaConfigurationError)) {
        try {
          await recordFlexpediaSyncFailure(
            error instanceof FlexpediaRequestError || error instanceof FlexpediaSyncError
              ? error.message
              : 'Flexpedia synchronization failed.',
          )
        } catch (recordError) {
          console.error('Could not save Flexpedia sync failure status.', recordError)
        }
      }
      if (error instanceof FlexpediaConfigurationError) {
        return NextResponse.json({ error: error.message }, { status: 424 })
      }
      if (error instanceof FlexpediaRequestError) {
        return NextResponse.json({ error: error.message }, { status: 502 })
      }
      if (error instanceof FlexpediaSyncError) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      console.error('Flexpedia employee synchronization failed.', error)
      return NextResponse.json({
        error: 'Flexpedia employee synchronization failed. No partial changes were saved.',
      }, { status: 503 })
    }
  }

  if (body.action === 'preview-flexpedia-fixture') {
    try {
      return NextResponse.json(await previewFlexpediaMergeFixture(), {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    } catch (error) {
      if (error instanceof FlexpediaConfigurationError) {
        return NextResponse.json({ error: error.message }, { status: 424 })
      }
      console.error('Could not create the isolated Flexpedia merge preview.', error)
      return NextResponse.json({ error: 'Could not create the isolated Flexpedia merge preview.' }, { status: 503 })
    }
  }

  if (body.action === 'sync-supabase') {
    try {
      const summary = await syncWarehouseFromSupabase()
      return NextResponse.json({
        summary,
        status: await getWarehouseSyncStatus(),
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      if (!(error instanceof SyncDisabledError)) {
        try {
          await recordWarehouseSyncFailure(
            error instanceof SyncConfigurationError || error instanceof SyncSourceError
              ? error.message
              : 'Warehouse synchronization failed.',
          )
        } catch (recordError) {
          console.error('Could not save Warehouse sync failure status.', recordError)
        }
      }
      if (error instanceof SyncDisabledError) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      if (error instanceof SyncConfigurationError) {
        return NextResponse.json({ error: error.message }, { status: 424 })
      }
      if (error instanceof SyncSourceError) {
        return NextResponse.json({ error: error.message }, { status: 502 })
      }
      console.error('Warehouse synchronization failed.', error)
      return NextResponse.json({ error: 'Warehouse synchronization failed. No partial changes were saved.' }, { status: 503 })
    }
  }

  return NextResponse.json({ error: 'Unknown sync action.' }, { status: 400 })
}

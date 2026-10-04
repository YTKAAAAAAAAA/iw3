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

  if (body.action === 'sync-flexpedia') {
    try {
      const summary = await syncFlexpediaEmployees()
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

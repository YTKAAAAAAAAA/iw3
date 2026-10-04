import 'server-only'

import { withDb } from '@/lib/db'
import { refreshTravelDistances } from '@/lib/travel/refresh'
import { FlexpediaSyncError, recordFlexpediaSyncFailure, syncFlexpediaEmployees } from './flexpedia-sync'
import { FlexpediaConfigurationError, FlexpediaRequestError } from './flexpedia-test'
import {
  recordWarehouseSyncFailure,
  syncWarehouseFromSupabase,
  SyncConfigurationError,
  SyncDisabledError,
  SyncSourceError,
} from './supabase-warehouse'

const CHECK_EVERY_MS = 5 * 60_000
const FIRST_CHECK_MS = 60_000

/** Minutes between automatic syncs. 60 by default in production; off in
 *  development unless SYNC_INTERVAL_MINUTES is set, so a local `next dev`
 *  does not quietly import into whatever database it points at. */
export function syncIntervalMinutes(): number {
  const configured = process.env.SYNC_INTERVAL_MINUTES
  if (configured === undefined || configured === '') return process.env.NODE_ENV === 'production' ? 60 : 0
  const minutes = Number(configured)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0
}

type Due = { supabase: boolean; flexpedia: boolean }

/* A source is due when it has not been tried within the interval. Manual
   syncs count as tries, and a failing source waits a full interval before
   the next attempt instead of being hammered every few minutes. */
async function dueSources(minutes: number): Promise<Due> {
  return withDb(async db => {
    const { rows } = await db.query<{ supabase_due: boolean; flexpedia_due: boolean }>(
      `
      SELECT
        (SELECT supabase_enabled AND (last_attempt_at IS NULL OR last_attempt_at < now() - make_interval(mins => $1))
          FROM warehouse_sync_control WHERE singleton) AS supabase_due,
        (SELECT last_attempt_at IS NULL OR last_attempt_at < now() - make_interval(mins => $1)
          FROM flexpedia_sync_control WHERE singleton) AS flexpedia_due
    `,
      [minutes],
    )
    return {
      supabase: Boolean(process.env.SUPABASE_DATABASE_URL) && rows[0]?.supabase_due === true,
      flexpedia: Boolean(process.env.FLEXPEDIA_API_TOKEN) && rows[0]?.flexpedia_due === true,
    }
  })
}

const knownMessage = (error: unknown, known: Array<new (...args: never[]) => Error>, fallback: string) =>
  known.some(type => error instanceof type) && error instanceof Error ? error.message : fallback

export async function runScheduledSync(minutes = syncIntervalMinutes()): Promise<void> {
  const due = await dueSources(minutes)
  if (due.supabase) {
    try {
      const summary = await syncWarehouseFromSupabase()
      console.info('Scheduled Warehouse sync finished.', summary)
    } catch (error) {
      if (!(error instanceof SyncDisabledError)) {
        console.error('Scheduled Warehouse sync failed.', error)
        await recordWarehouseSyncFailure(
          knownMessage(error, [SyncConfigurationError, SyncSourceError], 'Warehouse synchronization failed.'),
        ).catch(cause => console.error('Could not save the Warehouse sync failure.', cause))
      }
    }
  }
  if (due.flexpedia) {
    try {
      const summary = await syncFlexpediaEmployees()
      console.info('Scheduled Flexpedia sync finished.', summary)
    } catch (error) {
      console.error('Scheduled Flexpedia sync failed.', error)
      if (!(error instanceof FlexpediaConfigurationError)) {
        await recordFlexpediaSyncFailure(
          knownMessage(
            error,
            [FlexpediaRequestError, FlexpediaSyncError],
            'Flexpedia synchronization failed.',
          ),
        ).catch(cause => console.error('Could not save the Flexpedia sync failure.', cause))
      }
    }
  }
  try {
    const report = await refreshTravelDistances()
    if (report && (report.geocoded || report.recomputed || report.unresolved)) {
      console.info('Travel distances refreshed.', report)
    }
  } catch (error) {
    console.error('Travel distance refresh failed.', error)
  }
}

declare global {
  var __iawSyncScheduler: { running: boolean } | undefined
}

/** Starts the hourly sync once per server process. */
export function startSyncScheduler(): void {
  const minutes = syncIntervalMinutes()
  if (!minutes) {
    console.info('Automatic sync is off (set SYNC_INTERVAL_MINUTES to enable it).')
    return
  }
  if (globalThis.__iawSyncScheduler) return
  const state = { running: false }
  globalThis.__iawSyncScheduler = state
  const tick = async () => {
    if (state.running) return
    state.running = true
    try {
      await runScheduledSync(minutes)
    } catch (error) {
      console.error('Scheduled sync check failed.', error)
    } finally {
      state.running = false
    }
  }
  // unref: the timers must never keep a build or a shutting-down server alive.
  setTimeout(tick, FIRST_CHECK_MS).unref()
  setInterval(tick, CHECK_EVERY_MS).unref()
  console.info(`Automatic sync every ${minutes} minutes.`)
}

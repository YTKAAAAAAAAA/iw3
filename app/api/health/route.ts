import { NextResponse } from 'next/server'
import { withDb } from '@/lib/db'
import { syncIntervalMinutes } from '@/lib/sync/schedule-config'

export const dynamic = 'force-dynamic'

/* For Docker's healthcheck and an external uptime monitor. Public, so it
   reveals only states, never data: whether the database answers, and
   whether automatic sync has succeeded recently ("stale" after three missed
   intervals). The HTTP status reflects the database only — a stale sync is
   worth an alert, not a container restart. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const minutes = syncIntervalMinutes()
    const sync = await withDb(async db => {
      if (!minutes) return 'off'
      const { rows } = await db.query<{ stale: boolean }>(
        `
        SELECT bool_or(last_sync_at IS NULL OR last_sync_at < now() - make_interval(mins => $1 * 3)) AS stale
        FROM (
          SELECT last_sync_at FROM warehouse_sync_control WHERE singleton AND supabase_enabled AND $2
          UNION ALL
          SELECT last_sync_at FROM flexpedia_sync_control WHERE singleton AND $3
        ) sources
      `,
        [minutes, Boolean(process.env.SUPABASE_DATABASE_URL), Boolean(process.env.FLEXPEDIA_API_TOKEN)],
      )
      return rows[0]?.stale ? 'stale' : 'ok'
    })
    return NextResponse.json({ status: 'ok', database: 'ok', sync }, { headers })
  } catch (error) {
    console.error('Health check failed.', error)
    return NextResponse.json({ status: 'error', database: 'unavailable' }, { status: 503, headers })
  }
}

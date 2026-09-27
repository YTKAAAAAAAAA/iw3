import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { todayInAmsterdam } from '@/lib/types'

function validId(id: string): number | null {
  if (!/^[1-9]\d*$/.test(id)) return null
  const value = Number(id)
  return Number.isSafeInteger(value) && value <= 2_147_483_647 ? value : null
}

function validDates(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 90
    && value.every(date => typeof date === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(date)
      && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
      && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date)
    && new Set(value).size === value.length
}

async function readBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const workerId = validId((await params).id)
  if (workerId === null) return NextResponse.json({ error: 'Invalid worker id.' }, { status: 400 })
  const body = await readBody(request)
  if (typeof body !== 'object' || body === null || !('dates' in body) || !validDates(body.dates)
    || !('reason' in body) || typeof body.reason !== 'string' || body.reason.length > 200
    || !('paidLeave' in body) || typeof body.paidLeave !== 'boolean') {
    return NextResponse.json({ error: 'Invalid time-off request.' }, { status: 400 })
  }
  const dates = [...body.dates].sort()
  const today = todayInAmsterdam()
  if (dates[0] < today) return NextResponse.json({ error: 'Past days cannot be changed.' }, { status: 400 })
  const reasonText = body.reason.trim() || 'Day off'
  const reason = `${body.paidLeave ? 'Paid leave' : 'Unpaid leave'}: ${reasonText}`

  const result = await withDb(async db => {
    await db.query('BEGIN')
    try {
      const worker = await db.query<{ id: number }>(
        'SELECT id FROM worker WHERE id = $1 AND is_active = TRUE AND is_fired = FALSE FOR UPDATE',
        [workerId],
      )
      if (!worker.rows[0]) {
        await db.query('ROLLBACK')
        return { status: 404 as const, error: 'Active worker not found.' }
      }
      const occupied = await db.query<{ date: string }>(`
        SELECT DISTINCT d::text AS date
        FROM unnest($2::date[]) AS d
        WHERE EXISTS (SELECT 1 FROM shift sh WHERE sh.worker_id = $1 AND sh.date = d)
           OR EXISTS (SELECT 1 FROM absence a WHERE a.worker_id = $1 AND d BETWEEN a.start_date AND a.end_date)
      `, [workerId, dates])
      if (occupied.rows.length) {
        await db.query('ROLLBACK')
        return { status: 409 as const, error: `Some selected days are no longer free: ${occupied.rows.map(row => row.date).join(', ')}` }
      }
      for (const date of dates) {
        await db.query(`
          INSERT INTO absence (worker_id, start_date, end_date, reason)
          VALUES ($1, $2::date, $2::date, $3)
        `, [workerId, date, reason])
      }
      await db.query('COMMIT')
      return { status: 201 as const }
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ workerId, dates, reason, paidLeave: body.paidLeave }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const workerId = validId((await params).id)
  if (workerId === null) return NextResponse.json({ error: 'Invalid worker id.' }, { status: 400 })
  const body = await readBody(request)
  if (typeof body !== 'object' || body === null || !('dates' in body) || !validDates(body.dates)) {
    return NextResponse.json({ error: 'Choose one or more dates to remove.' }, { status: 400 })
  }
  const dates = [...body.dates].sort()
  if (dates[0] < todayInAmsterdam()) {
    return NextResponse.json({ error: 'Past days cannot be changed.' }, { status: 400 })
  }
  const result = await withDb(async db => {
    await db.query('BEGIN')
    try {
      const worker = await db.query<{ id: number }>(
        'SELECT id FROM worker WHERE id = $1 AND is_active = TRUE AND is_fired = FALSE FOR UPDATE',
        [workerId],
      )
      if (!worker.rows[0]) {
        await db.query('ROLLBACK')
        return { status: 404 as const, error: 'Active worker not found.' }
      }
      await db.query(`
        WITH target AS MATERIALIZED (
          SELECT a.id, a.worker_id, a.start_date, a.end_date, a.reason
          FROM absence a
          WHERE a.worker_id = $1
            AND EXISTS (
              SELECT 1 FROM unnest($2::date[]) d
              WHERE d BETWEEN a.start_date AND a.end_date
            )
        ),
        deleted AS (
          DELETE FROM absence a USING target t WHERE a.id = t.id RETURNING a.id
        ),
        remaining AS (
          SELECT t.*, days.day::date AS day
          FROM target t
          JOIN deleted d USING (id)
          CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') days(day)
          WHERE NOT (days.day::date = ANY($2::date[]))
        ),
        numbered AS (
          SELECT remaining.*,
            day - row_number() OVER (PARTITION BY id ORDER BY day)::integer AS segment
          FROM remaining
        ),
        grouped AS (
          SELECT worker_id, reason, id, segment,
            min(day)::date AS start_date, max(day)::date AS end_date
          FROM numbered
          GROUP BY worker_id, reason, id, segment
        )
        INSERT INTO absence (worker_id, start_date, end_date, reason)
        SELECT worker_id, start_date, end_date, reason FROM grouped
      `, [workerId, dates])
      await db.query('COMMIT')
      return { status: 200 as const }
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ workerId, dates })
}

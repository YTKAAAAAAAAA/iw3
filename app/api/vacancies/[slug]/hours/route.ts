import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { slug } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)
    || !('date' in body) || !validDate(body.date)
    || !('entries' in body) || !Array.isArray(body.entries) || body.entries.length > 500
    || body.entries.some(entry => typeof entry !== 'object' || entry === null || Array.isArray(entry)
      || !('workerId' in entry) || typeof entry.workerId !== 'string' || !/^[1-9]\d*$/.test(entry.workerId)
      || !Number.isSafeInteger(Number(entry.workerId))
      || !('hours' in entry) || (entry.hours !== null
        && (typeof entry.hours !== 'number' || !Number.isFinite(entry.hours) || entry.hours < 0 || entry.hours > 24)))) {
    return NextResponse.json({ error: 'Enter a valid date and hours between 0 and 24 for each worker.' }, { status: 400 })
  }

  const entries = body.entries as Array<{ workerId: string; hours: number | null }>
  if (new Set(entries.map(entry => entry.workerId)).size !== entries.length) {
    return NextResponse.json({ error: 'Each worker can only have one hours entry per day.' }, { status: 400 })
  }
  try {
    const result = await withDb(async db => {
      await db.query('BEGIN')
      try {
        const vacancy = await db.query<{ id: number; track_hours_manually: boolean }>(
          'SELECT id, track_hours_manually FROM vacancy WHERE slug = $1 FOR UPDATE',
          [slug],
        )
        if (!vacancy.rows[0]) {
          await db.query('ROLLBACK')
          return { status: 404 as const, error: 'Vacancy not found.' }
        }
        if (!vacancy.rows[0].track_hours_manually) {
          await db.query('ROLLBACK')
          return { status: 409 as const, error: 'Manual hours are not enabled for this vacancy.' }
        }

        for (const entry of entries) {
          const scheduled = await db.query<{ worker_id: number }>(`
            SELECT worker_id FROM shift
            WHERE vacancy_id = $1 AND date = $2::date AND worker_id = $3
            FOR UPDATE
          `, [vacancy.rows[0].id, body.date, Number(entry.workerId)])
          if (!scheduled.rows.length) {
            await db.query('ROLLBACK')
            return { status: 409 as const, error: 'A worker is no longer assigned to this vacancy on the selected date.' }
          }
          if (entry.hours === null) {
            await db.query(`
              DELETE FROM manual_hours
              WHERE worker_id = $1 AND vacancy_id = $2 AND date = $3::date
            `, [Number(entry.workerId), vacancy.rows[0].id, body.date])
          } else {
            await db.query(`
              INSERT INTO manual_hours (worker_id, vacancy_id, date, hours)
              VALUES ($1, $2, $3::date, $4)
              ON CONFLICT (worker_id, vacancy_id, date)
              DO UPDATE SET hours = EXCLUDED.hours, updated_at = now()
            `, [Number(entry.workerId), vacancy.rows[0].id, body.date, entry.hours])
          }
        }
        await db.query('COMMIT')
        return { status: 200 as const }
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ slug, date: body.date, saved: entries.length })
  } catch (error) {
    console.error('Failed to save manual hours.', error)
    return NextResponse.json({ error: 'Could not save hours. Please try again.' }, { status: 500 })
  }
}

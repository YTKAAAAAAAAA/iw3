import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { WEEKDAYS, type Weekday } from '@/lib/types'

const isWeekday = (value: unknown): value is Weekday =>
  typeof value === 'string' && WEEKDAYS.includes(value as Weekday)

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return NextResponse.json({ error: 'Invalid worker id.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid worker profile update.' }, { status: 400 })
  }

  const update = body as Record<string, unknown>
  if (Object.keys(update).some(key => !['notes', 'hasCar', 'hasVog', 'courseDays'].includes(key))
    || Object.keys(update).length === 0
    || ('notes' in update && (typeof update.notes !== 'string' || update.notes.length > 5000))
    || ('hasCar' in update && update.hasCar !== null && typeof update.hasCar !== 'boolean')
    || ('hasVog' in update && update.hasVog !== null && typeof update.hasVog !== 'boolean')
    || ('courseDays' in update && (!Array.isArray(update.courseDays)
      || update.courseDays.length > WEEKDAYS.length
      || !update.courseDays.every(isWeekday)
      || new Set(update.courseDays).size !== update.courseDays.length))) {
    return NextResponse.json({ error: 'Invalid worker profile update.' }, { status: 400 })
  }

  const workerId = Number(id)
  const updated = await withDb(async db => {
    await db.query('BEGIN')
    try {
      const worker = await db.query<{ id: number }>(
        'SELECT id FROM worker WHERE id = $1 AND is_active = TRUE AND is_fired = FALSE FOR UPDATE',
        [workerId],
      )
      if (!worker.rows[0]) {
        await db.query('ROLLBACK')
        return false
      }

      if ('notes' in update) {
        await db.query('UPDATE worker SET notes = $2 WHERE id = $1', [workerId, update.notes])
      }
      for (const [field, kind, label] of [
        ['hasCar', 'transport', 'Own car'],
        ['hasVog', 'document', 'VOG on file'],
      ] as const) {
        if (!(field in update)) continue
        const value = update[field]
        if (value === null) {
          await db.query(
            'DELETE FROM worker_qualification WHERE worker_id = $1 AND kind = $2 AND label = $3',
            [workerId, kind, label],
          )
        } else {
          await db.query(`
            INSERT INTO worker_qualification (worker_id, kind, label, status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (worker_id, kind, label)
            DO UPDATE SET status = EXCLUDED.status, valid_until = NULL
          `, [workerId, kind, label, value ? 'verified' : 'unverified'])
        }
      }
      if ('courseDays' in update) {
        const courseDays = update.courseDays as Weekday[]
        await db.query('DELETE FROM worker_course_day WHERE worker_id = $1', [workerId])
        for (const weekday of courseDays) {
          await db.query('INSERT INTO worker_course_day (worker_id, weekday) VALUES ($1, $2)', [workerId, weekday])
        }
        await db.query('UPDATE worker SET fixed_course_days = $2 WHERE id = $1', [workerId, courseDays.join(',')])
      }
      await db.query('COMMIT')
      return true
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
  if (!updated) return NextResponse.json({ error: 'Active worker not found.' }, { status: 404 })

  return NextResponse.json({ workerId: id, updated: Object.keys(update) })
}

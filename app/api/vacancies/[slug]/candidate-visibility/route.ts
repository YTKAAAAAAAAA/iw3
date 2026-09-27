import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { slug } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (!isRecord(body) || typeof body.workerId !== 'string' || !/^[1-9]\d*$/.test(body.workerId)
    || !Number.isSafeInteger(Number(body.workerId))
    || !(body.date === null || (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)))
    || !(body.reset === true || typeof body.hidden === 'boolean')) {
    return NextResponse.json({ error: 'Invalid candidate visibility setting.' }, { status: 400 })
  }
  const workerId = Number(body.workerId)
  const date = body.reset === true ? null : body.date
  const hidden = body.reset === true ? false : body.hidden as boolean
  const details = { worker_id: body.workerId, date, hidden, reset: body.reset === true }

  const result = await withDb(async db => {
    const allowed = await db.query<{ vacancy_id: number }>(`
      SELECT v.id AS vacancy_id
      FROM vacancy v JOIN worker w ON w.id = $2
      WHERE v.slug = $1
    `, [slug, workerId])
    if (!allowed.rows[0]) return false
    await db.query(`
      INSERT INTO vacancy_change (vacancy_id, actor_user_id, event_type, details)
      VALUES ($1, $2, 'candidate_visibility', $3::jsonb)
    `, [allowed.rows[0].vacancy_id, session.userId, JSON.stringify(details)])
    return true
  })
  if (!result) return NextResponse.json({ error: 'Vacancy or worker not found.' }, { status: 404 })
  return NextResponse.json({ vacancyId: slug, workerId: body.workerId, date, hidden, reset: body.reset === true })
}

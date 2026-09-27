import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

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
  if (typeof body !== 'object' || body === null || !('companyId' in body)
    || typeof body.companyId !== 'string' || !/^c-[1-9]\d*$/.test(body.companyId)
    || !('accessible' in body) || typeof body.accessible !== 'boolean') {
    return NextResponse.json({ error: 'Invalid company access setting.' }, { status: 400 })
  }
  const workerId = Number(id)
  const companyId = Number(body.companyId.slice(2))
  const exists = await withDb(db => db.query<{ id: number }>(`
    SELECT w.id FROM worker w CROSS JOIN company c
    WHERE w.id = $1 AND c.id = $2
  `, [workerId, companyId]))
  if (!exists.rows[0]) return NextResponse.json({ error: 'Worker or company not found.' }, { status: 404 })

  if (body.accessible) {
    await withDb(db => db.query(`
      INSERT INTO worker_company_access (worker_id, company_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [workerId, companyId]))
  } else {
    await withDb(db => db.query(
      'DELETE FROM worker_company_access WHERE worker_id = $1 AND company_id = $2',
      [workerId, companyId],
    ))
  }
  return NextResponse.json({ workerId: id, companyId: body.companyId, accessible: body.accessible })
}

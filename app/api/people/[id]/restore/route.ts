import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return NextResponse.json({ error: 'Invalid worker id.' }, { status: 400 })
  }

  try {
    const result = await withDb(db => db.query<{ id: number }>(`
      UPDATE worker
      SET is_active = TRUE, is_fired = FALSE, local_status_override = TRUE,
        dismissed_at = NULL
      WHERE id = $1
      RETURNING id
    `, [Number(id)]))
    if (!result.rows[0]) return NextResponse.json({ error: 'Worker not found.' }, { status: 404 })
    return NextResponse.json({ workerId: id, status: 'active' })
  } catch (error) {
    console.error('Failed to restore worker.', error)
    return NextResponse.json({ error: 'Could not restore this person. Please try again.' }, { status: 500 })
  }
}

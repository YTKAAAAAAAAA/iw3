import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request must be valid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || !('current' in body)
    || typeof body.current !== 'string' || !('next' in body) || typeof body.next !== 'string') {
    return NextResponse.json({ error: 'Both passwords are required.' }, { status: 400 })
  }
  if (!body.current || body.next.length < 12 || body.next.length > 1024) {
    return NextResponse.json({ error: 'New password must be between 12 and 1024 characters.' }, { status: 400 })
  }
  const currentPassword = body.current
  const nextPassword = body.next

  try {
    const user = await withDb(async db => {
      const { rows } = await db.query<{ password_hash: string }>(
        'SELECT password_hash FROM app_user WHERE id = $1',
        [session.userId],
      )
      return rows[0]
    })
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return NextResponse.json({ error: 'Current password is wrong.' }, { status: 401 })
    }

    await withDb(async db => {
      await db.query(`
        UPDATE app_user SET password_hash = $1, session_version = session_version + 1
        WHERE id = $2
      `, [await bcrypt.hash(nextPassword, 12), session.userId])
    })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Backend password change failed.', error)
    return NextResponse.json({ error: 'Password service is unavailable.' }, { status: 503 })
  }
}

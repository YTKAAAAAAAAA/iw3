import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json({ authenticated: true, ...session }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

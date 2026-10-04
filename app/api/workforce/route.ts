import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { scopeFromSearchParams } from '@/lib/db/page-data'
import { loadWorkforceData } from '@/lib/db/workforce'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!await getSession()) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const scope = scopeFromSearchParams(new URL(request.url).searchParams)
  if (!scope) return NextResponse.json({ error: 'Invalid data scope.' }, { status: 400 })

  try {
    const data = await loadWorkforceData(scope)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Failed to load workforce data for the frontend.', error)
    return NextResponse.json({ error: 'Could not load workforce data.' }, { status: 500 })
  }
}

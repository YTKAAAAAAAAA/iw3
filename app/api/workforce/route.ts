import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { getWarehouseAppData } from '@/lib/db/workforce'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!await getSession()) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const data = await getWarehouseAppData()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Failed to load workforce data for the frontend.', error)
    return NextResponse.json({ error: 'Could not load workforce data.' }, { status: 500 })
  }
}

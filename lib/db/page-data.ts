import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { WorkforceData } from '@/components/workforce-data-context'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { getWarehouseAppData } from './workforce'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWorkforceData(value: unknown): value is WorkforceData {
  if (!isRecord(value)) return false
  const arrayFields = [
    'workers', 'companies', 'vacancies', 'standing', 'roster', 'leaves', 'hours',
    'sync', 'demand', 'offers', 'manatalCandidates', 'candidateVisibility',
  ]
  return arrayFields.every(field => Array.isArray(value[field]))
}

export async function getPageWorkforceData(): Promise<WorkforceData> {
  const backendUrl = process.env.APP_BACKEND_URL
  if (!backendUrl) return getWarehouseAppData()

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const response = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/workforce`, {
    headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
    cache: 'no-store',
  })
  if (response.status === 401) redirect('/login')
  if (!response.ok) {
    console.error('Workforce data backend returned an error.', { status: response.status })
    throw new Error('The workforce data service is unavailable.')
  }

  const data: unknown = await response.json()
  if (!isWorkforceData(data)) throw new Error('The workforce data backend returned an invalid response.')
  return data
}

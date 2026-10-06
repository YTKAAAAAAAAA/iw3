import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { WorkforceData, WorkforceScope } from '@/components/workforce-data-context'
import { WORKFORCE_PARTS } from '@/lib/workforce-parts'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { loadWorkforceData } from './workforce'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWorkforceData(value: unknown): value is WorkforceData {
  if (!isRecord(value)) return false
  const arrayFields = [
    'workers',
    'companies',
    'vacancies',
    'standing',
    'roster',
    'leaves',
    'hours',
    'sync',
    'demand',
    'offers',
    'candidateVisibility',
    'travel',
    'homeAreas',
  ]
  return (
    arrayFields.every(field => Array.isArray(value[field])) &&
    (value.personalDetails === null || isRecord(value.personalDetails))
  )
}

/** Query string for the backend's /api/workforce, which accepts the same scope. */
export function scopeToSearchParams(scope: WorkforceScope): URLSearchParams {
  const params = new URLSearchParams()
  const include = (scope.include ?? []).filter(part => WORKFORCE_PARTS.includes(part))
  if (include.length) params.set('include', include.join(','))
  if (scope.personalDetailsFor) params.set('person', scope.personalDetailsFor)
  return params
}

export function scopeFromSearchParams(params: URLSearchParams): WorkforceScope | null {
  const include = (params.get('include') ?? '').split(',').filter(Boolean)
  const person = params.get('person')
  if (include.some(part => !(WORKFORCE_PARTS as readonly string[]).includes(part))) return null
  if (person !== null && !/^[1-9]\d{0,9}$/.test(person)) return null
  return { include: include as WorkforceScope['include'], ...(person ? { personalDetailsFor: person } : {}) }
}

export async function getPageWorkforceData(scope: WorkforceScope = {}): Promise<WorkforceData> {
  const backendUrl = process.env.APP_BACKEND_URL
  if (!backendUrl) return loadWorkforceData(scope)

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const query = scopeToSearchParams(scope).toString()
  const response = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/workforce${query ? `?${query}` : ''}`, {
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

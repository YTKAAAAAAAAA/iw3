import 'server-only'

import { withDb } from '@/lib/db'
import {
  summarizeFlexpediaMatches,
  type FlexpediaEmployeeName,
} from './warehouse-mapping'
import {
  parseFlexpediaEmployee,
  UnsupportedFlexpediaEmployeeError,
  type FlexpediaEmployee,
} from './flexpedia-employee'
import {
  localWorkerFixtureProfile,
  previewFlexpediaFixture,
} from './flexpedia-fixture'
import type { FlexpediaFixturePreviewResult, FlexpediaTestResult } from './types'

type FlexpediaPage = {
  data: FlexpediaEmployee[]
  hasNextPage?: boolean
  totalPages?: number
}

export class FlexpediaConfigurationError extends Error {}

export class FlexpediaRequestError extends Error {}

export async function readFlexpediaEmployees(): Promise<FlexpediaEmployee[]> {
  const apiToken = process.env.FLEXPEDIA_API_TOKEN
  if (!apiToken) throw new FlexpediaConfigurationError('FLEXPEDIA_API_TOKEN is not configured.')

  const tokenResponse = await requestJson('https://api.flexpedia.nl/api/v1.1/Auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(apiToken),
  })
  const accessToken = readAccessToken(tokenResponse)
  const employees: FlexpediaEmployee[] = []
  const ids = new Set<number>()
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    if (page > 100) throw new FlexpediaRequestError('Flexpedia employee list exceeds the 10,000-record limit.')
    const url = new URL('https://api.flexpedia.nl/api/v1.1/Employees')
    url.searchParams.set('Page', String(page))
    url.searchParams.set('PageSize', '100')
    const body = await requestJson(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    const result = readPage(body)
    if (result.data.length === 0 && result.hasNextPage) {
      throw new FlexpediaRequestError('Flexpedia returned an empty page while reporting more employees.')
    }
    for (const employee of result.data) {
      if (ids.has(employee.id)) throw new FlexpediaRequestError('Flexpedia returned a duplicate employee ID.')
      ids.add(employee.id)
    }
    employees.push(...result.data)
    hasNextPage = result.hasNextPage
      ?? (result.totalPages !== undefined
        ? page < result.totalPages
        : result.data.length === 100)
    page++
  }
  return employees
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function field(record: Record<string, unknown>, ...names: string[]): unknown {
  const key = Object.keys(record).find(existing => names.some(name => existing.toLowerCase() === name.toLowerCase()))
  return key ? record[key] : undefined
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new FlexpediaRequestError('Flexpedia returned an invalid response.')
  }
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  } catch (error) {
    console.error('Flexpedia API request failed.', error)
    throw new FlexpediaRequestError('Could not reach the Flexpedia API.')
  }
  const body = await readJson(response)
  if (!response.ok) {
    throw new FlexpediaRequestError(`Flexpedia API returned HTTP ${response.status}.`)
  }
  return body
}

function readAccessToken(body: unknown): string {
  const outer = asRecord(body)
  const data = outer && asRecord(field(outer, 'data'))
  if (!data) throw new FlexpediaRequestError('Flexpedia did not return an access token.')
  const token = field(data, 'accessToken', 'access_token', 'token')
  if (typeof token !== 'string' || !token.trim()) {
    throw new FlexpediaRequestError('Flexpedia did not return an access token.')
  }
  return token
}

function readPage(body: unknown): FlexpediaPage {
  const outer = asRecord(body)
  if (!outer) throw new FlexpediaRequestError('Flexpedia returned an invalid employee page.')
  const dataValue = field(outer, 'data')
  if (dataValue !== null && !Array.isArray(dataValue)) {
    throw new FlexpediaRequestError('Flexpedia returned an invalid employee list.')
  }
  const data = (dataValue ?? []) as unknown[]
  let employees: FlexpediaEmployee[]
  try {
    employees = data.map(parseFlexpediaEmployee)
  } catch (error) {
    if (error instanceof UnsupportedFlexpediaEmployeeError) {
      throw new FlexpediaRequestError('Flexpedia returned an employee with an unsupported shape.')
    }
    throw error
  }
  const metadataValue = field(outer, 'metaData', 'metadata')
  const metadata = metadataValue === null ? null : asRecord(metadataValue)
  if (metadataValue !== undefined && metadataValue !== null && !metadata) {
    throw new FlexpediaRequestError('Flexpedia returned invalid pagination metadata.')
  }
  const hasNextPage = metadata ? field(metadata, 'hasNextPage') : undefined
  const currentPage = metadata ? field(metadata, 'currentPage') : undefined
  const totalPages = metadata ? field(metadata, 'totalPages') : undefined
  if ((hasNextPage !== undefined && typeof hasNextPage !== 'boolean')
    || (currentPage !== undefined && (typeof currentPage !== 'number' || !Number.isSafeInteger(currentPage)))
    || (totalPages !== undefined && (typeof totalPages !== 'number' || !Number.isSafeInteger(totalPages)))) {
    throw new FlexpediaRequestError('Flexpedia returned invalid pagination metadata.')
  }
  return {
    data: employees,
    ...(typeof hasNextPage === 'boolean' ? { hasNextPage } : {}),
    ...(typeof totalPages === 'number' ? { totalPages } : {}),
  }
}

export async function previewFlexpediaMergeFixture(): Promise<FlexpediaFixturePreviewResult> {
  const result = await withDb(async db => db.query<{
    id: number
    full_name: string
    flexpedia_id: number | null
    assigned_shifts: number
    course_days: string[]
    absences: number
  }>(`
    SELECT w.id, w.full_name, w.flexpedia_id,
      (SELECT count(*)::int FROM shift sh
        WHERE sh.worker_id = w.id AND sh.confirmation_status IS DISTINCT FROM 'cancelled') AS assigned_shifts,
      COALESCE((SELECT array_agg(wcd.weekday ORDER BY wcd.weekday)
        FROM worker_course_day wcd WHERE wcd.worker_id = w.id), ARRAY[]::text[]) AS course_days,
      (SELECT count(*)::int FROM absence a WHERE a.worker_id = w.id) AS absences
    FROM worker w
    WHERE w.flexpedia_id IS NULL
      AND position(' ' in btrim(w.full_name)) > 0
      AND (SELECT count(*) FROM worker other
        WHERE lower(regexp_replace(btrim(other.full_name), '\\s+', ' ', 'g'))
          = lower(regexp_replace(btrim(w.full_name), '\\s+', ' ', 'g'))) = 1
    ORDER BY w.id
  `))
  const existing = result.rows[0]
  if (!existing) {
    throw new FlexpediaConfigurationError(
      'A uniquely named local worker without a Flexpedia link is required for the isolated merge preview.',
    )
  }
  const linkedIds = await withDb(async db => db.query<{ id: number }>(
    'SELECT flexpedia_id AS id FROM worker WHERE flexpedia_id IS NOT NULL',
  ))
  return previewFlexpediaFixture({
    id: String(existing.id),
    fullName: existing.full_name,
    profile: localWorkerFixtureProfile(existing.full_name, existing.flexpedia_id),
    assignedShifts: existing.assigned_shifts,
    courseDays: existing.course_days ?? [],
    absences: existing.absences,
  }, linkedIds.rows.map(row => row.id))
}

export async function testFlexpediaConnection(): Promise<FlexpediaTestResult> {
  const apiToken = process.env.FLEXPEDIA_API_TOKEN
  if (!apiToken) throw new FlexpediaConfigurationError('FLEXPEDIA_API_TOKEN is not configured.')

  const tokenResponse = await requestJson('https://api.flexpedia.nl/api/v1.1/Auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(apiToken),
  })
  const accessToken = readAccessToken(tokenResponse)
  const employees: FlexpediaEmployeeName[] = []
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    if (page > 100) throw new FlexpediaRequestError('Flexpedia employee list exceeds the 10,000-record test limit.')
    const url = new URL('https://api.flexpedia.nl/api/v1.1/Employees')
    url.searchParams.set('Page', String(page))
    url.searchParams.set('PageSize', '100')
    const body = await requestJson(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    const result = readPage(body)
    if (result.data.length === 0 && result.hasNextPage) {
      throw new FlexpediaRequestError('Flexpedia returned an empty page while reporting more employees.')
    }
    employees.push(...result.data)
    hasNextPage = result.hasNextPage
      ?? (result.totalPages !== undefined
        ? page < result.totalPages
        : result.data.length === 100)
    page++
  }

  const workers = await withDb(async db => {
    const result = await db.query<{ full_name: string; flexpedia_id: number | null }>(
      'SELECT full_name, flexpedia_id FROM worker',
    )
    return result.rows.map(worker => ({ fullName: worker.full_name, flexpediaId: worker.flexpedia_id }))
  })
  return {
    employees: employees.length,
    pages: page - 1,
    ...summarizeFlexpediaMatches(employees, workers),
    writesPerformed: false,
  }
}

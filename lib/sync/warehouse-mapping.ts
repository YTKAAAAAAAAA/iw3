import { WEEKDAYS, type Weekday } from '../types.ts'

export function normalizeWorkerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

export type WarehouseWorkerMatch = {
  id: number
  fullName: string
  supabaseWorkerId: string | null
  manuallyCreated: boolean
}

export type WarehouseWorkerMatchResult =
  | { kind: 'matched'; workerId: number }
  | { kind: 'new' }
  | { kind: 'ambiguous' }
  | { kind: 'manual-conflict' }

export function resolveWarehouseWorkerMatch(
  sourceId: number,
  fullName: string,
  workers: WarehouseWorkerMatch[],
): WarehouseWorkerMatchResult {
  const linked = workers.find(worker => worker.supabaseWorkerId === String(sourceId))
  if (linked) return { kind: 'matched', workerId: linked.id }

  const key = normalizeWorkerName(fullName)
  const matches = workers.filter(worker => normalizeWorkerName(worker.fullName) === key)
  if (matches.length > 1) return { kind: 'ambiguous' }
  if (!matches.length) return { kind: 'new' }
  if (matches[0].manuallyCreated) return { kind: 'manual-conflict' }
  return { kind: 'matched', workerId: matches[0].id }
}

export function warehouseSiteSlug(value: string | null): string | null {
  if (value === null || value.trim() === '') return null
  const normalized = value.trim().toLocaleLowerCase('en')
  if (normalized === 'slego') return 'slego'
  if (normalized === 'conakry') return 'conakry'
  throw new Error(`Unknown Warehouse site: ${value}.`)
}

export function parseCourseDays(value: string | null): Weekday[] {
  if (!value?.trim()) return []
  const days: Weekday[] = []
  for (const part of value.split(/[;,]/)) {
    const prefix = part.trim().slice(0, 3).toLocaleLowerCase('en')
    const day = WEEKDAYS.find(candidate => candidate === prefix)
    if (!day) throw new Error('Unsupported recurring course day.')
    if (!days.includes(day)) days.push(day)
  }
  return days
}

export type FlexpediaEmployeeName = {
  id: number
  firstname: string
  insertion: string | null
  lastname: string
}

export type FlexpediaMatchSummary = {
  matched: number
  unmatched: number
  ambiguous: number
}

export function summarizeFlexpediaMatches(
  employees: FlexpediaEmployeeName[],
  workers: Array<{ fullName: string; flexpediaId: number | null }>,
): FlexpediaMatchSummary {
  const workerIds = new Map(workers.flatMap(worker =>
    worker.flexpediaId === null ? [] : [[worker.flexpediaId, worker.fullName] as const],
  ))
  const workersByName = new Map<string, number>()
  for (const worker of workers) {
    const key = normalizeWorkerName(worker.fullName)
    workersByName.set(key, (workersByName.get(key) ?? 0) + 1)
  }
  const summary: FlexpediaMatchSummary = { matched: 0, unmatched: 0, ambiguous: 0 }
  for (const employee of employees) {
    if (workerIds.has(employee.id)) {
      summary.matched++
      continue
    }
    const fullName = [employee.firstname, employee.insertion, employee.lastname]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ')
    const matches = workersByName.get(normalizeWorkerName(fullName)) ?? 0
    if (matches === 1) summary.matched++
    else if (matches > 1) summary.ambiguous++
    else summary.unmatched++
  }
  return summary
}

import { WEEKDAYS, type Offer, type Weekday } from './types.ts'

type JsonRecord = Record<string, unknown>

export type ScheduleDemandInput = {
  id: string
  vacancyId: string
  date: string
  placeId: string | null
  section: string | null
  headcount: number
  start: string | null
  end: string | null
  note: string | null
}

export type ScheduleRosterInput = {
  id: string
  vacancyId: string
  date: string
  placeId: string
  section: string | null
  workerId: string | null
  extra: boolean
  extraReason: string | null
  standingId: string | null
  start: string | null
  end: string | null
  note: string | null
}

export type ScheduleStandingInput = {
  id: string
  vacancyId: string
  workerId: string
  placeId: string | null
  section: string | null
  weekdays: Weekday[]
  start: string | null
  end: string | null
  from: string
  to: string | null
  note: string | null
}

export type ScheduleSaveInput = {
  revision: number
  demand: ScheduleDemandInput[]
  roster: ScheduleRosterInput[]
  deleteDemandIds: string[]
  deleteRosterIds: string[]
  standing: ScheduleStandingInput[]
  offers: Offer[]
}

const record = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const validTime = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

const nullableText = (value: unknown, max: number): value is string | null =>
  value === null || (typeof value === 'string' && value.length <= max)

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120

const isDbId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value) && Number.isSafeInteger(Number(value))

const validPersonId = (value: unknown): value is string => isDbId(value)

function parseDemand(value: unknown, vacancyId: string): ScheduleDemandInput | null {
  if (!record(value) || !isId(value.id) || value.vacancyId !== vacancyId || !validDate(value.date)
    || !(value.placeId === null || (typeof value.placeId === 'string' && value.placeId.length <= 160))
    || !nullableText(value.section, 160)
    || !Number.isSafeInteger(value.headcount) || (value.headcount as number) < 0 || (value.headcount as number) > 1000
    || !(value.start === null || validTime(value.start)) || !(value.end === null || validTime(value.end))
    || !nullableText(value.note, 2000)) return null
  return value as unknown as ScheduleDemandInput
}

function parseRoster(value: unknown, vacancyId: string): ScheduleRosterInput | null {
  if (!record(value) || !isId(value.id) || value.vacancyId !== vacancyId || !validDate(value.date)
    || typeof value.placeId !== 'string' || value.placeId.length < 1 || value.placeId.length > 160
    || !nullableText(value.section, 160)
    || !(value.workerId === null || validPersonId(value.workerId))
    || typeof value.extra !== 'boolean' || !nullableText(value.extraReason, 1000)
    || !(value.standingId === null || isId(value.standingId))
    || !(value.start === null || validTime(value.start)) || !(value.end === null || validTime(value.end))
    || !nullableText(value.note, 2000)) return null
  return value as unknown as ScheduleRosterInput
}

function parseStanding(value: unknown, vacancyId: string): ScheduleStandingInput | null {
  if (!record(value) || !isId(value.id) || value.vacancyId !== vacancyId
    || !validPersonId(value.workerId)
    || !(value.placeId === null || (typeof value.placeId === 'string' && value.placeId.length <= 160))
    || !nullableText(value.section, 160)
    || !Array.isArray(value.weekdays) || value.weekdays.length === 0
    || value.weekdays.some(day => !WEEKDAYS.includes(day as Weekday))
    || new Set(value.weekdays).size !== value.weekdays.length
    || !(value.start === null || validTime(value.start)) || !(value.end === null || validTime(value.end))
    || !validDate(value.from) || !(value.to === null || validDate(value.to))
    || (value.to !== null && value.to < value.from)
    || !nullableText(value.note, 2000)) return null
  return value as unknown as ScheduleStandingInput
}

function parseOffer(value: unknown, vacancyId: string): Offer | null {
  if (!record(value) || !isId(value.id) || value.vacancyId !== vacancyId
    || !validPersonId(value.workerId) || !(value.date === null || validDate(value.date))
    || !['offered', 'declined'].includes(String(value.status))
    || !nullableText(value.note, 2000)
    || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))) return null
  return value as unknown as Offer
}

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map(item => item.id)).size === items.length
}

function deletions(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 5000 && value.every(isDbId)
    && new Set(value).size === value.length
}

export function parseScheduleSave(value: unknown, vacancyId: string): ScheduleSaveInput | null {
  if (!record(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0
    || !Array.isArray(value.demand) || value.demand.length > 5000
    || !Array.isArray(value.roster) || value.roster.length > 5000
    || !Array.isArray(value.standing) || value.standing.length > 1000
    || !Array.isArray(value.offers) || value.offers.length > 5000
    || !deletions(value.deleteDemandIds) || !deletions(value.deleteRosterIds)) return null

  const demand = value.demand.map(item => parseDemand(item, vacancyId))
  const roster = value.roster.map(item => parseRoster(item, vacancyId))
  const standing = value.standing.map(item => parseStanding(item, vacancyId))
  const offers = value.offers.map(item => parseOffer(item, vacancyId))
  if (demand.some(item => item === null) || roster.some(item => item === null)
    || standing.some(item => item === null) || offers.some(item => item === null)
    || !uniqueIds(demand as ScheduleDemandInput[]) || !uniqueIds(roster as ScheduleRosterInput[])
    || !uniqueIds(standing as ScheduleStandingInput[]) || !uniqueIds(offers as Offer[])) return null

  const demandIds = new Set((demand as ScheduleDemandInput[]).map(item => item.id))
  const rosterIds = new Set((roster as ScheduleRosterInput[]).map(item => item.id))
  const standingIds = new Set((standing as ScheduleStandingInput[]).map(item => item.id))
  const offerKeys = (offers as Offer[]).map(item => `${item.workerId}\u0000${item.date ?? '*'}`)
  if (value.deleteDemandIds.some(id => demandIds.has(id))
    || value.deleteRosterIds.some(id => rosterIds.has(id))
    || (roster as ScheduleRosterInput[]).some(row => row.standingId !== null && !standingIds.has(row.standingId))
    || new Set(offerKeys).size !== offerKeys.length) return null

  return {
    revision: value.revision as number,
    demand: demand as ScheduleDemandInput[],
    roster: roster as ScheduleRosterInput[],
    deleteDemandIds: value.deleteDemandIds,
    deleteRosterIds: value.deleteRosterIds,
    standing: standing as ScheduleStandingInput[],
    offers: offers as Offer[],
  }
}

import { effectiveEnd, shiftsOverlap } from './derive'
import { minutesOf, type Demand, type PrototypeAttendance, type PrototypeConfirmation, type RosterEntry, type Vacancy } from './types'

export type SlotSummary = {
  ordered: number
  assigned: number
  confirmed: number
  present: number
  open: number
  peak: number
}

export function confirmationFor(confirmations: PrototypeConfirmation[], shiftId: string) {
  return confirmations.find(c => c.shiftId === shiftId) ?? null
}

export function attendanceFor(attendance: PrototypeAttendance[], shiftId: string) {
  return attendance.find(a => a.shiftId === shiftId) ?? null
}

export function slotSummary(row: Demand, shifts: RosterEntry[], confirmations: PrototypeConfirmation[], attendance: PrototypeAttendance[]): SlotSummary {
  const inSlot = shifts.filter(s => s.date === row.date && s.placeId === row.placeId && (s.section ?? '') === (row.section ?? ''))
  const assigned = inSlot.filter(s => s.workerId && s.outcome !== 'cancelled')
  const confirmed = assigned.filter(s => ['accepted'].includes(confirmationFor(confirmations, s.id)?.state ?? 'not_contacted'))
  const present = assigned.filter(s => {
    const state = attendanceFor(attendance, s.id)?.state
    return state === 'present' || state === 'late' || state === 'worked'
  })
  return {
    ordered: row.headcount,
    assigned: assigned.length,
    confirmed: confirmed.length,
    present: present.length,
    open: Math.max(0, row.headcount - present.length),
    peak: assigned.length,
  }
}

export function coverageSegments(row: Demand, shifts: RosterEntry[]) {
  const start = minutesOf(row.start)
  const end = minutesOf(row.end)
  if (start === null || end === null) return []
  const edges = [...new Set([start, end, ...shifts.flatMap(s => [minutesOf(s.start), minutesOf(effectiveEnd(s))]).filter((x): x is number => x !== null)])]
    .filter(x => x >= start && x <= end).sort((a, b) => a - b)
  return edges.slice(0, -1).map((from, i) => {
    const to = edges[i + 1]
    const present = shifts.filter(s => {
      const a = minutesOf(s.start), b = minutesOf(effectiveEnd(s))
      return a !== null && b !== null && a <= from && b >= to && s.outcome !== 'cancelled' && s.outcome !== 'no_show'
    }).length
    return { from, to, present, required: row.headcount, gap: Math.max(0, row.headcount - present) }
  })
}

export function clockLabel(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export function durationHours(start: string | null, end: string | null, breakMinutes = 0) {
  const a = minutesOf(start), b = minutesOf(end)
  if (a === null || b === null) return null
  const span = b >= a ? b - a : b + 1440 - a
  return Math.max(0, Math.round((span - breakMinutes) / 6) / 10)
}

export function restWarning(previous: RosterEntry | null, next: RosterEntry | null, minimumHours = 11) {
  if (!previous || !next || previous.date > next.date) return null
  const prevStart = minutesOf(previous.start), prevEnd = minutesOf(effectiveEnd(previous)), nextStart = minutesOf(next.start)
  if (prevEnd === null || nextStart === null) return null
  const crosses = prevEnd < (prevStart ?? prevEnd)
  const available = (crosses ? prevEnd + 1440 : prevEnd) - nextStart + (next.date === previous.date ? 0 : 1440)
  const hours = available / 60
  return hours < minimumHours ? `Only ${Math.max(0, Math.round(hours * 10) / 10)}h rest before the next shift` : null
}

export function overlapWarnings(candidate: RosterEntry, plan: RosterEntry[]) {
  return plan.filter(s => shiftsOverlap(s, candidate)).map(s => s.id)
}

export const isManualHoursVacancy = (vacancy: Vacancy) => vacancy.trackHoursManually

export const attendanceNeedsHours = (attendance: PrototypeAttendance | null) =>
  attendance?.state !== 'no_show'

export const hoursReminderState = (vacancy: Vacancy, date: string, endReached: boolean, workerIds: string[], saved: Set<string>) => {
  if (!isManualHoursVacancy(vacancy)) return { visible: false, due: false, remaining: 0 }
  const remaining = workerIds.filter(id => !saved.has(`${vacancy.id}:${date}:${id}`)).length
  return { visible: remaining > 0, due: vacancy.schedule.end.kind === 'fixed' ? endReached && remaining > 0 : remaining > 0, remaining }
}

export type Fit = 'eligible' | 'warning' | 'blocked'
export function candidateFit(reasons: { hard: string[]; soft: string[] }): { fit: Fit; reasons: string[] } {
  if (reasons.hard.length) return { fit: 'blocked', reasons: reasons.hard }
  if (reasons.soft.length) return { fit: 'warning', reasons: reasons.soft }
  return { fit: 'eligible', reasons: [] }
}

import type { AssignmentInfo, DayState, Demand, ISODate, Leave, RosterEntry, StandingAssignment, Vacancy, Worker } from './types.ts'

export function vacancyStatus(vacancy:Vacancy, standing:StandingAssignment[], roster:RosterEntry[], today:ISODate): 'open'|'in_progress'|'archived' {
  if (vacancy.archivedAt || vacancy.endDate && vacancy.endDate < today) return 'archived'
  /* Staffed means somebody is actually on it: either a shift from today
     onwards, or a standing arrangement that has not ended. */
  const staffed = roster.some(r => r.vacancyId === vacancy.id && r.date >= today && !!r.workerId)
    || standing.some(a => a.vacancyId === vacancy.id && (!a.to || a.to >= today))
  return staffed ? 'in_progress' : 'open'
}
/* ------------------------------------------------------------------
   How badly an open vacancy needs somebody.

   'open' already means nobody is on it — no shift, no standing arrangement.
   What that status does not say is whether it matters yet: a job starting in
   three weeks with nobody on it is normal, the same job starting tomorrow is
   a phone call, and one that started on Monday is a client already waiting.
   ------------------------------------------------------------------ */
export type Urgency = 'late' | 'soon' | 'none'

/** Days from `today` to the vacancy's start — negative once it has begun. */
export const daysUntil = (date: ISODate, today: ISODate) =>
  Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000)

/** Three days is the window the office actually works in: it is long enough to
 *  ring round the pool and short enough that nothing else has to be dropped. */
export const URGENT_DAYS = 3

export function vacancyUrgency(
  vacancy: Vacancy,
  standing: StandingAssignment[],
  roster: RosterEntry[],
  today: ISODate,
  demand: Demand[] = [],
): Urgency {
  if (vacancy.archivedAt || vacancy.endDate && vacancy.endDate < today
    || !hasUnstaffedSlot(vacancy.id, standing, roster, demand, today)) return 'none'
  const days = daysUntil(vacancy.startDate, today)
  if (days < 0) return 'late'
  return days <= URGENT_DAYS ? 'soon' : 'none'
}

function hasUnstaffedSlot(
  vacancyId: string,
  standing: StandingAssignment[],
  roster: RosterEntry[],
  demand: Demand[],
  today: ISODate,
): boolean {
  const activeShifts = roster.filter(shift => shift.vacancyId === vacancyId
    && shift.date >= today && shift.outcome !== 'cancelled')
  if (activeShifts.some(shift => shift.workerId === null)) return true
  return demand.some(slot => {
    if (slot.vacancyId !== vacancyId || slot.date < today || slot.headcount <= 0) return false
    const assigned = activeShifts.filter(shift =>
      shift.date === slot.date
      && (slot.placeId === null || shift.placeId === slot.placeId)
      && (slot.section === null || shift.section === slot.section)
      && shift.workerId !== null,
    ).length
    const weekday = weekdayOfDate(slot.date)
    const standingWorkers = standing.filter(assignment =>
      assignment.vacancyId === vacancyId
      && assignment.weekdays.includes(weekday)
      && assignment.from <= slot.date
      && (assignment.to === null || assignment.to >= slot.date)
      && (slot.placeId === null || assignment.placeId === slot.placeId)
      && (slot.section === null || assignment.section === slot.section),
    ).length
    return Math.max(assigned, standingWorkers) < slot.headcount
  })
}

/** Open vacancies, worst first: already running and empty, then starting
 *  within days, then the rest — and inside each group the nearest date first,
 *  which for the late ones means the one that has been waiting longest. */
export function sortByUrgency(
  vacancies: Vacancy[],
  standing: StandingAssignment[],
  roster: RosterEntry[],
  today: ISODate,
  demand: Demand[] = [],
): Vacancy[] {
  const rank: Record<Urgency, number> = { late: 0, soon: 1, none: 2 }
  return [...vacancies].sort((a, b) =>
    rank[vacancyUrgency(a, standing, roster, today, demand)] - rank[vacancyUrgency(b, standing, roster, today, demand)]
    || a.startDate.localeCompare(b.startDate)
    || a.title.localeCompare(b.title))
}

/** What the row should say about itself. Null when there is nothing to say. */
export function urgencyNote(vacancy: Vacancy, urgency: Urgency, today: ISODate): string | null {
  if (urgency === 'none') return null
  const days = daysUntil(vacancy.startDate, today)
  if (urgency === 'late') return days === -1 ? 'Started yesterday — nobody on it' : `Started ${-days} days ago — nobody on it`
  return days === 0 ? 'Starts today — nobody on it' : days === 1 ? 'Starts tomorrow — nobody on it' : `Starts in ${days} days — nobody on it`
}

/* ------------------------------------------------------------------
   Is this person available, and if not, from when?
   ------------------------------------------------------------------ */

/** One person, one shift per vacancy per day.
 *
 *  Overlapping times are a separate check and catch most of it, but not all:
 *  a replacement written across a range, or a standing arrangement filled
 *  twice, can land somebody on the same job twice in one day. On the client's
 *  sheet that reads as two people, so it is forbidden outright — being at two
 *  DIFFERENT jobs in one day stays allowed, that is a normal split shift. */
export const alreadyOnVacancy = (roster: RosterEntry[], vacancyId: string, date: ISODate, workerId: string) =>
  roster.some(r => r.vacancyId === vacancyId && r.date === date && r.workerId === workerId && r.outcome !== 'cancelled')

/** A course day is a standing weekly commitment, not a day off: it repeats
 *  without anybody entering it again, and the person is simply not offered. */
export const isCourseDay = (worker: Worker, date: ISODate) => worker.courseDays.includes(weekdayOfDate(date))

export type DayBlock = 'free' | 'leave' | 'course' | 'busy' | 'duplicate'

/** Why this person cannot take this day — or 'free' if they can. */
export function blockOn(worker: Worker, date: ISODate, vacancyId: string, roster: RosterEntry[], leaveDays: Leave[]): DayBlock {
  if (leaveDays.some(l => l.workerId === worker.id && l.date === date)) return 'leave'
  if (isCourseDay(worker, date)) return 'course'
  if (alreadyOnVacancy(roster, vacancyId, date, worker.id)) return 'duplicate'
  return assignmentOn(worker.id, date, null, roster) ? 'busy' : 'free'
}

export type Availability = {
  days: ISODate[]
  free: ISODate[]
  taken: ISODate[]
  /** The first day from which every remaining day is free. Null when they are
   *  never free in the window — the answer the office actually wants is not
   *  "busy" but "from when". */
  freeFrom: ISODate | null
  fullyFree: boolean
  /** Which kind of block, counted, so the row can say what is in the way. */
  reasons: Record<Exclude<DayBlock, 'free'>, number>
}

/** How a person sits against a run of days — the whole vacancy, or the days a
 *  standing arrangement would actually use. */
export function availabilityOver(worker: Worker, days: ISODate[], vacancyId: string, roster: RosterEntry[], leaveDays: Leave[]): Availability {
  const blocks = days.map(date => ({ date, block: blockOn(worker, date, vacancyId, roster, leaveDays) }))
  const free = blocks.filter(b => b.block === 'free').map(b => b.date)
  const taken = blocks.filter(b => b.block !== 'free').map(b => b.date)
  /* Walk back from the end: the answer is the earliest day after which
     nothing is in the way. */
  let freeFrom: ISODate | null = null
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].block !== 'free') break
    freeFrom = blocks[i].date
  }
  const reasons = { leave: 0, course: 0, busy: 0, duplicate: 0 }
  for (const b of blocks) if (b.block !== 'free') reasons[b.block]++
  return { days, free, taken, freeFrom, fullyFree: taken.length === 0, reasons }
}

/** The same thing in a sentence, because a list of dates is not an answer. */
export function availabilityLabel(a: Availability): string {
  if (!a.days.length) return 'No working days in this period'
  if (a.fullyFree) return `Free all ${a.days.length} ${a.days.length === 1 ? 'day' : 'days'}`
  if (!a.free.length) return 'Busy every day of this period'
  const parts: string[] = []
  if (a.reasons.duplicate) parts.push(`${a.reasons.duplicate} already on this job`)
  if (a.reasons.busy) parts.push(`${a.reasons.busy} on other work`)
  if (a.reasons.leave) parts.push(`${a.reasons.leave} on leave`)
  if (a.reasons.course) parts.push(`${a.reasons.course} at a course`)
  const taken = `${a.taken.length} of ${a.days.length} taken (${parts.join(', ')})`
  return a.freeFrom ? `Free from ${formatDate(a.freeFrom)} · ${taken}` : `Never free for a whole run · ${taken}`
}

export function assignmentOn(workerId:string, date:ISODate, _unused:unknown, roster:RosterEntry[], _vacancies?:unknown): AssignmentInfo|null {
  /* One place to ask "what is this person doing that day", and it reads
     shifts — the only record of work there is now. */
  const r = roster.find(x => x.workerId === workerId && x.date === date && x.outcome !== 'cancelled')
  return r ? { vacancyId:r.vacancyId, placeId:r.placeId, section:r.section, assignmentId:r.id } : null
}
export function dayStatus(workerId:string, date:ISODate, roster:RosterEntry[], leaves:Leave[], vacancies:Vacancy[]=[]): DayState { if(leaves.some(l=>l.workerId===workerId && l.date===date)) return 'leave'; return assignmentOn(workerId,date,null,roster,vacancies) ? 'working' : 'free' }
/* roadDistance used to guess with a hypotenuse. It is gone: distance now
   comes from lib/travel.ts, which answers from real routed kilometres. Two
   ways of measuring the same thing is how the map and the assign dialog end
   up disagreeing in front of a client. */
export function currentAssignment(workerId:string, date:ISODate, roster:RosterEntry[], vacancies:Vacancy[]) { const info=assignmentOn(workerId,date,null,roster,vacancies); return info ? vacancies.find(v=>v.id===info.vacancyId) ?? null : null }
export function availableWorkers(workers:Worker[], date:ISODate, roster:RosterEntry[], leaves:Leave[], vacancies:Vacancy[]) { return workers.filter(w=>w.status==='active' && dayStatus(w.id,date,roster,leaves,vacancies)==='free') }

/* ------------------------------------------------------------------
   Coverage: what the client asked for vs what is actually staffed.
   ------------------------------------------------------------------ */
import type { ShiftOutcome } from './types.ts'
import { minutesOf } from './types.ts'
import { formatDate, weekdayOf as weekdayOfDate } from './types.ts'

/** A shift stops counting as coverage once it is cancelled or nobody came. */
const COUNTS_AS_COVER: ShiftOutcome[] = ['planned', 'confirmed', 'worked', 'left_early']
export const covers = (shift: RosterEntry) => !!shift.workerId && COUNTS_AS_COVER.includes(shift.outcome)

/** The time a shift really ended — someone who went home ill at ten covered
 *  the morning, not the day. */
export const effectiveEnd = (shift: RosterEntry) => shift.actualEnd ?? shift.end

/** Two shifts clash when they are the same person on the same day and their
 *  times touch. Same-day is no longer a conflict by itself: splitting a slot
 *  between a morning and an afternoon person is normal, and so is one person
 *  doing two separate stretches. */
export function shiftsOverlap(a: RosterEntry, b: RosterEntry): boolean {
  if (a.id === b.id || a.date !== b.date || !a.workerId || a.workerId !== b.workerId) return false
  const aStart = minutesOf(a.start), aEnd = minutesOf(effectiveEnd(a))
  const bStart = minutesOf(b.start), bEnd = minutesOf(effectiveEnd(b))
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return true
  return aStart < bEnd && bStart < aEnd
}

export const workerShiftsOn = (workerId: string, date: ISODate, roster: RosterEntry[]) =>
  roster.filter(r => r.workerId === workerId && r.date === date && covers(r))
    .sort((a, b) => (minutesOf(a.start) ?? 0) - (minutesOf(b.start) ?? 0))

/** Requested headcount against staffed headcount for one slot, plus the times
 *  inside the requested window that nobody is covering. A slot can be fully
 *  staffed on paper and still have a hole in the middle of it — that hole is
 *  the thing worth showing. */
/** Requested headcount against how many people are actually on site, minute by
 *  minute across the ordered window.
 *
 *  Counting shifts is not good enough: a day can hold three shifts and still
 *  be empty at eleven o'clock — somebody went home ill at ten and the cover
 *  could only start at twelve. What the office needs to know is the LOWEST
 *  number of people present at any moment inside the window, and where it
 *  drops below what the client ordered. */
export function coverageFor(row: Demand, roster: RosterEntry[]) {
  const shifts = roster.filter(r => r.vacancyId === row.vacancyId && r.date === row.date && r.placeId === row.placeId && samePlace(r.section, row.section))
  const covering = shifts.filter(covers)
  const windowStart = minutesOf(row.start)
  const windowEnd = minutesOf(row.end)

  if (windowStart === null || windowEnd === null) {
    const covered = covering.length
    return { requested: row.headcount, covered, peak: covered, short: Math.max(0, row.headcount - covered), over: Math.max(0, covered - row.headcount), shifts, covering, gaps: [] as { from: number; to: number }[] }
  }

  const spans = covering.map(s => ({
    from: Math.max(windowStart, minutesOf(s.start) ?? windowStart),
    to: Math.min(windowEnd, minutesOf(effectiveEnd(s)) ?? windowEnd),
  })).filter(span => span.to > span.from)

  /* Walk the window in the segments between every start and every end; within
     one segment the number of people present cannot change. */
  const edges = [...new Set([windowStart, windowEnd, ...spans.flatMap(s => [s.from, s.to])])]
    .filter(m => m >= windowStart && m <= windowEnd)
    .sort((a, b) => a - b)

  let lowest = Infinity
  let peak = 0
  const deficits: { from: number; to: number }[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i], to = edges[i + 1]
    if (to <= from) continue
    const present = spans.filter(s => s.from <= from && s.to >= to).length
    lowest = Math.min(lowest, present)
    peak = Math.max(peak, present)
    if (present < row.headcount) {
      const last = deficits[deficits.length - 1]
      if (last && last.to === from) last.to = to
      else deficits.push({ from, to })
    }
  }
  if (!Number.isFinite(lowest)) lowest = 0

  return {
    requested: row.headcount,
    /* "Covered" is the guaranteed number — the worst moment of the day. */
    covered: lowest,
    peak,
    short: Math.max(0, row.headcount - lowest),
    over: Math.max(0, peak - row.headcount),
    shifts,
    covering,
    /* Ignore rounding slivers; a five-minute overlap gap is not news. */
    gaps: deficits.filter(g => g.to - g.from >= 15),
  }
}

/** A place is free text and may be absent. Blank and null mean the same
 *  thing — the object itself, no department — so everything compares through
 *  this, the way the old warehouse site normalised `sub_object`. */
export const placeKey = (place: string | null | undefined) => (place ?? '').trim()
export const samePlace = (a: string | null | undefined, b: string | null | undefined) => placeKey(a).toLowerCase() === placeKey(b).toLowerCase()
export const placeLabel = (place: string | null | undefined) => placeKey(place) || 'No department'

export const outcomeLabel: Record<ShiftOutcome, string> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
  worked: 'Worked',
  no_show: 'No show',
  left_early: 'Left early',
  cancelled: 'Cancelled',
}
export const outcomeTone: Record<ShiftOutcome, string> = {
  planned: 'neutral', confirmed: 'blue', worked: 'green',
  no_show: 'urgent', left_early: 'orange', cancelled: 'neutral',
}

/* ------------------------------------------------------------------
   Schedule pattern → the default order for a date.

   The pattern is not the schedule. It fills in what is usually true so the
   office types as little as possible; the per-date rows stay editable,
   because every object has exceptions — a warehouse Saturday twice a year,
   a start pulled an hour earlier, a day the client wants six instead of five.
   ------------------------------------------------------------------ */
import type { SchedulePattern, StartRule, EndRule, HeadcountRule, Vacancy as VacancyType, Weekday } from './types.ts'
import { weekdayLabel, weekdayOf, WEEKDAYS } from './types.ts'

export const startFor = (rule: StartRule, day: Weekday): string | null =>
  rule.kind === 'fixed' ? rule.time : rule.kind === 'byWeekday' ? rule.times[day] ?? null : null

/** How much of the clock a job keeps. Three shapes cover everything we staff:
 *  a full window (the warehouse, 07:00–16:00), a start with no end (Ziggo
 *  Dome — be there at 06:30, go home when the hall is clear), and no times at
 *  all (the day records who was there and nothing else). There is no fourth:
 *  an end without a start never occurs. */
export type Timing = 'none' | 'start' | 'window'
export const timingOf = (schedule: SchedulePattern): Timing =>
  schedule.start.kind === 'none' ? 'none' : schedule.end.kind === 'open' ? 'start' : 'window'

/** One place decides how a slot's time reads, so the schedule, the share sheet
 *  and the vacancy page cannot drift apart. A job that keeps no times shows
 *  nothing rather than an em dash — there is no missing value to report. */
export function slotTimeLabel(vacancy: VacancyType, slot: { start: string | null; end: string | null }): string {
  const timing = timingOf(vacancy.schedule)
  if (timing === 'none') return ''
  if (!slot.start) return 'time not set'
  return timing === 'start' ? `from ${slot.start}` : `${slot.start}–${slot.end ?? '?'}`
}

export const endFor = (rule: EndRule, day: Weekday): string | null =>
  rule.kind === 'fixed' ? rule.time : rule.kind === 'byWeekday' ? rule.times[day] ?? null : null

export const headcountFor = (rule: HeadcountRule, day: Weekday): number =>
  rule.kind === 'fixed' ? rule.count : rule.kind === 'byWeekday' ? rule.counts[day] ?? 0 : rule.typical

/** Is this date a working day by default? An empty `weekdays` list means the
 *  pattern makes no claim — Ziggo Dome's days come from the client's table, so
 *  nothing is generated and every day is added deliberately. */
export const isPatternDay = (pattern: SchedulePattern, date: ISODate) =>
  pattern.weekdays.length > 0 && pattern.weekdays.includes(weekdayOf(date))

/** The rows this vacancy would order on this date if nothing special happened. */
export function plannedSlotsFor(vacancy: VacancyType, date: ISODate) {
  const { schedule } = vacancy
  if (!isPatternDay(schedule, date)) return []
  if (vacancy.startDate > date) return []
  if (vacancy.endDate && vacancy.endDate < date) return []
  const day = weekdayOf(date)
  /* No usual places means the order is simply "people at this object", with
     no department — not a place literally called "Main". */
  /* One slot per hall the vacancy has; a vacancy with no halls orders the
     site itself, with no place and no section. */
  const places: (string | null)[] = vacancy.places.length ? vacancy.places.map(p => p.id) : [null]
  return places.map(placeId => ({
    placeId,
    headcount: headcountFor(schedule.headcount, day),
    start: startFor(schedule.start, day),
    end: endFor(schedule.end, day),
  }))
}

/** Fill a range of dates with the pattern, leaving any day that already has
 *  rows completely alone — generated defaults must never overwrite a decision
 *  somebody already made. */
export function generateDemand(vacancy: VacancyType, dates: ISODate[], existing: Demand[]): Demand[] {
  const created: Demand[] = []
  for (const date of dates) {
    if (existing.some(d => d.vacancyId === vacancy.id && d.date === date)) continue
    plannedSlotsFor(vacancy, date).forEach((slot, i) => {
      created.push({
        id: `d-gen-${vacancy.id}-${date}-${i}`,
        vacancyId: vacancy.id, date,
        placeId: slot.placeId, section: null, headcount: slot.headcount,
        start: slot.start, end: slot.end, note: null,
      })
    })
  }
  return created
}

/** The pattern in plain words, for the vacancy page. Reading a union of rules
 *  off the screen should not require knowing the union. */
export function describeSchedule(vacancy: VacancyType): string[] {
  const s = vacancy.schedule
  const lines: string[] = []

  lines.push(s.weekdays.length
    ? `Working days: ${s.weekdays.map(d => weekdayLabel[d]).join(', ')}${s.weekdays.length < 7 ? ' (exceptions are added per day)' : ''}`
    : 'Working days: no fixed pattern — every day comes from the client’s own schedule')

  const timing = timingOf(s)
  if (timing === 'none') {
    lines.push('Times: none — the day records who was there, not when')
  } else {
    lines.push(
      s.start.kind === 'fixed' ? `Start: ${s.start.time}, every day`
      : s.start.kind === 'byWeekday' ? `Start: ${WEEKDAYS.filter(d => s.start.kind === 'byWeekday' && s.start.times[d]).map(d => `${weekdayLabel[d]} ${(s.start as any).times[d]}`).join(', ')}`
      : s.start.kind === 'perDate' ? `Start: set per day${s.start.options.length ? ` (usually ${s.start.options.join(', ')})` : ''}`
      : 'Start: not recorded')

    lines.push(
      s.end.kind === 'fixed' ? `End: ${s.end.time} (overtime extends it)`
      : s.end.kind === 'open' ? 'End: not recorded — people leave when the work is done, so the rest of that day is blocked for them'
      : s.end.kind === 'byWeekday' ? `End: ${WEEKDAYS.filter(d => s.end.kind === 'byWeekday' && s.end.times[d]).map(d => `${weekdayLabel[d]} ${(s.end as any).times[d]}`).join(', ')}`
      : 'End: set per day')
  }

  lines.push(
    s.headcount.kind === 'fixed' ? `People: ${s.headcount.count} per slot`
    : s.headcount.kind === 'byWeekday' ? `People: varies by weekday`
    : `People: set per day (usually ${s.headcount.typical})`)

  lines.push(vacancy.places.length ? `Places: ${vacancy.places.map(p => p.name).join(' · ')} — sections inside them are typed per day` : 'Places: none — the site is ordered as a whole')
  return lines
}

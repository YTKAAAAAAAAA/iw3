export type ISODate = string
export type ISODateTime = string
/** One person.
 *
 *  `courseDays` are the weekdays they are at a course (the old site's
 *  `fixed_course_days`): a standing commitment, not a day off, so it repeats
 *  every week and nobody has to enter it again. Those weekdays are simply not
 *  offered when staffing.
 *
 *  `hasVog` records whether a Verklaring Omtrent het Gedrag is on file. Some
 *  clients will not let anybody on site without one, so the office needs the
 *  answer on the person rather than buried in a document folder. */
export type Worker = {
  id: string
  flexpediaId: number | null
  initials: string
  firstName: string
  insertion: string | null
  lastName: string
  fullName: string
  /** Town only — enough to plan travel, not enough to find the house. */
  city: string | null
  hasCar: boolean | null
  /** A bike of their own: enough for a site in town, not for a car-only one. */
  hasBike: boolean | null
  hasVog: boolean | null
  courseDays: Weekday[]
  status: 'active' | 'dismissed'
  dismissedAt: ISODate | null
  companyAccess: string[]
}
/** Contact and identity details. Loaded only on the person's own profile page,
 *  never in the lists that every page carries. */
export type PersonalDetails = {
  workerId: string
  gender: 'm' | 'f' | null
  birthDate: ISODate | null
  street: string | null
  streetNumber: string | null
  streetNumberAddition: string | null
  postCode: string | null
  residenceCountry: string | null
  nationality: string | null
  phone: string | null
  phoneCountry: string | null
  mobile: string | null
  email: string | null
  notes: string
}
/** Road distance from a worker's home to a vacancy, computed once per address
 *  pair on the server and frozen (see db/migrations/001_travel_distances.sql). */
export type TravelDistance = { workerId: string; vacancyId: string; km: number; minutes: number; computedAt: ISODateTime; profile: string }
/** Where a worker lives, rounded to about a kilometre: enough for the map,
 *  not an address. */
export type HomeArea = { workerId: string; lat: number; lon: number }
/** `archivedAt` set: hidden from every picker, kept so history can still name it. */
export type Company = { id:string; name:string; contactPerson:string|null; phone:string|null; notes:string|null; logoUrl:string|null; archivedAt:string|null }
/** A hall or site inside a vacancy — Slego, Conakryweg. Added and removed by
 *  hand as the client opens and closes them. */
export type VacancyPlace = { id:string; name:string }
export type RequirementKind = 'skill'|'language'|'document'|'transport'|'availability'
export type Requirement = { id:string; kind:RequirementKind; label:string; required:boolean }

export type Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'
export const WEEKDAYS:Weekday[] = ['mon','tue','wed','thu','fri','sat','sun']

/* ------------------------------------------------------------------
   Schedule pattern.

   Every object we staff differs along the same three axes — which days
   are working days, what the hours are, and how many people are wanted —
   and each axis is either pinned for the whole vacancy, varies by weekday,
   or is decided date by date. That is the only thing separating Ziggo Dome
   from the warehouse, so it is the only thing the model needs to express;
   there is no per-object special case anywhere in the code.

   The pattern produces DEFAULTS. The stored truth stays the per-date
   `Demand` rows, because every real object has exceptions — a warehouse
   weekend twice a year, a start pulled an hour earlier.
   ------------------------------------------------------------------ */

/** Ziggo Dome picks a different start for every working day (05:30, 06:30,
 *  07:30, 08:30); the warehouse is 07:00 and never moves.
 *
 *  'none' means this job keeps no clock at all — the day says who is there
 *  and that is the whole record. Together with the end rule it gives the
 *  three shapes that actually occur: no times, a start only, or a window. */
export type StartRule =
  | { kind:'none' }
  | { kind:'fixed'; time:string }
  | { kind:'byWeekday'; times:Partial<Record<Weekday,string>> }
  | { kind:'perDate'; options:string[] }

/** 'open' means the day ends when the work is done — people go home whenever
 *  that is, and nobody writes it down. It is also how a start-only job is
 *  expressed: there is a time to be there and no time to leave. Either way
 *  the person is unavailable for the rest of that day. */
export type EndRule =
  | { kind:'fixed'; time:string }
  | { kind:'open' }
  | { kind:'byWeekday'; times:Partial<Record<Weekday,string>> }
  | { kind:'perDate' }

export type HeadcountRule =
  | { kind:'fixed'; count:number }
  | { kind:'byWeekday'; counts:Partial<Record<Weekday,number>> }
  | { kind:'perDate'; typical:number }

export type SchedulePattern = {
  /** Working days by default. EMPTY means there is no default at all: every
   *  working day is chosen by hand, which is exactly the Ziggo Dome case —
   *  any weekday plus weekends, sometimes fewer than five days, sometimes
   *  more. */
  weekdays:Weekday[]
  start:StartRule
  end:EndRule
  headcount:HeadcountRule
  /** How far ahead the plan is normally known. Ziggo Dome publishes a
   *  fortnight; the warehouse orders the evening before. This only chooses the
   *  default view — nothing is forbidden either way. */
  horizon:'day'|'week'|'month'
}

export type Vacancy = { id:string; title:string; companyId:string; address:string; lat:number|null; lon:number|null; description:string; startDate:ISODate; endDate:ISODate|null; archivedAt?:ISODateTime|null; trackHoursManually:boolean; schedule:SchedulePattern; places:VacancyPlace[];
  requiresAvailableList?:boolean;
  /** The site can only be reached by car at these hours. Somebody without
   *  one cannot be placed here, however close they live. */
  carOnly:boolean;
  /** What a normal day is worth here. Everyone on the schedule that day starts
   *  with this many hours instead of an empty box — the office then only
   *  touches the days that went differently, which is the minority. NULL means
   *  every cell is typed by hand. */
  defaultHours:number|null;
  /** The client's own code for this job, printed in their weekly sheet
   *  (Projectcode: 'ALWct'). Ours to carry, not to invent. */
  projectCode:string|null;
  requirements?:Requirement[] }
/**
 * A standing arrangement: "Jan works this vacancy on these weekdays".
 *
 * It is NOT a record of work. It is a generator — pressing "fill" turns it
 * into real shifts for the days on screen, and from then on the shifts are
 * what count. Editing, swapping or deleting a shift never touches the
 * arrangement, which is what makes a replacement for one day, three days or a
 * week the same operation at three sizes.
 *
 * This is the shape every scheduling tool converges on, and the same one
 * calendars use for repeating events: a rule, materialised occurrences, and
 * exceptions that live on the occurrence rather than the rule.
 */
export type StandingAssignment = {
  id:string
  vacancyId:string
  workerId:string
  placeId:string|null
  section:string|null
  weekdays:Weekday[]
  /** Null means "whatever the slot says on the day". */
  start:string|null
  end:string|null
  from:ISODate
  to:ISODate|null
  note:string|null
}
/** What a shift turned into. Planning and reality diverge constantly — a
 *  person does not show up, leaves at ten, or comes in to cover someone — and
 *  the office needs the difference visible rather than quietly overwritten. */
export type ShiftOutcome = 'planned' | 'confirmed' | 'worked' | 'no_show' | 'left_early' | 'cancelled'

/** One person, one sub-object, one stretch of one day.
 *
 *  `start`/`end` are 'HH:MM' local times. They exist because a slot is not
 *  always one person for a whole day: two people can split it, and a shift cut
 *  short at 10:00 plus a replacement starting at 12:00 leaves a two-hour hole
 *  that has to be visible. A worker may therefore hold several shifts on one
 *  date — what is forbidden is two shifts whose times overlap. */
export type RosterEntry = {
  id:string
  vacancyId:string
  date:ISODate
  placeId:string|null
  /** Optional subdivision inside the hall: Inbound, Outbound. Free text —
   *  the client invents them, and Conakryweg is ordered with none at all. */
  section:string|null
  workerId:string|null
  /** Somebody on site beyond what the client ordered. It happens: a crew of
   *  newcomers once needed two experienced hands and the agency paid for them
   *  itself. They worked, the client did not pay, and the day should say so
   *  instead of looking like a miscount. */
  extra:boolean
  extraReason:string|null
  /** The standing arrangement this shift was generated from, if any. A shift
   *  edited by hand keeps the link: the arrangement is a source, not an owner. */
  standingId:string|null
  start:string|null
  end:string|null
  outcome:ShiftOutcome
  /** Set when the shift ended earlier than planned. */
  actualEnd:string|null
  /** The shift this one was opened to cover, if any. */
  coversShiftId:string|null
  note:string|null
}

/** What the client asked for, kept apart from what the agency staffed.
 *  Headcount moves day to day — "one on Monday, two on Tuesday, one again on
 *  Wednesday" — and that movement belongs to the order, not to the roster. */
export type Demand = {
  id:string
  vacancyId:string
  date:ISODate
  /** Which hall. Null when the vacancy is undivided — Ziggo Dome is one
   *  place and naming it would be noise. */
  placeId:string|null
  section:string|null
  headcount:number
  /** Requested window for the slot, used as the default for new shifts. */
  start:string|null
  end:string|null
  note:string|null
}
export type Leave = { id:string; workerId:string; date:ISODate; reason:string; paidLeave:boolean }
export type HoursEntry = { id:string; workerId:string; vacancyId:string; date:ISODate; hours:number; manual?:boolean }
export type SyncStatus = { source:'supabase'|'flexpedia'; configured:boolean; enabled:boolean; lastSyncAt:ISODateTime|null; lastError:string|null }
export type DayState = 'working'|'leave'|'free'
export function todayInAmsterdam(now = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
export type AssignmentInfo = { vacancyId:string; placeId:string|null; section:string|null; assignmentId:string }
export type AppData = { workers:Worker[]; companies:Company[]; vacancies:Vacancy[]; standing:StandingAssignment[]; roster:RosterEntry[]; leaves:Leave[]; hours:HoursEntry[]; sync:SyncStatus[] }
export const isoDate = (date: Date) => date.toISOString().slice(0,10)
export const addDays = (date: ISODate, amount:number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+amount); return isoDate(d) }
/** Every date in the app is written one way: 04.10.2026, the European
 *  numeric form. Timestamps are shown as the Amsterdam calendar date. */
export const formatDate = (value: ISODate | ISODateTime | null) => {
  if (!value) return '—'
  const [year, month, day] = (value.includes('T') ? todayInAmsterdam(new Date(value)) : value.slice(0, 10)).split('-')
  return `${day}.${month}.${year}`
}
/** 04.10 — for day columns where the year is already on screen. */
export const formatShortDate = (value: ISODate) => formatDate(value).slice(0, 5)
/** 04.10.2026 14:05 in Amsterdam time, on a 24-hour clock. */
/** Reads what people type for a date — 05.10.2026, 5.10.2026, 05-10-2026,
 *  05/10/26, 05102026 or 2026-10-05 — as an ISO date. Day first, always;
 *  null when it is not a real date. */
export const parseDate = (text: string): ISODate | null => {
  const value = text.trim()
  let day: number, month: number, year: number
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else if ((match = value.match(/^(\d{1,2})[.\-/ ](\d{1,2})[.\-/ ](\d{2}|\d{4})$/)))
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else if ((match = value.match(/^(\d{2})(\d{2})(\d{4})$/)))
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else return null
  if (year < 100) year += 2000
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const check = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso ? null : iso
}
export const formatDateTime = (value: ISODateTime | null) => {
  if (!value) return '—'
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`
}
/** 14:05 in Amsterdam time. */
export const formatTimeOfDay = (value: ISODateTime) => formatDateTime(value).slice(11)
export const initialsFor = (name:string) => name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()
export const companyById = (companies:Company[], id:string) => companies.find(c=>c.id===id)
export const workerById = (workers:Worker[], id:string) => workers.find(w=>w.id===id)
export const vacancyById = (vacancies:Vacancy[], id:string) => vacancies.find(v=>v.id===id)
export const candidateStatusLabel = (status:DayState) => status === 'working' ? 'Working' : status === 'leave' ? 'On leave' : 'Free'
export const isoWeek = (date:ISODate) => { const d=new Date(`${date}T12:00:00Z`); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3); const first=new Date(Date.UTC(d.getUTCFullYear(),0,4)); return { year:d.getUTCFullYear(), week:1+Math.round(((d.getTime()-first.getTime())/86400000-3+((first.getUTCDay()+6)%7))/7) } }
export const weekDates = (year:number, week:number) => { const jan4=new Date(Date.UTC(year,0,4)); const monday=new Date(jan4); monday.setUTCDate(jan4.getUTCDate()-((jan4.getUTCDay()+6)%7)+(week-1)*7); return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setUTCDate(monday.getUTCDate()+i); return isoDate(d) }) }


/** 'HH:MM' -> minutes since midnight. Times are plain local clock times: the
 *  agency and every site sit in one timezone, so there is nothing to convert. */
export const minutesOf = (time:string|null|undefined) => { if(!time) return null; const [h,m]=time.split(':').map(Number); return h*60+m }
export const formatTime = (time:string|null|undefined) => time || '—'
/** Read a typed time. '7' is 07:00, '730' and '7.30' and '7:30' are 07:30 —
 *  the office types times all day and a box that rejects '730' only slows
 *  them down. Anything unreadable, or an hour that does not exist, comes back
 *  null: an empty field is honest, a wrong hour is not.
 *
 *  This is also why the schedule does not use <input type="time">: Chrome
 *  renders that box in the BROWSER's locale, so an English-language machine
 *  shows an AM/PM stepper. Every site here runs on a 24-hour clock. */
export const parseClock = (raw:string):string|null => {
  const text = raw.trim()
  if (!text) return null
  const match = text.match(/^(\d{1,2})[:.\s]?(\d{2})?$/)
  if (!match) return null
  const hours = Number(match[1]), minutes = match[2] ? Number(match[2]) : 0
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`
}
export const durationHours = (start:string|null, end:string|null) => { const a=minutesOf(start), b=minutesOf(end); return a===null||b===null?null:Math.round((b-a)/6)/10 }


export const weekdayOf = (date:ISODate):Weekday => WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7]
export const weekdayLabel:Record<Weekday,string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }


/** Who has already been asked, and who said no.
 *  The point is not bookkeeping — it is not ringing the same person twice with
 *  the same offer. A refusal can be withdrawn: people change their mind, and
 *  the record should not hold them to it. */
export type Offer = {
  id:string
  vacancyId:string
  workerId:string
  /** Null when the answer covers the vacancy in general, not one day. */
  date:ISODate|null
  status:'offered'|'declined'
  note:string|null
  at:ISODateTime
}

/** "Amsterdam · jan@example.com", skipping whatever is missing, so a person
 *  without a city never shows a stray "null ·" or a dangling separator. */
export const joinDetails = (...parts: Array<string | number | null | undefined | false>) =>
  parts.filter(part => part !== null && part !== undefined && part !== false && part !== '').join(' · ')

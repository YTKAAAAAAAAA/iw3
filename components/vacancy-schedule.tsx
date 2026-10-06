'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Plus,
  Repeat,
  Share2,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { Badge, Panel, StateBlock, TimeField, useExit } from './app-shell'
import { useWorkforceData } from './workforce-data-context'
import type { CandidateVisibility } from './workforce-data-context'
import {
  assignmentOn,
  availabilityLabel,
  availabilityOver,
  blockOn,
  endFor,
  isCourseDay,
  dayNeed,
  patternNeed,
  sameDayClash,
  slotTimeLabel,
  timeRange,
  startFor,
  timingOf,
} from '@/lib/derive'
import { travelFor, travelIndex } from '@/lib/travel'
import { assessRequirements } from '@/lib/requirement-fit'
import { addDays, formatDate, isoWeek, weekDates, weekdayLabel, weekdayOf, WEEKDAYS } from '@/lib/types'
import type { Demand, Offer, RosterEntry, StandingAssignment, Vacancy, Weekday, Worker } from '@/lib/types'
import { WorkdayReport } from './workday-report'
import { DayReportCard, ScheduleMonth, useDayPhotos } from './schedule-month'
import { PeoplePicker } from './schedule-picker'
import { useConfirm } from './confirm-dialog'
import { DateField } from './date-field'
import { demandRow, diffSchedule, mergeSchedule, rosterRows, type RosterRow, type ScheduleState } from '@/lib/schedule-sync'
import { useLanguage } from '@/lib/i18n'
import { useToday } from '@/lib/today'

type View = 'day' | 'week' | 'month'
type SavedSchedule = {
  revision: number
  demand: Demand[]
  roster: RosterEntry[]
  standing: StandingAssignment[]
  offers: Offer[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseSavedSchedule(value: unknown, vacancyId: string): SavedSchedule | null {
  if (
    !isRecord(value) ||
    value.vacancyId !== vacancyId ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Array.isArray(value.demand) ||
    !Array.isArray(value.roster) ||
    !Array.isArray(value.standing) ||
    !Array.isArray(value.offers)
  )
    return null
  const demand = value.demand
  if (
    !demand.every(
      row =>
        isRecord(row) &&
        typeof row.id === 'string' &&
        row.vacancyId === vacancyId &&
        typeof row.date === 'string' &&
        (row.placeId === null || typeof row.placeId === 'string') &&
        (row.section === null || typeof row.section === 'string') &&
        Number.isSafeInteger(row.headcount) &&
        (row.start === null || typeof row.start === 'string') &&
        (row.end === null || typeof row.end === 'string') &&
        (row.note === null || typeof row.note === 'string'),
    )
  )
    return null
  const roster = value.roster
  if (
    !roster.every(
      row =>
        isRecord(row) &&
        typeof row.id === 'string' &&
        row.vacancyId === vacancyId &&
        typeof row.date === 'string' &&
        typeof row.placeId === 'string' &&
        (row.section === null || typeof row.section === 'string') &&
        (row.workerId === null || typeof row.workerId === 'string') &&
        typeof row.extra === 'boolean' &&
        (row.standingId === null || typeof row.standingId === 'string') &&
        (row.start === null || typeof row.start === 'string') &&
        (row.end === null || typeof row.end === 'string') &&
        (row.note === null || typeof row.note === 'string'),
    )
  )
    return null
  const standing = value.standing
  if (
    !standing.every(
      row =>
        isRecord(row) &&
        typeof row.id === 'string' &&
        row.vacancyId === vacancyId &&
        typeof row.workerId === 'string' &&
        (row.placeId === null || typeof row.placeId === 'string') &&
        (row.section === null || typeof row.section === 'string') &&
        Array.isArray(row.weekdays) &&
        row.weekdays.every(day => WEEKDAYS.includes(day as Weekday)) &&
        (row.start === null || typeof row.start === 'string') &&
        (row.end === null || typeof row.end === 'string') &&
        typeof row.from === 'string' &&
        (row.to === null || typeof row.to === 'string') &&
        (row.note === null || typeof row.note === 'string'),
    )
  )
    return null
  const offers = value.offers
  if (
    !offers.every(
      row =>
        isRecord(row) &&
        typeof row.id === 'string' &&
        row.vacancyId === vacancyId &&
        typeof row.workerId === 'string' &&
        (row.date === null || typeof row.date === 'string') &&
        (row.status === 'offered' || row.status === 'declined') &&
        (row.note === null || typeof row.note === 'string') &&
        typeof row.at === 'string',
    )
  )
    return null
  return {
    revision: value.revision as number,
    demand: demand as Demand[],
    roster: roster.map(row => ({
      ...(row as RosterEntry),
      outcome: 'planned',
      actualEnd: null,
      coversShiftId: null,
    })),
    standing: standing as StandingAssignment[],
    offers: offers as Offer[],
  }
}

/** "October 2026" / "Oktober 2026" — capitalised in Dutch too, as a heading. */
const monthTitle = (anchor: string, locale: string) => {
  const label = new Date(`${anchor}T12:00:00Z`).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  })
  return label[0].toUpperCase() + label.slice(1)
}

/** A short id for something not saved yet; the server swaps in its own.
 *  Ids used to be built from the vacancy's slug, the place's slug and the
 *  date — over the 120 characters the server accepts for a long vacancy
 *  name, which refused a whole "Create shifts" and undid it. */
let tempCounter = 0
const tempId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(tempCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const storedId = (id: string) => /^[1-9]\d{0,14}$/.test(id)

const isISODate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const placeName = (v: Vacancy, id: string | null) =>
  id ? (v.places.find(p => p.id === id)?.name ?? id) : null
const slotTitle = (v: Vacancy, row: { placeId: string | null; section: string | null }) =>
  [placeName(v, row.placeId), row.section].filter(Boolean).join(' · ') || 'Whole site'
const sameSlot = (
  a: { placeId: string | null; section: string | null },
  b: { placeId: string | null; section: string | null },
) => a.placeId === b.placeId && (a.section ?? '') === (b.section ?? '')
const daysInMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
const firstOfMonth = (iso: string, delta = 0) => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function assessWorkerRequirements(vacancy: Vacancy, worker: Worker) {
  const assessment = assessRequirements(vacancy.requirements ?? [], worker)
  if (vacancy.carOnly && worker.hasCar === null) assessment.warnings.unshift('Verify own transport')
  return assessment
}

export function VacancySchedule({ vacancy }: { vacancy: Vacancy }) {
  const today = useToday()
  const {
    demand: seedDemand,
    leaves,
    offers: seedOffers,
    roster: seedRoster,
    standing: seedStanding,
    vacancies,
    workers,
    candidateVisibility: seedVisibility,
  } = useWorkforceData()
  const { t, locale } = useLanguage()
  const [view, setView] = useState<View>(vacancy.schedule.horizon)
  const storageKey = `iatw-schedule-date:${vacancy.id}`
  const [anchor, setAnchor] = useState(today)
  const [restoredStorageKey, setRestoredStorageKey] = useState<string | null>(null)
  const [dateStorageError, setDateStorageError] = useState('')
  const changeView = (next: View) => setView(next)
  const [rows, setRows] = useState<Demand[]>(seedDemand)
  const [plan, setPlan] = useState<RosterEntry[]>(seedRoster)
  const [arrangements, setArrangements] = useState<StandingAssignment[]>(seedStanding)
  const [scheduleReady, setScheduleReady] = useState(false)
  const [scheduleLoadError, setScheduleLoadError] = useState('')
  const [scheduleSaveError, setScheduleSaveError] = useState('')
  const [scheduleSaveStatus, setScheduleSaveStatus] = useState('')
  const [loadRetry, setLoadRetry] = useState(0)
  const [saveRetry, setSaveRetry] = useState(0)
  const revisionRef = useRef(0)
  /* What the server holds, as far as this page knows — the last load or save.
     A save sends only what differs from it (lib/schedule-sync.ts), so a row
     changed elsewhere is never written back over by this page. */
  const baseRef = useRef<ScheduleState | null>(null)
  const latestRef = useRef<{
    rows: Demand[]
    plan: RosterEntry[]
    arrangements: StandingAssignment[]
    offerLog: Offer[]
  } | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const staleRetriesRef = useRef(0)
  const [saveUndone, setSaveUndone] = useState(false)
  const { confirm, confirmElement } = useConfirm()
  const [offerLog, setOfferLog] = useState<Offer[]>(seedOffers)
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [draft, setDraft] = useState<{ date: string } | null>(null)
  const [replacing, setReplacing] = useState<StandingAssignment | null>(null)
  const [addingPerson, setAddingPerson] = useState(false)
  const [availableListDate, setAvailableListDate] = useState<string | null>(null)
  const [candidateVisibility, setCandidateVisibility] = useState(
    seedVisibility.filter(item => item.vacancyId === vacancy.id),
  )
  /* The schedule is the long part of this page, and most visits are about who
     normally works here rather than about a particular day — so it stays
     folded until asked for. */

  /** This vacancy's part of the page state, in the shape that is compared. */
  const ownState = (
    demand: Demand[],
    roster: RosterEntry[],
    standing: StandingAssignment[],
    offers: Offer[],
  ): ScheduleState => ({
    demand: demand.filter(row => row.vacancyId === vacancy.id).map(demandRow),
    roster: rosterRows(roster.filter(row => row.vacancyId === vacancy.id)),
    standing: standing.filter(row => row.vacancyId === vacancy.id),
    offers: offers.filter(row => row.vacancyId === vacancy.id),
  })
  /** Puts a schedule into the page. Other vacancies' rows stay: they are what
   *  tells this page who is busy elsewhere. */
  const adopt = (next: ScheduleState) => {
    const entry = ({ position: _position, ...row }: RosterRow): RosterEntry => ({
      ...row,
      outcome: 'planned',
      actualEnd: null,
      coversShiftId: null,
    })
    setRows(cur => [...cur.filter(row => row.vacancyId !== vacancy.id), ...next.demand])
    setPlan(cur => [...cur.filter(row => row.vacancyId !== vacancy.id), ...next.roster.map(entry)])
    setArrangements(cur => [...cur.filter(row => row.vacancyId !== vacancy.id), ...next.standing])
    setOfferLog(cur => [...cur.filter(row => row.vacancyId !== vacancy.id), ...next.offers])
  }
  const fetchSchedule = async () => {
    const response = await fetch(`/api/vacancies/${encodeURIComponent(vacancy.id)}/schedule`, { cache: 'no-store' })
    const result: unknown = await response.json()
    if (!response.ok)
      throw new Error(isRecord(result) && typeof result.error === 'string' ? result.error : 'Could not load the schedule.')
    const snapshot = parseSavedSchedule(result, vacancy.id)
    if (!snapshot) throw new Error('The server returned an invalid schedule.')
    return {
      revision: snapshot.revision,
      state: ownState(snapshot.demand, snapshot.roster, snapshot.standing, snapshot.offers),
    }
  }

  useEffect(() => {
    let cancelled = false
    setScheduleReady(false)
    setScheduleLoadError('')
    fetchSchedule()
      .then(({ revision, state }) => {
        if (cancelled) return
        revisionRef.current = revision
        baseRef.current = state
        adopt(state)
        setScheduleReady(true)
      })
      .catch(cause => {
        if (!cancelled)
          setScheduleLoadError(cause instanceof Error ? cause.message : 'Could not load the schedule.')
      })
    return () => {
      cancelled = true
    }
    // Loaded once per vacancy (and on "Try again"); the helpers are stable in effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancy.id, loadRetry])

  useEffect(() => {
    latestRef.current = { rows, plan, arrangements, offerLog }
  })

  const saveChanges = async () => {
    const base = baseRef.current
    const latest = latestRef.current
    if (!base || !latest) return
    const current = ownState(latest.rows, latest.plan, latest.arrangements, latest.offerLog)
    const diff = diffSchedule(base, current)
    if (!diff) return

    setScheduleSaveStatus('Saving schedule…')
    setScheduleSaveError('')
    setSaveUndone(false)
    let response: Response
    let result: unknown
    try {
      response = await fetch(`/api/vacancies/${encodeURIComponent(vacancy.id)}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: revisionRef.current, ...diff }),
      })
      result = await response.json().catch(() => null)
    } catch {
      /* Offline: the changes stay on the page and go with the next save. */
      setScheduleSaveStatus('')
      setScheduleSaveError('Could not reach the server.')
      return
    }

    if (
      response.ok &&
      isRecord(result) &&
      Number.isSafeInteger(result.revision) &&
      isRecord(result.ids) &&
      isRecord(result.ids.demand) &&
      isRecord(result.ids.roster) &&
      Array.isArray(result.cancelledShiftIds)
    ) {
      staleRetriesRef.current = 0
      const demandIds = result.ids.demand
      const rosterIds = result.ids.roster
      const cancelledIds = new Set(result.cancelledShiftIds.filter((id): id is string => typeof id === 'string'))
      const mapId = (ids: Record<string, unknown>, id: string) => (typeof ids[id] === 'string' ? (ids[id] as string) : id)
      revisionRef.current = result.revision as number
      /* Ids the server issued replace the page's temporary ones. */
      setRows(cur =>
        cur.map(row => (row.vacancyId === vacancy.id ? { ...row, id: mapId(demandIds, row.id) } : row)),
      )
      setPlan(cur =>
        cur
          .filter(row => !cancelledIds.has(row.id))
          .map(row => (row.vacancyId === vacancy.id ? { ...row, id: mapId(rosterIds, row.id) } : row)),
      )
      baseRef.current = {
        demand: current.demand.map(row => ({ ...row, id: mapId(demandIds, row.id) })),
        roster: rosterRows(
          current.roster
            .filter(row => !cancelledIds.has(row.id))
            .map(({ position: _position, ...row }) => ({
              ...row,
              id: mapId(rosterIds, row.id),
              outcome: 'planned' as const,
              actualEnd: null,
              coversShiftId: null,
            })),
        ),
        standing: current.standing,
        offers: current.offers,
      }
      setScheduleSaveStatus('Schedule saved')
      return
    }

    const code = isRecord(result) && typeof result.code === 'string' ? result.code : null
    const params = isRecord(result) && isRecord(result.params) ? result.params : null
    const message =
      code === 'double_booking' && params
        ? t('{name} is already on {job}{time} on {date}.', {
            name: String(params.name ?? ''),
            job: String(params.job ?? ''),
            time: String(params.time ?? ''),
            date: typeof params.date === 'string' ? formatDate(params.date) : '',
          })
        : isRecord(result) && typeof result.error === 'string'
          ? result.error
          : 'Could not save the schedule.'
    try {
      const theirs = await fetchSchedule()
      if (response.status === 409 && code === 'stale' && staleRetriesRef.current < 3) {
        /* Somebody else saved (or the Warehouse sync ran): take their version
           and replay this page's own changes on top of it. The merged state
           differs from the new base by exactly those changes, so the next save
           sends just them. */
        staleRetriesRef.current += 1
        const now = latestRef.current ?? latest
        const merged = mergeSchedule(
          base,
          ownState(now.rows, now.plan, now.arrangements, now.offerLog),
          theirs.state,
        )
        revisionRef.current = theirs.revision
        baseRef.current = theirs.state
        adopt(merged)
        setScheduleSaveStatus('Updated with changes made elsewhere')
        return
      }
      /* Refused (a clash, a record that cannot move): show why and put the
         page back to what the server holds, instead of retrying the same
         refused change forever. */
      staleRetriesRef.current = 0
      revisionRef.current = theirs.revision
      baseRef.current = theirs.state
      adopt(theirs.state)
      setScheduleSaveStatus('')
      setScheduleSaveError(message)
      setSaveUndone(true)
    } catch (cause) {
      setScheduleSaveStatus('')
      setScheduleSaveError(cause instanceof Error ? cause.message : message)
    }
  }

  useEffect(() => {
    if (!scheduleReady) return
    const timer = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .then(saveChanges)
        .catch(cause => {
          setScheduleSaveStatus('')
          setScheduleSaveError(cause instanceof Error ? cause.message : 'Could not save the schedule.')
        })
    }, 500)
    return () => window.clearTimeout(timer)
    // saveChanges reads the latest state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleReady, saveRetry, vacancy.id, rows, plan, arrangements, offerLog])

  /* The day being looked at survives a reload, and follows to other tabs —
     but only until midnight. Stored as "<day shown> <day saved>"; the next
     morning the schedule opens on today, not on yesterday's place. */
  const shownDay = (stored: string | null) => {
    const [day, savedOn] = (stored ?? '').split(' ')
    return isISODate(day) && savedOn === today ? day : null
  }
  useEffect(() => {
    let savedDate: string | null = null
    try {
      savedDate = shownDay(window.localStorage.getItem(storageKey))
    } catch (cause) {
      setDateStorageError(cause instanceof Error ? cause.message : 'Could not read the saved schedule date.')
    }
    if (savedDate) setAnchor(savedDate)
    /* ?day=… (a short day clicked in the vacancy list) opens that day. */
    const askedDay = new URLSearchParams(window.location.search).get('day')
    if (isISODate(askedDay)) {
      setAnchor(askedDay)
      setView('day')
      window.history.replaceState(window.history.state, '', window.location.pathname)
      window.setTimeout(() => document.querySelector('.sched-header')?.scrollIntoView({ block: 'start' }), 300)
    }
    setRestoredStorageKey(storageKey)
    const onStorage = (event: StorageEvent) => {
      const day = event.key === storageKey ? shownDay(event.newValue) : null
      if (day) setAnchor(day)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // `today` only changes at midnight; the stored day is read once per vacancy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (restoredStorageKey !== storageKey) return
    try {
      window.localStorage.setItem(storageKey, `${anchor} ${today}`)
      setDateStorageError('')
    } catch (cause) {
      setDateStorageError(
        cause instanceof Error ? cause.message : 'Could not save the schedule date in this browser.',
      )
    }
  }, [anchor, restoredStorageKey, storageKey, today])

  const week = isoWeek(anchor)
  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    if (view === 'week') return weekDates(week.year, week.week)
    /* Every day of the month, not only the ordered ones: a month you cannot
       add a day to is a dead end, which is exactly what the previous version
       became once a month had no orders in it. */
    const month = anchor.slice(0, 7)
    return Array.from({ length: daysInMonth(anchor) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  }, [view, anchor, week.year, week.week])

  const weekPhotos = useDayPhotos(vacancy.id, days[0], days[days.length - 1], view === 'week')

  /* Months are stepped as months. Adding thirty days drifts and eventually
     skips one — February guarantees it. */
  const step = (n: number) =>
    setAnchor(a =>
      view === 'day' ? addDays(a, n) : view === 'week' ? addDays(a, n * 7) : firstOfMonth(a, n),
    )

  const mine = <T extends { vacancyId: string }>(xs: T[]) => xs.filter(x => x.vacancyId === vacancy.id)
  const withinVacancy = (date: string) => date >= vacancy.startDate && (!vacancy.endDate || date <= vacancy.endDate)
  /* Every shift is stored against a site, so "whole site" means the vacancy's
     first place. A slot or arrangement left without one (the dialogs used to
     default to that) produced shifts the server refused to save. */
  const firstPlace = vacancy.places[0]?.id ?? null
  const placeOf = (placeId: string | null) => placeId ?? firstPlace
  const onLeave = (s: RosterEntry) => !!s.workerId && leaves.some(l => l.workerId === s.workerId && l.date === s.date)
  /** Another shift of the same person that day which cannot be combined with
   *  this one (the one-hour rule), on any job. */
  const clashOf = (s: RosterEntry) =>
    plan.find(
      other =>
        other.id !== s.id &&
        !!s.workerId &&
        other.workerId === s.workerId &&
        other.date === s.date &&
        other.outcome !== 'cancelled' &&
        sameDayClash(other, s) === 'blocked',
    )
  /** Their other shifts that day that can be combined — worth knowing, not wrong. */
  const alsoOf = (s: RosterEntry) =>
    plan.filter(
      other =>
        other.id !== s.id &&
        !!s.workerId &&
        other.workerId === s.workerId &&
        other.date === s.date &&
        other.outcome !== 'cancelled' &&
        sameDayClash(other, s) === 'possible',
    )
  const jobLabel = (other: RosterEntry) =>
    [
      `${vacancies.find(v => v.id === other.vacancyId)?.title ?? ''}${other.vacancyId === vacancy.id ? ` · ${t(slotTitle(vacancy, other))}` : ''}`,
      timeRange(other.start, other.end, t),
    ]
      .filter(Boolean)
      .join(' ')
  /** Who is really there: not the extras, and not somebody who is on leave. */
  const staffed = (row: Demand) => shiftsIn(row).filter(s => !s.extra && !onLeave(s)).length
  /** The day as a whole: people needed (slots, or the fixed pattern) against
   *  people on it. Short only from tomorrow on — today is too late to plan. */
  const needOn = (date: string) => {
    const need = dayNeed(vacancy, date, rows, plan, arrangements, leaves)
    return { ...need, short: date > today && need.needed > 0 && need.staffed < need.needed }
  }
  const slotsOn = (date: string) =>
    mine(rows)
      .filter(r => r.date === date)
      .sort(
        (a, b) =>
          (a.start ?? '').localeCompare(b.start ?? '') ||
          slotTitle(vacancy, a).localeCompare(slotTitle(vacancy, b)),
      )
  const shiftsIn = (row: Demand) => mine(plan).filter(s => s.date === row.date && sameSlot(s, row))
  const liveArrangements = arrangements.filter(a => a.vacancyId === vacancy.id && (!a.to || a.to >= today))

  /* Turning arrangements into shifts for the days on screen. Anything already
     there is left alone — generating must never overwrite a decision. */
  const fillFromArrangements = (only?: StandingAssignment[]) => {
    const source = (only ?? arrangements).map(a => ({ ...a, placeId: placeOf(a.placeId) }))
    /* A standing arrangement IS the order for this kind of work: nobody at a
       two-person evening clean sits down to "order two people every Monday".
       So filling creates the slot as well as the shifts — otherwise the shifts
       exist but have nowhere to show, which is what happened here first. An
       existing slot is never resized: that number came from the client. */
    const neededSlots: Demand[] = []
    /* Only the vacancy's own dates: an arrangement starting "today" used to
       put people on days before the job had even begun. */
    const jobDays = days.filter(date => withinVacancy(date))
    for (const date of jobDays) {
      const day = weekdayOf(date)
      const due = source.filter(
        a =>
          a.vacancyId === vacancy.id && a.weekdays.includes(day) && a.from <= date && (!a.to || a.to >= date),
      )
      for (const a of due) {
        const exists =
          mine(rows).some(r => r.date === date && sameSlot(r, a)) ||
          neededSlots.some(r => r.date === date && sameSlot(r, a))
        if (exists) continue
        const sameShape = due.filter(x => sameSlot(x, a)).length
        /* The order is the vacancy's pattern for that day — two people a day
           stays two even when only one of them is standing — less what other
           slots that day already ask for. Never fewer than the standing people. */
        const otherSlots = [...mine(rows), ...neededSlots]
          .filter(r => r.date === date)
          .reduce((sum, r) => sum + r.headcount, 0)
        neededSlots.push({
          id: tempId('d-auto'),
          vacancyId: vacancy.id,
          date,
          placeId: a.placeId,
          section: a.section,
          headcount: Math.max(sameShape, patternNeed(vacancy, date) - otherSlots),
          start: a.start ?? (vacancy.schedule.start.kind === 'fixed' ? vacancy.schedule.start.time : null),
          end: a.end ?? (vacancy.schedule.end.kind === 'fixed' ? vacancy.schedule.end.time : null),
          note: null,
        })
      }
    }
    if (neededSlots.length) setRows(cur => [...cur, ...neededSlots])

    setPlan(cur => {
      const made: RosterEntry[] = []
      for (const date of jobDays) {
        const day = weekdayOf(date)
        for (const a of source.filter(x => x.vacancyId === vacancy.id)) {
          if (!a.weekdays.includes(day)) continue
          if (a.from > date || (a.to && a.to < date)) continue
          if (leaves.some(l => l.workerId === a.workerId && l.date === date)) continue
          const already = [...cur, ...made].some(
            s => s.vacancyId === vacancy.id && s.date === date && s.workerId === a.workerId,
          )
          if (already) continue
          const slot = [...mine(rows), ...neededSlots].find(r => r.date === date && sameSlot(r, a))
          made.push({
            id: tempId('r-gen'),
            vacancyId: vacancy.id,
            date,
            placeId: a.placeId,
            section: a.section,
            workerId: a.workerId,
            extra: false,
            extraReason: null,
            standingId: a.id,
            start: a.start ?? slot?.start ?? null,
            end: a.end ?? slot?.end ?? null,
            outcome: 'planned',
            actualEnd: null,
            coversShiftId: null,
            note: null,
          })
        }
      }
      return [...cur, ...made]
    })
  }

  /* A replacement rewrites the shifts inside a date range and nothing else.
     One day, three days or a whole week is the same operation — only the range
     differs — and the arrangement itself is untouched, so the original person
     comes back automatically when the range ends. */
  const replaceOver = (arrangement: StandingAssignment, incoming: string, from: string, to: string, reason: string) =>
    setPlan(cur => {
      const a = { ...arrangement, placeId: placeOf(arrangement.placeId) }
      const cover = workers.find(w => w.id === incoming)
      const note = reason || `Covering ${workers.find(w => w.id === a.workerId)?.fullName ?? ''}`.trim()
      /* A day the cover cannot take is left with the original person rather
         than handed over anyway: that is how somebody ended up on the same
         job twice on one date. The dialog says how many days this is. */
      const canTake = (date: string) => !!cover && blockOn(cover, date, vacancy.id, cur, leaves) === 'free'

      const touched = cur.map(s =>
        s.vacancyId === vacancy.id &&
        s.workerId === a.workerId &&
        s.date >= from &&
        s.date <= to &&
        canTake(s.date)
          ? { ...s, workerId: incoming, note }
          : s,
      )
      /* Days in the range that were never generated still need covering. */
      const made: RosterEntry[] = []
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (!withinVacancy(d)) continue
        if (!a.weekdays.includes(weekdayOf(d))) continue
        if (!canTake(d)) continue
        if (touched.some(s => s.vacancyId === vacancy.id && s.date === d && s.workerId === incoming)) continue
        const slot = mine(rows).find(r => r.date === d && sameSlot(r, a))
        made.push({
          id: tempId('r-cov'),
          vacancyId: vacancy.id,
          date: d,
          placeId: a.placeId,
          section: a.section,
          workerId: incoming,
          extra: false,
          extraReason: null,
          standingId: a.id,
          start: a.start ?? slot?.start ?? null,
          end: a.end ?? slot?.end ?? null,
          outcome: 'planned',
          actualEnd: null,
          coversShiftId: null,
          note,
        })
      }
      return [...touched, ...made]
    })

  const addSlot = (
    date: string,
    placeId: string | null,
    section: string,
    headcount: number,
    start: string | null,
    end: string | null,
  ) =>
    setRows(cur => [
      ...cur,
      {
        id: tempId('d'),
        vacancyId: vacancy.id,
        date,
        placeId,
        section: section.trim() || null,
        headcount,
        start,
        end,
        note: null,
      },
    ])
  const patchSlot = (id: string, patch: Partial<Demand>) =>
    setRows(cur => cur.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const dropSlot = (id: string) => {
    const row = rows.find(r => r.id === id)
    if (row)
      setPlan(cur =>
        cur.filter(s => !(s.vacancyId === vacancy.id && s.date === row.date && sameSlot(s, row))),
      )
    setRows(cur => cur.filter(r => r.id !== id))
    setOpenSlot(null)
  }
  /** Puts one or more people on a slot in one step — the map picker sends
   *  everybody ticked at once. */
  const assign = (row: Demand, workerIds: string[], extra = false) => {
    const placeId = placeOf(row.placeId)
    if (placeId !== row.placeId) patchSlot(row.id, { placeId })
    setPlan(cur => [
      ...cur,
      ...workerIds.map(workerId => ({
        id: tempId('r'),
        vacancyId: vacancy.id,
        date: row.date,
        placeId,
        section: row.section,
        workerId,
        extra,
        extraReason: extra ? 'Beyond the client order' : null,
        standingId: null,
        start: row.start,
        end: row.end,
        outcome: 'planned' as const,
        actualEnd: null,
        coversShiftId: null,
        note: null,
      })),
    ])
  }
  const unassign = (id: string) => setPlan(cur => cur.filter(s => s.id !== id))
  /* The number beside a name is its position, so the position has to be
     movable — the same up/down the old warehouse schedule had. Order is the
     array order; swapping two entries is the whole operation. */
  const move = (row: Demand, id: string, delta: number) =>
    setPlan(cur => {
      const group = cur.filter(s => s.vacancyId === vacancy.id && s.date === row.date && sameSlot(s, row))
      const at = group.findIndex(s => s.id === id)
      const to = at + delta
      if (at < 0 || to < 0 || to >= group.length) return cur
      const a = cur.indexOf(group[at]),
        b = cur.indexOf(group[to])
      const next = [...cur]
      next[a] = group[to]
      next[b] = group[at]
      return next
    })
  const toggleExtra = (id: string) =>
    setPlan(cur =>
      cur.map(s =>
        s.id === id ? { ...s, extra: !s.extra, extraReason: s.extra ? null : 'Beyond the client order' } : s,
      ),
    )
  const setOffer = (workerId: string, date: string, status: 'offered' | 'declined' | null) =>
    setOfferLog(cur => {
      const rest = cur.filter(
        o => !(o.vacancyId === vacancy.id && o.workerId === workerId && (o.date === date || o.date === null)),
      )
      return status
        ? [
            ...rest,
            {
              id: tempId('o'),
              vacancyId: vacancy.id,
              workerId,
              date,
              status,
              note: null,
              at: new Date().toISOString(),
            },
          ]
        : rest
    })
  const offerFor = (workerId: string, date: string) =>
    offerLog.find(
      o => o.vacancyId === vacancy.id && o.workerId === workerId && (o.date === date || o.date === null),
    ) ?? null

  const active = rows.find(r => r.id === openSlot) ?? null
  /* No times, a start only, or a full window — decided once for the vacancy
     and read by every row below. */
  const timing = timingOf(vacancy.schedule)

  if (!scheduleReady) {
    return (
      <Panel className="full-panel">
        <StateBlock
          title={scheduleLoadError ? t('Could not load the saved schedule') : t('Loading saved schedule')}
          description={scheduleLoadError || 'The saved shifts and assignments are being loaded.'}
        />
        {scheduleLoadError && (
          <div className="form-footer">
            <button className="button button-secondary" onClick={() => setLoadRetry(value => value + 1)}>
              {t('Try again')}
            </button>
          </div>
        )}
      </Panel>
    )
  }

  return (
    <>
      {/* Who normally works here. For a one-person job this panel is the whole
          schedule: set it up once and the days look after themselves. */}
      <div className="standing-panel">
        <div className="standing-head">
          <h3>{t('Who normally works here')}</h3>
          <div className="standing-actions">
            <button className="button button-secondary" onClick={() => setAddingPerson(true)}>
              <Plus />
              {t('Add person')}
            </button>
            <button
              className="button button-secondary"
              onClick={() => {
                fillFromArrangements()
              }}
              title={t('Create shifts from these arrangements for the days shown')}
            >
              <Wand2 />
              {t('Create shifts for {range}', {
                range:
                  days.length === 1
                    ? formatDate(days[0])
                    : `${formatDate(days[0])} – ${formatDate(days[days.length - 1])}`,
              })}
            </button>
          </div>
        </div>
        {!liveArrangements.length && (
          <p className="sched-empty">
            {t('Nobody is standing on this vacancy — people are added to individual days below.')}
          </p>
        )}
        {liveArrangements.map(a => {
          const w = workers.find(x => x.id === a.workerId)
          return (
            <div className="standing-row" key={a.id}>
              <span>
                <strong>
                  <Link href={`/people/${a.workerId}`}>{w?.fullName ?? '—'}</Link>
                </strong>
                <small>
                  {a.weekdays.map(d => weekdayLabel[d]).join(' ')}
                  {timing === 'none'
                    ? ''
                    : ` · ${a.start ?? t('slot time')}${timing === 'window' && a.end ? `–${a.end}` : ''}`}
                  {[placeName(vacancy, a.placeId), a.section].filter(Boolean).length
                    ? ` · ${[placeName(vacancy, a.placeId), a.section].filter(Boolean).join(' · ')}`
                    : ''}
                  {a.to ? ` · until ${formatDate(a.to)}` : ''}
                  {a.note ? ` · ${a.note}` : ''}
                </small>
              </span>
              <button className="button button-secondary button-small" onClick={() => setReplacing(a)}>
                <Repeat />
                {t('Replace')}
              </button>
              <button
                className="button button-secondary button-small"
                onClick={async () => {
                  /* Ending the arrangement used to leave every shift it had
                     already made, so the person stayed on the schedule. */
                  const future = mine(plan).filter(
                    s =>
                      s.workerId === a.workerId &&
                      s.date > today &&
                      (s.standingId === a.id ||
                        (a.weekdays.includes(weekdayOf(s.date)) &&
                          sameSlot(s, { placeId: placeOf(a.placeId), section: a.section }))),
                  )
                  if (
                    future.length &&
                    !(await confirm(
                      t('End {name}? Their {count} planned shifts after today are removed too.', {
                        name: w?.fullName ?? '',
                        count: future.length,
                      }),
                      { confirmLabel: 'End' },
                    ))
                  )
                    return
                  const removed = new Set(future.map(s => s.id))
                  setPlan(cur => cur.filter(s => !removed.has(s.id)))
                  setArrangements(cur => cur.map(x => (x.id === a.id ? { ...x, to: today } : x)))
                }}
              >
                {t('End')}
              </button>
            </div>
          )
        })}
      </div>

      <p className="dialog-note sched-save-note" role={scheduleSaveError ? 'alert' : 'status'}>
        {scheduleSaveError ? (
          <>
            {t('Schedule changes were not saved:')} {t(scheduleSaveError)}{' '}
            {saveUndone ? (
              t('That change was undone.')
            ) : (
              <button className="text-button" onClick={() => setSaveRetry(value => value + 1)}>
                {t('Retry save')}
              </button>
            )}
          </>
        ) : (
          t(scheduleSaveStatus || 'Schedule saves automatically')
        )}
      </p>

      {/* The plan is always open: it is what this tab is for. */}
      <div className="sched-header">
        <div className="sched-header-title">
          <h2>{t('Schedule')}</h2>
          <p>{t('View and manage the day-by-day plan')}</p>
        </div>
        <div className="seg sched-views">
          {(['day', 'week', 'month'] as View[]).map(v => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)}>
              {v === 'day' ? t('Day') : v === 'week' ? t('Week') : t('Month')}
            </button>
          ))}
        </div>
        <div className="dispatch-datenav sched-datenav">
          <button className="icon-button" onClick={() => step(-1)} aria-label={t('Back')}>
            <ChevronLeft />
          </button>
          <span className="week-label">
            <CalendarDays />
            {view === 'day'
              ? formatDate(anchor)
              : view === 'week'
                ? `${t('Week {week}', { week: week.week })} · ${formatDate(days[0])} – ${formatDate(days[6])}`
                : monthTitle(anchor, locale)}
          </span>
          <button className="icon-button" onClick={() => step(1)} aria-label={t('Forward')}>
            <ChevronRight />
          </button>
        </div>
        <button
          className="button button-secondary sched-today"
          onClick={() => setAnchor(today)}
          disabled={view === 'month' ? anchor.slice(0, 7) === today.slice(0, 7) : days.includes(today)}
        >
          {t('Today')}
        </button>
        <button className="button button-primary sched-share" onClick={() => setSharing(true)}>
          <Share2 />
          {t('Share view')}
        </button>
      </div>
          {dateStorageError && (
            <p className="dialog-note schedule-storage-note" role="status">
              {t('The selected date may not persist in this browser:')} {dateStorageError}
            </p>
          )}

          {view === 'month' ? (
            <ScheduleMonth
              vacancyId={vacancy.id}
              anchor={anchor}
              today={today}
              workingDay={date => slotsOn(date).length > 0}
              staffing={date => {
                const need = needOn(date)
                return need.needed > 0 ? { filled: need.staffed, ordered: need.needed, short: need.short } : null
              }}
              onOpenDay={date => {
                setAnchor(date)
                changeView('day')
              }}
              onAddSlot={date => setDraft({ date })}
            />
          ) : (
          <div className={`sched-layout layout-${view}`}>
            <input {...weekPhotos.inputProps} />
            {weekPhotos.error && (
              <p className="dialog-note" role="alert">
                {t(weekPhotos.error)}
              </p>
            )}
            {/* A week is seven compact columns in one row (a column on a phone);
                a day is the wide editor with the full photo report. */}
            <div className={`sched-days view-${view}`}>
              {days.map(date => {
                const slots = slotsOn(date)
                const compact = view === 'week'
                const need = needOn(date)
                return (
                  <Panel key={date} className={`sched-day ${date === today ? 'today' : ''} ${need.short ? 'short' : ''}`}>
                    <div className="sched-day-head">
                      <div>
                        <strong>{weekdayLabel[weekdayOf(date)]}</strong>
                        <span>{formatDate(date)}</span>
                        {need.short && (
                          <em className="day-short" title={t('{staffed} of {needed} people', { staffed: need.staffed, needed: need.needed })}>
                            {t('{count} short', { count: need.needed - need.staffed })}
                          </em>
                        )}
                      </div>
                      <div className="sched-day-actions">
                        {vacancy.requiresAvailableList &&
                          (compact ? (
                            <button
                              className="icon-button"
                              onClick={() => setAvailableListDate(date)}
                              aria-label={t('Available people')}
                              title={t('Available people')}
                            >
                              <Users />
                            </button>
                          ) : (
                            <button
                              className="button button-secondary button-small"
                              onClick={() => setAvailableListDate(date)}
                            >
                              <Users />
                              {t('Available people')}
                            </button>
                          ))}
                        {!compact && (
                          <button className="add-shift" onClick={() => setDraft({ date })}>
                            <Plus />
                            {t('Add slot')}
                          </button>
                        )}
                      </div>
                    </div>
                    {!slots.length && !compact && <p className="sched-empty">{t('Not a working day.')}</p>}
                    {slots.map(row => {
                      const shifts = shiftsIn(row)
                      const counted = staffed(row)
                      return (
                        <div key={row.id} className={`sched-slot ${openSlot === row.id ? 'open' : ''}`}>
                          <div className="sched-slot-head">
                            <strong>{slotTitle(vacancy, row)}</strong>
                            {/* Times are edited here rather than only inherited from the
                            pattern: Ziggo Dome picks a different start every day, and
                            a job that keeps no times shows no fields at all. */}
                            {timing !== 'none' && (
                              <span className="sched-time">
                                <TimeField
                                  value={row.start}
                                  label="Start time"
                                  onChange={start => patchSlot(row.id, { start })}
                                />
                                {timing === 'window' && (
                                  <>
                                    <i>–</i>
                                    <TimeField
                                      value={row.end}
                                      label="End time"
                                      onChange={end => patchSlot(row.id, { end })}
                                    />
                                  </>
                                )}
                              </span>
                            )}
                            <span className="headcount">
                              <input
                                type="number"
                                min={0}
                                value={row.headcount}
                                aria-label={t('People ordered')}
                                onChange={e =>
                                  patchSlot(row.id, { headcount: Math.max(0, Number(e.target.value) || 0) })
                                }
                              />
                              <small>{t('ordered')}</small>
                            </span>
                            <span
                              title={
                                counted > row.headcount
                                  ? t('More people than ordered')
                                  : counted < row.headcount
                                    ? t('Fewer people than ordered')
                                    : undefined
                              }
                            >
                              <Badge
                                tone={counted < row.headcount ? 'urgent' : counted > row.headcount ? 'orange' : 'green'}
                              >
                                {counted}/{row.headcount}
                              </Badge>
                            </span>
                            <button
                              className="planner-clear"
                              onClick={async () => {
                                if (
                                  shifts.length &&
                                  !(await confirm(
                                    t('Remove {slot} on {date}? The {count} people on it are taken off too.', {
                                      slot: t(slotTitle(vacancy, row)),
                                      date: formatDate(row.date),
                                      count: shifts.length,
                                    }),
                                    { confirmLabel: 'Remove slot' },
                                  ))
                                )
                                  return
                                dropSlot(row.id)
                              }}
                              aria-label={t('Remove slot')}
                            >
                              ×
                            </button>
                          </div>
                          {row.note && <p className="sched-note">{row.note}</p>}
                          <div className="sched-names">
                            {shifts.map((s, index) => {
                              const w = workers.find(x => x.id === s.workerId)
                              const away = onLeave(s)
                              const clash = clashOf(s)
                              const clashJob = clash ? jobLabel(clash) : ''
                              const also = clash ? [] : alsoOf(s)
                              return (
                                <span
                                  key={s.id}
                                  className={`name-chip ${s.extra ? 'extra' : ''} ${away ? 'on-leave' : ''} ${clash ? 'clash' : ''} ${also.length ? 'also' : ''}`}
                                  title={
                                    away
                                      ? t('On leave this day — not counted, find a replacement')
                                      : clash
                                        ? t('Cannot do both: also on {job}', { job: clashJob })
                                        : also.length
                                          ? t('Also works that day: {jobs}', { jobs: also.map(jobLabel).join('; ') })
                                          : (s.note ?? s.extraReason ?? undefined)
                                  }
                                >
                                  {/* Numbering restarts at 1 for every slot, exactly as on the
                                  old warehouse schedule: each place and section counts
                                  its own people. */}
                                  <b className="chip-no">{index + 1}.</b>
                                  <Link href={`/people/${s.workerId}`} title={w?.fullName}>
                                    {w?.fullName ?? '—'}
                                  </Link>
                                  {s.extra && <em>{t('extra')}</em>}
                                  {s.note && !s.extra && <em>{t('cover')}</em>}
                                  {away && <em className="chip-warning">{t('on leave')}</em>}
                                  {clash && !away && <em className="chip-warning">{t('double-booked')}</em>}
                                  {!clash && !away && also.length > 0 && (
                                    <em className="chip-also">{t('also {job}', { job: jobLabel(also[0]) })}</em>
                                  )}
                                  <span className="chip-actions">
                                  <button
                                    onClick={() => move(row, s.id, -1)}
                                    disabled={index === 0}
                                    aria-label={t('Move up')}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => move(row, s.id, 1)}
                                    disabled={index === shifts.length - 1}
                                    aria-label={t('Move down')}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    onClick={() => toggleExtra(s.id)}
                                    title={t('Beyond the client order — worked, not billed')}
                                  >
                                    ±
                                  </button>
                                  <button onClick={() => unassign(s.id)} aria-label={t('Remove')}>
                                    ×
                                  </button>
                                  </span>
                                </span>
                              )
                            })}
                            <button
                              className="add-shift"
                              onClick={() => setOpenSlot(openSlot === row.id ? null : row.id)}
                            >
                              <Plus />
                              {openSlot === row.id ? t('Close') : t('Add people')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {compact ? (
                      <div className="sched-day-foot">
                        <button className="month-add" onClick={() => setDraft({ date })}>
                          <Plus />
                          {t('Add slot')}
                        </button>
                        {slots.length > 0 && (
                          <DayReportCard
                            date={date}
                            photos={weekPhotos.counts[date] ?? 0}
                            uploading={weekPhotos.uploading === date}
                            busy={weekPhotos.uploading !== null}
                            onOpen={() => {
                              setAnchor(date)
                              changeView('day')
                            }}
                            onPick={() => weekPhotos.pick(date)}
                          />
                        )}
                      </div>
                    ) : (
                      <WorkdayReport vacancyId={vacancy.id} date={date} />
                    )}
                  </Panel>
                )
              })}
            </div>

          </div>
          )}

      {active && (
        <SlotPicker
          vacancy={vacancy}
          row={active}
          plan={plan}
          staffed={staffed(active)}
          offerFor={offerFor}
          visibility={candidateVisibility}
          setVisibility={setCandidateVisibility}
          onAssign={ids => assign(active, ids)}
          onOffer={(ids, status) => ids.forEach(id => setOffer(id, active.date, status))}
          onClose={() => setOpenSlot(null)}
        />
      )}

      {confirmElement}
      {draft && (
        <SlotDialog
          vacancy={vacancy}
          date={draft.date}
          onCancel={() => setDraft(null)}
          onSave={(placeId, section, headcount, start, end) => {
            addSlot(draft.date, placeId, section, headcount, start, end)
            setDraft(null)
          }}
        />
      )}
      {addingPerson && (
        <PersonDialog
          vacancy={vacancy}
          plan={plan}
          onCancel={() => setAddingPerson(false)}
          onSave={a => {
            setArrangements(cur => [...cur, a])
            /* Adding somebody to the vacancy IS putting them on its days —
             nobody adds a person and then wonders why the schedule is empty.
             The shifts are still ordinary shifts, so any single day can be
             changed or handed to somebody else afterwards. */
            fillFromArrangements([a])
            setAddingPerson(false)
          }}
        />
      )}
      {replacing && (
        <ReplaceDialog
          vacancy={vacancy}
          arrangement={replacing}
          plan={plan}
          onCancel={() => setReplacing(null)}
          onSave={(incoming, from, to, reason) => {
            replaceOver(replacing, incoming, from, to, reason)
            setReplacing(null)
          }}
        />
      )}
      {sharing && (
        <ShareView
          vacancy={vacancy}
          days={days}
          slotsOn={slotsOn}
          shiftsIn={shiftsIn}
          onClose={() => setSharing(false)}
        />
      )}
      {availableListDate && (
        <AvailablePeopleImage
          vacancy={vacancy}
          date={availableListDate}
          plan={plan}
          visibility={candidateVisibility}
          onClose={() => setAvailableListDate(null)}
        />
      )}
    </>
  )
}

function useCandidates(
  vacancy: Vacancy,
  date: string,
  slot: { placeId: string | null; section: string | null; start: string | null; end: string | null },
  plan: RosterEntry[],
) {
  const { leaves, vacancies, workers, travel: distances } = useWorkforceData()
  const travel = useMemo(() => travelIndex(distances), [distances])
  return useMemo(
    () =>
      workers
        .filter(w => w.status === 'active' && w.companyAccess.includes(vacancy.companyId))
        .map(w => {
          const probe: RosterEntry = {
            id: 'probe',
            vacancyId: vacancy.id,
            date,
            placeId: slot.placeId,
            section: slot.section,
            workerId: w.id,
            extra: false,
            extraReason: null,
            standingId: null,
            start: slot.start,
            end: slot.end,
            outcome: 'planned',
            actualEnd: null,
            coversShiftId: null,
            note: null,
          }
          /* Their other shifts that day, each judged by the one-hour rule
             (sameDayClash): "blocked" ones make the person unavailable,
             "possible" ones are shown so the dispatcher knows where else they
             are — they may leave early to make this one. */
          const sameDay = plan
            .filter(s => s.workerId === w.id && s.date === date && s.outcome !== 'cancelled')
            .map(s => ({
              job: `${vacancies.find(v => v.id === s.vacancyId)?.title ?? ''}${s.vacancyId === vacancy.id ? ` · ${slotTitle(vacancy, s)}` : ''}`,
              start: s.start,
              end: s.end,
              blocked: sameDayClash(s, probe) === 'blocked',
            }))
          const busy = sameDay.some(s => s.blocked)
          const onLeave = leaves.some(l => l.workerId === w.id && l.date === date)
          /* Already in this very slot: the same name twice on the client's sheet. */
          const duplicate = plan.some(
            s => s.workerId === w.id && s.date === date && s.vacancyId === vacancy.id && s.outcome !== 'cancelled' && sameSlot(s, slot),
          )
          /* A course is a standing weekly commitment, not a day off. */
          const onCourse = isCourseDay(w, date)
          /* Some sites cannot be reached without a car at the hours we staff
         them, so this is a hard block rather than a hint — being close by
         does not help if there is no way to get there at 05:30. */
          const noCar = vacancy.carOnly && w.hasCar === false
          return {
            w,
            busy,
            onLeave,
            noCar,
            duplicate,
            onCourse,
            requirements: assessWorkerRequirements(vacancy, w),
            elsewhere: assignmentOn(w.id, date, null, plan),
            sameDay,
            travel: travelFor(travel, w.id, vacancy.id),
          }
        }),
    [
      vacancy,
      date,
      slot.placeId,
      slot.section,
      slot.start,
      slot.end,
      plan,
      leaves,
      vacancies,
      workers,
      travel,
    ],
  )
}

/** Own transport as a filter rather than a hint.
 *
 *  A car is a hard block only where the site demands one (`vacancy.carOnly`).
 *  Everywhere else it becomes urgent on exactly one kind of day: a public
 *  transport strike, which in the Netherlands is announced a few days ahead
 *  and takes out whole regions. On that day the only useful list is the
 *  people who drive, so it is a switch — off by default, because on every
 *  other day filtering out two thirds of the pool is a way to lose good
 *  people. */
function CarFilter({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const { t } = useLanguage()
  return (
    <label className="checkbox-inline candidate-filter">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      {t('With car only')}
      <small>{t('For strike days.')}</small>
    </label>
  )
}

/** The map picker for one slot. A component of its own so the candidate
 *  hook runs only while the picker is open. */
function SlotPicker({
  vacancy,
  row,
  plan,
  staffed,
  offerFor,
  visibility,
  setVisibility,
  onAssign,
  onOffer,
  onClose,
}: {
  vacancy: Vacancy
  row: Demand
  plan: RosterEntry[]
  staffed: number
  offerFor: (workerId: string, date: string) => Offer | null
  visibility: CandidateVisibility[]
  setVisibility: (update: (current: CandidateVisibility[]) => CandidateVisibility[]) => void
  onAssign: (workerIds: string[]) => void
  onOffer: (workerIds: string[], status: 'offered' | 'declined' | null) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const candidates = useCandidates(vacancy, row.date, row, plan)
  return (
    <PeoplePicker
      vacancy={vacancy}
      title={t('Who can work')}
      subtitle={[
        t(slotTitle(vacancy, row)),
        `${weekdayLabel[weekdayOf(row.date)]} ${formatDate(row.date)}`,
        slotTimeLabel(vacancy, row),
      ]
        .filter(Boolean)
        .join(' · ')}
      date={row.date}
      ordered={row.headcount}
      staffed={staffed}
      candidates={candidates}
      visibility={visibility}
      setVisibility={setVisibility}
      offerFor={offerFor}
      onAssign={onAssign}
      onOffer={onOffer}
      onClose={onClose}
    />
  )
}

function AvailablePeopleImage({
  vacancy,
  date,
  plan,
  visibility,
  onClose,
}: {
  vacancy: Vacancy
  date: string
  plan: RosterEntry[]
  visibility: CandidateVisibility[]
  onClose: () => void
}) {
  const { t } = useLanguage()
  const { closing, close: dismiss } = useExit(onClose)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageError, setImageError] = useState('')
  const candidates = useCandidates(
    vacancy,
    date,
    { placeId: null, section: null, start: null, end: null },
    plan,
  )
  const people = useMemo(
    () =>
      candidates
        .filter(
          candidate =>
            !candidate.busy &&
            !candidate.onLeave &&
            !candidate.noCar &&
            !candidate.duplicate &&
            !candidate.onCourse &&
            candidate.requirements.blocked.length === 0,
        )
        .filter(candidate => {
          const daySetting = visibility.find(
            item => item.vacancyId === vacancy.id && item.workerId === candidate.w.id && item.date === date,
          )
          if (daySetting) return !daySetting.hidden
          return !visibility.find(
            item => item.vacancyId === vacancy.id && item.workerId === candidate.w.id && item.date === null,
          )?.hidden
        })
        .map(candidate => candidate.w.fullName)
        .sort((a, b) => a.localeCompare(b)),
    [candidates, date, vacancy.id, visibility],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rowHeight = 44
    canvas.width = 1080
    canvas.height = Math.max(240, 152 + people.length * rowHeight)
    const context = canvas.getContext('2d')
    if (!context) {
      setImageError('This browser could not prepare the image.')
      return
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#172033'
    context.font = '700 30px Arial, sans-serif'
    context.fillText(vacancy.title, 48, 52)
    context.fillStyle = '#526078'
    context.font = '18px Arial, sans-serif'
    context.fillText(
      `${formatDate(date)} · ${people.length} available ${people.length === 1 ? 'person' : 'people'}`,
      48,
      86,
    )
    context.strokeStyle = '#dbe2ea'
    context.beginPath()
    context.moveTo(48, 112)
    context.lineTo(canvas.width - 48, 112)
    context.stroke()
    people.forEach((name, index) => {
      const y = 148 + index * rowHeight
      context.fillStyle = '#526078'
      context.font = '600 18px Arial, sans-serif'
      context.fillText(`${index + 1}.`, 54, y)
      context.fillStyle = '#172033'
      context.font = '20px Arial, sans-serif'
      context.fillText(name, 104, y)
      if (index < people.length - 1) {
        context.strokeStyle = '#eef1f5'
        context.beginPath()
        context.moveTo(48, y + 14)
        context.lineTo(canvas.width - 48, y + 14)
        context.stroke()
      }
    })
    setImageError('')
  }, [date, people, vacancy.title])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (!blob) {
        setImageError('Could not export the image. Please try again.')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${vacancy.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}-available-people.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog dialog-wide available-people-dialog" onClick={event => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h2>{t('Available people')}</h2>
            <p>
              {formatDate(date)} · {t('{count} people, numbered for the client', { count: people.length })}
            </p>
          </div>
          <button className="icon-button" onClick={dismiss} aria-label={t('Close')}>
            <X />
          </button>
        </div>
        <div className="available-image-preview">
          <canvas ref={canvasRef} aria-label={`Numbered available people for ${formatDate(date)}`} />
        </div>
        {imageError && (
          <p className="dialog-note" role="alert">
            {imageError}
          </p>
        )}
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>
            {t('Close')}
          </button>
          <button className="button button-primary" onClick={download}>
            <Download />
            {t('Download PNG')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReplaceDialog({
  vacancy,
  arrangement,
  plan,
  onCancel,
  onSave,
}: {
  vacancy: Vacancy
  arrangement: StandingAssignment
  plan: RosterEntry[]
  onCancel: () => void
  onSave: (incoming: string, from: string, to: string, reason: string) => void
}) {
  const { t } = useLanguage()
  const today = useToday()
  const { leaves, workers } = useWorkforceData()
  const { closing, close: dismiss } = useExit(onCancel)
  const outgoing = workers.find(w => w.id === arrangement.workerId)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [carOnly, setCarOnly] = useState(false)
  /* The working days actually touched by this replacement — not every day in
     the range, because the arrangement only covers some weekdays. */
  const touchedDays = useMemo(() => {
    const out: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1))
      if (arrangement.weekdays.includes(weekdayOf(d))) out.push(d)
    return out
  }, [from, to, arrangement.weekdays])
  /* Availability is judged over the WHOLE range. Judging it on the first day
     alone was the hole through which somebody could be put on a job they
     already work later in the week — twice on the same day. */
  const candidates = useCandidates(vacancy, from, arrangement, plan)
    .filter(c => c.w.id !== arrangement.workerId)
    .filter(c => !carOnly || c.w.hasCar === true)
    .map(c => ({ ...c, span: availabilityOver(c.w, touchedDays, vacancy.id, plan, leaves) }))
    .sort(
      (a, b) =>
        Number(a.requirements.blocked.length > 0) - Number(b.requirements.blocked.length > 0) ||
        Number(!a.span.fullyFree) - Number(!b.span.fullyFree) ||
        a.span.taken.length - b.span.taken.length ||
        (a.travel?.km ?? 1e9) - (b.travel?.km ?? 1e9),
    )
  const dayCount = Math.max(
    0,
    Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000) +
      1,
  )

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h2>{t('Replace {name}', { name: outgoing?.fullName ?? '' })}</h2>
            <p>
              {t(
                'Only the days in the range change. The standing arrangement stays, so {name} returns by itself afterwards.',
                { name: outgoing?.fullName?.split(' ')[0] ?? '' },
              )}
            </p>
          </div>
          <button className="icon-button" onClick={dismiss} aria-label={t('Close')}>
            <X />
          </button>
        </div>
        <div className="dialog-row">
          <label>
            {t('From')}
            <DateField
              value={from}
              label={t('From')}
              onChange={value => {
                setFrom(value)
                if (value > to) setTo(value)
              }}
            />
          </label>
          <label>
            {t('Until')}
            <DateField value={to} min={from} label={t('Until')} onChange={setTo} />
          </label>
          <label>
            {t('Reason (optional)')}
            <input
              value={reason}
              placeholder={t('Sick, holiday…')}
              onChange={e => setReason(e.target.value)}
            />
          </label>
        </div>
        <p className="dialog-note">
          {t(
            dayCount === 1
              ? 'One day — only the working days of this arrangement ({weekdays}) are touched, {touched} in this range.'
              : '{days} days — only the working days of this arrangement ({weekdays}) are touched, {touched} in this range.',
            {
              days: dayCount,
              weekdays: arrangement.weekdays.map(d => t(weekdayLabel[d])).join(' '),
              touched: touchedDays.length,
            },
          )}
          {pick &&
            (() => {
              const chosen = candidates.find(c => c.w.id === pick)
              return chosen && chosen.span.taken.length
                ? ` ${chosen.span.taken.length} of them stay with ${workers.find(w => w.id === arrangement.workerId)?.firstName ?? 'the original person'} — the cover is not free on those.`
                : ''
            })()}
        </p>
        <div className="candidate-list">
          {!vacancy.carOnly && (
            <CarFilter
              on={carOnly}
              onChange={on => {
                setCarOnly(on)
                setPick(null)
              }}
            />
          )}
          {!candidates.length && (
            <StateBlock
              title={carOnly ? t('Nobody here has a car') : t('Nobody else holds this contract')}
              description={
                carOnly
                  ? 'Switch the filter off to see everyone.'
                  : 'No other active worker has access to this client.'
              }
            />
          )}
          {candidates.map(({ w, noCar, travel, span, requirements }) => {
            /* Nobody free on a single one of the days is no use as cover. */
            const useless = noCar || requirements.blocked.length > 0 || !span.free.length
            return (
              <button
                key={w.id}
                type="button"
                className={`candidate-row ${pick === w.id ? 'selected' : ''}`}
                disabled={useless}
                onClick={() => setPick(w.id)}
              >
                <span>
                  <strong>{w.fullName}</strong>
                  <small>
                    {travel ? `${travel.km} km · ${travel.minutes} min` : t('no travel on record')}
                    {noCar ? t(' · no car') : ''}
                    {!vacancy.carOnly && (w.hasCar ? t(' · car') : t(' · no car'))}
                    {[...requirements.blocked, ...requirements.warnings]
                      .map(reason => ` · ${reason}`)
                      .join('')}
                    <br />
                    {availabilityLabel(span, t)}
                  </small>
                </span>
                <Badge
                  tone={
                    noCar || requirements.blocked.length
                      ? 'orange'
                      : span.fullyFree
                        ? 'green'
                        : span.free.length
                          ? 'blue'
                          : 'orange'
                  }
                >
                  {noCar
                    ? t('No car')
                    : requirements.blocked.length
                      ? t('Does not meet requirements')
                      : span.fullyFree
                        ? t('Free')
                        : span.free.length
                          ? `${span.free.length}/${span.days.length}`
                          : t('Unavailable')}
                </Badge>
              </button>
            )
          })}
        </div>
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
            disabled={!pick}
            onClick={() => onSave(pick!, from, to, reason.trim())}
          >
            {t('Replace')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** How far ahead "the whole vacancy" is judged when it has no end date. Four
 *  weeks is what the office plans against; anything further is guesswork. */
const HORIZON_DAYS = 28

function PersonDialog({
  vacancy,
  plan,
  onCancel,
  onSave,
}: {
  vacancy: Vacancy
  plan: RosterEntry[]
  onCancel: () => void
  onSave: (a: StandingAssignment) => void
}) {
  const { t } = useLanguage()
  const today = useToday()
  const { leaves, workers, travel: distances } = useWorkforceData()
  const travel = useMemo(() => travelIndex(distances), [distances])
  const { closing, close: dismiss } = useExit(onCancel)
  const [workerId, setWorkerId] = useState('')
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    vacancy.schedule.weekdays.length ? vacancy.schedule.weekdays : ['mon', 'tue', 'wed', 'thu', 'fri'],
  )
  const [placeId, setPlaceId] = useState<string | null>(vacancy.places[0]?.id ?? null)
  const [section, setSection] = useState('')
  const [carOnly, setCarOnly] = useState(false)
  const eligible = workers.filter(w => w.status === 'active' && w.companyAccess.includes(vacancy.companyId))

  /* The days this arrangement would actually use: the chosen weekdays, inside
     the vacancy's own period, out to the horizon. Availability is judged
     against these and nothing else — being busy on a Sunday is irrelevant to
     an arrangement that never works Sundays. */
  const startFromDate = vacancy.startDate > today ? vacancy.startDate : today
  const days = useMemo(() => {
    const last =
      vacancy.endDate && vacancy.endDate < addDays(startFromDate, HORIZON_DAYS)
        ? vacancy.endDate
        : addDays(startFromDate, HORIZON_DAYS)
    const out: string[] = []
    for (let d = startFromDate; d <= last; d = addDays(d, 1)) if (weekdays.includes(weekdayOf(d))) out.push(d)
    return out
  }, [startFromDate, vacancy.endDate, weekdays])

  const candidates = eligible
    .filter(w => !carOnly || w.hasCar === true)
    .map(w => ({
      w,
      span: availabilityOver(w, days, vacancy.id, plan, leaves),
      travel: travelFor(travel, w.id, vacancy.id),
      noCar: vacancy.carOnly && w.hasCar === false,
      requirements: assessWorkerRequirements(vacancy, w),
    }))
    /* Free for the whole run first, then whoever frees up soonest, then by
       distance — the order the office would sort them in by hand. */
    .sort(
      (a, b) =>
        Number(a.noCar || a.requirements.blocked.length > 0) -
          Number(b.noCar || b.requirements.blocked.length > 0) ||
        Number(!a.span.fullyFree) - Number(!b.span.fullyFree) ||
        (a.span.freeFrom ?? '9999').localeCompare(b.span.freeFrom ?? '9999') ||
        a.span.taken.length - b.span.taken.length ||
        (a.travel?.km ?? 1e9) - (b.travel?.km ?? 1e9),
    )

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>{t('Add a standing person')}</h2>
          <button className="icon-button" onClick={dismiss} aria-label={t('Close')}>
            <X />
          </button>
        </div>
        <label>{t('Working days')}</label>
        <div className="seg">
          {WEEKDAYS.map(d => (
            <button
              key={d}
              className={weekdays.includes(d) ? 'active' : ''}
              type="button"
              onClick={() => {
                setWeekdays(cur => (cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]))
                setWorkerId('')
              }}
            >
              {weekdayLabel[d]}
            </button>
          ))}
        </div>
        <p className="dialog-note">
          {vacancy.endDate
            ? t('Judged over {count} working days up to {date}.', {
                count: days.length,
                date: formatDate(vacancy.endDate),
              })
            : t(
                'Judged over {count} working days — the next four weeks, since this vacancy has no end date.',
                { count: days.length },
              )}
        </p>
        <label>{t('Person')}</label>
        {!vacancy.carOnly && <CarFilter on={carOnly} onChange={setCarOnly} />}
        {/* A dropdown answers "who exists". The question here is who is free,
            and if not now then from when — so the list says it. */}
        <div className="candidate-list">
          {candidates.map(({ w, span, travel, noCar, requirements }) => (
            <button
              key={w.id}
              type="button"
              className={`candidate-row ${workerId === w.id ? 'selected' : ''}`}
              disabled={noCar || requirements.blocked.length > 0 || !span.free.length}
              onClick={() => setWorkerId(w.id)}
            >
              <span>
                <strong>{w.fullName}</strong>
                <small>
                  {travel ? `${travel.km} km · ${travel.minutes} min` : t('no travel on record')}
                  {w.courseDays.length ? ` · course ${w.courseDays.map(d => weekdayLabel[d]).join(' ')}` : ''}
                  {noCar ? t(' · no car — this site needs one') : ''}
                  {[...requirements.blocked, ...requirements.warnings].map(reason => ` · ${reason}`).join('')}
                  <br />
                  {availabilityLabel(span, t)}
                </small>
              </span>
              <Badge
                tone={
                  noCar || requirements.blocked.length
                    ? 'orange'
                    : span.fullyFree
                      ? 'green'
                      : span.free.length
                        ? 'blue'
                        : 'orange'
                }
              >
                {noCar
                  ? t('No car')
                  : requirements.blocked.length
                    ? t('Does not meet requirements')
                    : span.fullyFree
                      ? t('Free')
                      : span.free.length
                        ? `${span.free.length}/${span.days.length}`
                        : t('Busy')}
              </Badge>
            </button>
          ))}
          {!candidates.length && (
            <StateBlock
              title="Nobody holds this contract"
              description="No active worker has access to this client."
            />
          )}
        </div>
        {vacancy.places.length > 0 && (
          <label>
            {t('Place')}
            <select value={placeId ?? ''} onChange={e => setPlaceId(e.target.value || null)}>
              {vacancy.places.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('Section (optional)')}
          <input value={section} onChange={e => setSection(e.target.value)} placeholder={t('Inbound…')} />
        </label>
        <p className="dialog-note">
          {t(
            'The chosen days are filled in straight away; days that already have somebody are left alone. Each day stays an ordinary shift afterwards, so one of them can be swapped without touching the arrangement.',
          )}
        </p>
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
            disabled={!workerId || !weekdays.length}
            onClick={() =>
              onSave({
                id: tempId('sa'),
                vacancyId: vacancy.id,
                workerId,
                placeId,
                section: section.trim() || null,
                weekdays,
                start: null,
                end: null,
                from: vacancy.startDate > today ? vacancy.startDate : today,
                to: null,
                note: null,
              })
            }
          >
            {t('Add')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SlotDialog({
  vacancy,
  date,
  onCancel,
  onSave,
}: {
  vacancy: Vacancy
  date: string
  onCancel: () => void
  onSave: (
    placeId: string | null,
    section: string,
    headcount: number,
    start: string | null,
    end: string | null,
  ) => void
}) {
  const { t } = useLanguage()
  const { closing, close: dismiss } = useExit(onCancel)
  const [placeId, setPlaceId] = useState<string | null>(vacancy.places[0]?.id ?? null)
  const [section, setSection] = useState('')
  const [headcount, setHeadcount] = useState(
    vacancy.schedule.headcount.kind === 'fixed'
      ? vacancy.schedule.headcount.count
      : vacancy.schedule.headcount.kind === 'perDate'
        ? vacancy.schedule.headcount.typical
        : 1,
  )
  const timing = timingOf(vacancy.schedule)
  const day = weekdayOf(date)
  /* Prefilled from the pattern where the pattern knows, blank where the day
     decides — a Ziggo start is chosen here, a warehouse start is already
     right and nobody retypes it. */
  const [start, setStart] = useState(startFor(vacancy.schedule.start, day) ?? '')
  const [end, setEnd] = useState(endFor(vacancy.schedule.end, day) ?? '')
  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>{t('Order people on {date}', { date: formatDate(date) })}</h2>
          <button className="icon-button" onClick={dismiss} aria-label={t('Close')}>
            <X />
          </button>
        </div>
        {vacancy.places.length > 0 && (
          <label>
            {t('Place')}
            <select value={placeId ?? ''} onChange={e => setPlaceId(e.target.value || null)}>
              {vacancy.places.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('Section (optional)')}
          <input
            value={section}
            placeholder={t('Inbound, Outbound…')}
            onChange={e => setSection(e.target.value)}
          />
        </label>
        <p className="dialog-note">
          {t(
            'A section is only written when the client asks for one. Conakryweg is ordered with none, and that is normal.',
          )}
        </p>
        <label>
          {t('People')}
          <input
            type="number"
            min={0}
            value={headcount}
            onChange={e => setHeadcount(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        {timing !== 'none' && (
          <div className="dialog-row">
            <label>
              {timing === 'start' ? t('Start time') : t('From')}
              <TimeField value={start} label="Start time" onChange={v => setStart(v ?? '')} />
            </label>
            {timing === 'window' && (
              <label>
                {t('Until')}
                <TimeField value={end} label="End time" onChange={v => setEnd(v ?? '')} />
              </label>
            )}
          </div>
        )}
        {timing === 'start' && (
          <p className="dialog-note">
            {t(
              'No end time on this job — people leave when the work is done, so the rest of the day stays blocked for them.',
            )}
          </p>
        )}
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
            onClick={() =>
              onSave(
                placeId,
                section,
                headcount,
                timing === 'none' ? null : start || null,
                timing === 'window' ? end || null : null,
              )
            }
          >
            {t('Add slot')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShareView({
  vacancy,
  days,
  slotsOn,
  shiftsIn,
  onClose,
}: {
  vacancy: Vacancy
  days: string[]
  slotsOn: (date: string) => Demand[]
  shiftsIn: (row: Demand) => RosterEntry[]
  onClose: () => void
}) {
  const { t } = useLanguage()
  const { workers } = useWorkforceData()
  const { closing, close: dismiss } = useExit(onClose)
  /* Only the days with something on them: an empty column is dead space in a
     screenshot, and dead space is what makes the names small in WhatsApp's
     preview. */
  const shown = days.filter(d => slotsOn(d).length)
  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="share-sheet" onClick={e => e.stopPropagation()}>
        <div className="share-head">
          <strong>{vacancy.title}</strong>
          <button className="icon-button" onClick={dismiss} aria-label={t('Close')}>
            <X />
          </button>
        </div>
        {!shown.length && (
          <StateBlock
            title="Nothing to share yet"
            description="No days in this view have anybody ordered on them."
          />
        )}
        <div
          className={`share-grid ${shown.length === 1 ? 'share-one' : shown.length <= 7 ? 'share-row' : 'share-wrap'}`}
        >
          {shown.map(date => (
            <div className="share-day" key={date}>
              <div className="share-date">
                {weekdayLabel[weekdayOf(date)]} {formatDate(date).replace(/ \d{4}$/, '')}
              </div>
              {slotsOn(date).map(row => (
                <div className="share-slot" key={row.id}>
                  <div className="share-slot-head">
                    {[
                      [placeName(vacancy, row.placeId), row.section].filter(Boolean).join(' · ') ||
                        'Whole site',
                      slotTimeLabel(vacancy, row),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <ol>
                    {shiftsIn(row).map((s, i) => (
                      <li key={s.id}>
                        <b>{i + 1}.</b> {workers.find(w => w.id === s.workerId)?.fullName ?? '—'}
                        {s.extra ? ' *' : ''}
                      </li>
                    ))}
                    {!shiftsIn(row).length && <li className="share-open">{t('— nobody yet —')}</li>}
                  </ol>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="share-foot">
          {t(
            'Everything fits one screenshot — the preview will not crop the last name. * = beyond the client order.',
          )}
        </p>
      </div>
    </div>
  )
}

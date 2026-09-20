'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Repeat, Share2, Wand2, X } from 'lucide-react'
import { Badge, Panel, StateBlock, TimeField, useExit } from './app-shell'
import { demand as seedDemand, leaves, offers as seedOffers, roster as seedRoster, standing as seedStanding, vacancies, workers } from '@/lib/mock-data'
import { alreadyOnVacancy, assignmentOn, availabilityLabel, availabilityOver, blockOn, endFor, isCourseDay, shiftsOverlap, slotTimeLabel, startFor, timingOf } from '@/lib/derive'
import { travelFor } from '@/lib/travel'
import { addDays, formatDate, isoWeek, weekDates, weekdayLabel, weekdayOf, WEEKDAYS, TODAY } from '@/lib/types'
import type { Demand, Offer, RosterEntry, StandingAssignment, Vacancy, Weekday } from '@/lib/types'

type View = 'day' | 'week' | 'month'

const placeName = (v: Vacancy, id: string | null) => (id ? v.places.find(p => p.id === id)?.name ?? id : null)
const slotTitle = (v: Vacancy, row: Demand) => [placeName(v, row.placeId), row.section].filter(Boolean).join(' · ') || 'Whole site'
const sameSlot = (a: { placeId: string | null; section: string | null }, b: { placeId: string | null; section: string | null }) =>
  a.placeId === b.placeId && (a.section ?? '') === (b.section ?? '')
const daysInMonth = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() }
const firstOfMonth = (iso: string, delta = 0) => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function VacancySchedule({ vacancy }: { vacancy: Vacancy }) {
  const [view, setView] = useState<View>(vacancy.schedule.horizon)
  /* Switching from a month to a week should land somewhere meaningful. The
     month anchor sits on the 1st, and the week of the 1st is mostly the
     previous month — so if today falls inside the month being viewed, hand
     the narrower view today instead. */
  const changeView = (next: View) => {
    if (view === 'month' && next !== 'month' && TODAY.slice(0, 7) === anchor.slice(0, 7)) setAnchor(TODAY)
    setView(next)
  }
  const [anchor, setAnchor] = useState(TODAY)
  const [rows, setRows] = useState<Demand[]>(seedDemand)
  const [plan, setPlan] = useState<RosterEntry[]>(seedRoster)
  const [arrangements, setArrangements] = useState<StandingAssignment[]>(seedStanding)
  const [offerLog, setOfferLog] = useState<Offer[]>(seedOffers)
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [draft, setDraft] = useState<{ date: string } | null>(null)
  const [replacing, setReplacing] = useState<StandingAssignment | null>(null)
  const [addingPerson, setAddingPerson] = useState(false)
  /* The schedule is the long part of this page, and most visits are about who
     normally works here rather than about a particular day — so it stays
     folded until asked for. */
  const [schedule, setSchedule] = useState(false)

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

  /* Months are stepped as months. Adding thirty days drifts and eventually
     skips one — February guarantees it. */
  const step = (n: number) => setAnchor(a =>
    view === 'day' ? addDays(a, n) : view === 'week' ? addDays(a, n * 7) : firstOfMonth(a, n))

  const mine = <T extends { vacancyId: string }>(xs: T[]) => xs.filter(x => x.vacancyId === vacancy.id)
  const slotsOn = (date: string) => mine(rows).filter(r => r.date === date)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '') || slotTitle(vacancy, a).localeCompare(slotTitle(vacancy, b)))
  const shiftsIn = (row: Demand) => mine(plan).filter(s => s.date === row.date && sameSlot(s, row))
  const liveArrangements = arrangements.filter(a => a.vacancyId === vacancy.id && (!a.to || a.to >= TODAY))

  /* Turning arrangements into shifts for the days on screen. Anything already
     there is left alone — generating must never overwrite a decision. */
  const fillFromArrangements = (only?: StandingAssignment[]) => {
    const source = only ?? arrangements
    /* A standing arrangement IS the order for this kind of work: nobody at a
       two-person evening clean sits down to "order two people every Monday".
       So filling creates the slot as well as the shifts — otherwise the shifts
       exist but have nowhere to show, which is what happened here first. An
       existing slot is never resized: that number came from the client. */
    const neededSlots: Demand[] = []
    for (const date of days) {
      const day = weekdayOf(date)
      const due = source.filter(a => a.vacancyId === vacancy.id && a.weekdays.includes(day)
        && a.from <= date && (!a.to || a.to >= date))
      for (const a of due) {
        const exists = mine(rows).some(r => r.date === date && sameSlot(r, a))
          || neededSlots.some(r => r.date === date && sameSlot(r, a))
        if (exists) continue
        const sameShape = due.filter(x => sameSlot(x, a)).length
        neededSlots.push({
          id: `d-auto-${vacancy.id}-${date}-${a.placeId ?? 'main'}-${a.section ?? ''}`,
          vacancyId: vacancy.id, date, placeId: a.placeId, section: a.section,
          headcount: sameShape,
          start: a.start ?? (vacancy.schedule.start.kind === 'fixed' ? vacancy.schedule.start.time : null),
          end: a.end ?? (vacancy.schedule.end.kind === 'fixed' ? vacancy.schedule.end.time : null),
          note: null,
        })
      }
    }
    if (neededSlots.length) setRows(cur => [...cur, ...neededSlots])

    setPlan(cur => {
    const made: RosterEntry[] = []
    for (const date of days) {
      const day = weekdayOf(date)
      for (const a of source.filter(x => x.vacancyId === vacancy.id)) {
        if (!a.weekdays.includes(day)) continue
        if (a.from > date || (a.to && a.to < date)) continue
        if (leaves.some(l => l.workerId === a.workerId && l.date === date)) continue
        const already = [...cur, ...made].some(s => s.vacancyId === vacancy.id && s.date === date && s.workerId === a.workerId)
        if (already) continue
        const slot = [...mine(rows), ...neededSlots].find(r => r.date === date && sameSlot(r, a))
        made.push({
          id: `r-gen-${a.id}-${date}`, vacancyId: vacancy.id, date,
          placeId: a.placeId, section: a.section, workerId: a.workerId,
          extra: false, extraReason: null, standingId: a.id,
          start: a.start ?? slot?.start ?? null, end: a.end ?? slot?.end ?? null,
          outcome: 'planned', actualEnd: null, coversShiftId: null, note: null,
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
  const replaceOver = (a: StandingAssignment, incoming: string, from: string, to: string, reason: string) =>
    setPlan(cur => {
      const cover = workers.find(w => w.id === incoming)
      const note = reason || `Covering ${workers.find(w => w.id === a.workerId)?.fullName ?? ''}`.trim()
      /* A day the cover cannot take is left with the original person rather
         than handed over anyway: that is how somebody ended up on the same
         job twice on one date. The dialog says how many days this is. */
      const canTake = (date: string) => !!cover && blockOn(cover, date, vacancy.id, cur, leaves) === 'free'

      const touched = cur.map(s =>
        s.vacancyId === vacancy.id && s.workerId === a.workerId && s.date >= from && s.date <= to && canTake(s.date)
          ? { ...s, workerId: incoming, note }
          : s)
      /* Days in the range that were never generated still need covering. */
      const made: RosterEntry[] = []
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (!a.weekdays.includes(weekdayOf(d))) continue
        if (!canTake(d)) continue
        if (touched.some(s => s.vacancyId === vacancy.id && s.date === d && s.workerId === incoming)) continue
        const slot = mine(rows).find(r => r.date === d && sameSlot(r, a))
        made.push({
          id: `r-cov-${a.id}-${d}`, vacancyId: vacancy.id, date: d, placeId: a.placeId, section: a.section,
          workerId: incoming, extra: false, extraReason: null, standingId: a.id,
          start: a.start ?? slot?.start ?? null, end: a.end ?? slot?.end ?? null,
          outcome: 'planned', actualEnd: null, coversShiftId: null, note,
        })
      }
      return [...touched, ...made]
    })

  const addSlot = (date: string, placeId: string | null, section: string, headcount: number, start: string | null, end: string | null) =>
    setRows(cur => [...cur, {
      id: `d-${vacancy.id}-${date}-${Date.now()}`, vacancyId: vacancy.id, date, placeId,
      section: section.trim() || null, headcount, start, end, note: null,
    }])
  const patchSlot = (id: string, patch: Partial<Demand>) => setRows(cur => cur.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const dropSlot = (id: string) => {
    const row = rows.find(r => r.id === id)
    if (row) setPlan(cur => cur.filter(s => !(s.vacancyId === vacancy.id && s.date === row.date && sameSlot(s, row))))
    setRows(cur => cur.filter(r => r.id !== id)); setOpenSlot(null)
  }
  const assign = (row: Demand, workerId: string, extra = false) =>
    setPlan(cur => [...cur, {
      id: `r-${Date.now()}`, vacancyId: vacancy.id, date: row.date, placeId: row.placeId, section: row.section,
      workerId, extra, extraReason: extra ? 'Beyond the client order' : null, standingId: null,
      start: row.start, end: row.end, outcome: 'planned', actualEnd: null, coversShiftId: null, note: null,
    }])
  const unassign = (id: string) => setPlan(cur => cur.filter(s => s.id !== id))
  /* The number beside a name is its position, so the position has to be
     movable — the same up/down the old warehouse schedule had. Order is the
     array order; swapping two entries is the whole operation. */
  const move = (row: Demand, id: string, delta: number) => setPlan(cur => {
    const group = cur.filter(s => s.vacancyId === vacancy.id && s.date === row.date && sameSlot(s, row))
    const at = group.findIndex(s => s.id === id)
    const to = at + delta
    if (at < 0 || to < 0 || to >= group.length) return cur
    const a = cur.indexOf(group[at]), b = cur.indexOf(group[to])
    const next = [...cur]
    next[a] = group[to]; next[b] = group[at]
    return next
  })
  const toggleExtra = (id: string) => setPlan(cur => cur.map(s => s.id === id
    ? { ...s, extra: !s.extra, extraReason: s.extra ? null : 'Beyond the client order' } : s))
  const setOffer = (workerId: string, date: string, status: 'offered' | 'declined' | null) =>
    setOfferLog(cur => {
      const rest = cur.filter(o => !(o.vacancyId === vacancy.id && o.workerId === workerId && (o.date === date || o.date === null)))
      return status ? [...rest, { id: `o-${Date.now()}`, vacancyId: vacancy.id, workerId, date, status, note: null, at: new Date().toISOString() }] : rest
    })
  const offerFor = (workerId: string, date: string) =>
    offerLog.find(o => o.vacancyId === vacancy.id && o.workerId === workerId && (o.date === date || o.date === null)) ?? null

  const active = rows.find(r => r.id === openSlot) ?? null
  /* No times, a start only, or a full window — decided once for the vacancy
     and read by every row below. */
  const timing = timingOf(vacancy.schedule)

  return (
    <>
      {/* Who normally works here. For a one-person job this panel is the whole
          schedule: set it up once and the days look after themselves. */}
      <div className="standing-panel">
        <div className="standing-head">
          <h3>Who normally works here</h3>
          <div className="standing-actions">
            <button className="button button-secondary" onClick={() => setAddingPerson(true)}><Plus />Add person</button>
            <button className="button button-secondary" onClick={() => { fillFromArrangements(); setSchedule(true) }}
              title="Create the shifts these arrangements imply, for the days on screen"><Wand2 />Fill schedule</button>
          </div>
        </div>
        {!liveArrangements.length && <p className="sched-empty">Nobody is standing on this vacancy — people are added to individual days below.</p>}
        {liveArrangements.map(a => {
          const w = workers.find(x => x.id === a.workerId)
          return (
            <div className="standing-row" key={a.id}>
              <span>
                <strong><Link href={`/people/${a.workerId}`}>{w?.fullName ?? '—'}</Link></strong>
                <small>
                  {a.weekdays.map(d => weekdayLabel[d]).join(' ')}
                  {timing === 'none' ? '' : ` · ${a.start ?? 'slot time'}${timing === 'window' && a.end ? `–${a.end}` : ''}`}
                  {[placeName(vacancy, a.placeId), a.section].filter(Boolean).length ? ` · ${[placeName(vacancy, a.placeId), a.section].filter(Boolean).join(' · ')}` : ''}
                  {a.to ? ` · until ${formatDate(a.to)}` : ''}{a.note ? ` · ${a.note}` : ''}
                </small>
              </span>
              <button className="button button-secondary button-small" onClick={() => setReplacing(a)}><Repeat />Replace</button>
              <button className="button button-secondary button-small"
                onClick={() => setArrangements(cur => cur.map(x => x.id === a.id ? { ...x, to: TODAY } : x))}>End</button>
            </div>
          )
        })}
      </div>

      <button className={`sched-toggle ${schedule ? 'open' : ''}`} onClick={() => setSchedule(x => !x)} aria-expanded={schedule}>
        <ChevronRight />
        <strong>Schedule</strong>
        <span>{schedule ? 'Hide the day-by-day plan' : `Day-by-day plan · ${mine(plan).filter(x => x.workerId).length} shifts placed`}</span>
      </button>

      {schedule && <>
      <div className="sched-toolbar">
        <div className="seg">
          {(['day', 'week', 'month'] as View[]).map(v => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)}>
              {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
        <div className="dispatch-datenav">
          <button className="icon-button" onClick={() => step(-1)} aria-label="Back"><ChevronLeft /></button>
          <span className="week-label">
            {view === 'day' ? formatDate(anchor)
              : view === 'week' ? `Week ${week.week} · ${formatDate(days[0])} – ${formatDate(days[6])}`
              : new Date(`${anchor}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
          <button className="icon-button" onClick={() => step(1)} aria-label="Forward"><ChevronRight /></button>
        </div>
        <button className="button button-secondary" onClick={() => setSharing(true)}><Share2 />Share view</button>
      </div>

      <div className={`sched-layout ${active ? 'with-picker' : ''}`}>
        <div className={`sched-days view-${view}`}>
          {days.map(date => {
            const slots = slotsOn(date)
            /* In a month view the quiet days collapse to a single line so the
               working days stay readable, while still being orderable. */
            const quiet = view === 'month' && !slots.length
            return (
              <Panel key={date} className={`sched-day ${date === TODAY ? 'today' : ''} ${quiet ? 'quiet' : ''}`}>
                <div className="sched-day-head">
                  <div><strong>{weekdayLabel[weekdayOf(date)]}</strong><span>{formatDate(date)}</span></div>
                  <button className="add-shift" onClick={() => setDraft({ date })}><Plus />Add slot</button>
                </div>
                {!slots.length && !quiet && <p className="sched-empty">Not a working day.</p>}
                {slots.map(row => {
                  const shifts = shiftsIn(row)
                  const counted = shifts.filter(s => !s.extra)
                  return (
                    <div key={row.id} className={`sched-slot ${openSlot === row.id ? 'open' : ''}`}>
                      <div className="sched-slot-head">
                        <strong>{slotTitle(vacancy, row)}</strong>
                        {/* Times are edited here rather than only inherited from the
                            pattern: Ziggo Dome picks a different start every day, and
                            a job that keeps no times shows no fields at all. */}
                        {timing !== 'none' && (
                          <span className="sched-time">
                            <TimeField value={row.start} label="Start time" onChange={start => patchSlot(row.id, { start })} />
                            {timing === 'window' && <>
                              <i>–</i>
                              <TimeField value={row.end} label="End time" onChange={end => patchSlot(row.id, { end })} />
                            </>}
                          </span>
                        )}
                        <span className="headcount">
                          <input type="number" min={0} value={row.headcount} aria-label="People ordered"
                            onChange={e => patchSlot(row.id, { headcount: Math.max(0, Number(e.target.value) || 0) })} />
                          <small>ordered</small>
                        </span>
                        <Badge tone={counted.length < row.headcount ? 'urgent' : 'green'}>{counted.length}/{row.headcount}</Badge>
                        <button className="planner-clear" onClick={() => dropSlot(row.id)} aria-label="Remove slot">×</button>
                      </div>
                      {row.note && <p className="sched-note">{row.note}</p>}
                      <div className="sched-names">
                        {shifts.map((s, index) => {
                          const w = workers.find(x => x.id === s.workerId)
                          return (
                            <span key={s.id} className={`name-chip ${s.extra ? 'extra' : ''}`} title={s.note ?? s.extraReason ?? undefined}>
                              {/* Numbering restarts at 1 for every slot, exactly as on the
                                  old warehouse schedule: each place and section counts
                                  its own people. */}
                              <b className="chip-no">{index + 1}.</b>
                              <Link href={`/people/${s.workerId}`}>{w?.fullName ?? '—'}</Link>
                              {s.extra && <em>extra</em>}
                              {s.note && !s.extra && <em>cover</em>}
                              <button onClick={() => move(row, s.id, -1)} disabled={index === 0} aria-label="Move up">↑</button>
                              <button onClick={() => move(row, s.id, 1)} disabled={index === shifts.length - 1} aria-label="Move down">↓</button>
                              <button onClick={() => toggleExtra(s.id)} title="Beyond the client order — worked, not billed">±</button>
                              <button onClick={() => unassign(s.id)} aria-label="Remove">×</button>
                            </span>
                          )
                        })}
                        <button className="add-shift" onClick={() => setOpenSlot(openSlot === row.id ? null : row.id)}>
                          <Plus />{openSlot === row.id ? 'Close' : 'Add people'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </Panel>
            )
          })}
        </div>

        {active && (
          <Panel className="sched-picker">
            <div className="panel-header">
              <div><h2>Who can work</h2><p>{slotTitle(vacancy, active)} · {formatDate(active.date)}</p></div>
              <button className="icon-button" onClick={() => setOpenSlot(null)} aria-label="Close"><X /></button>
            </div>
            <CandidateList vacancy={vacancy} row={active} plan={plan} offerFor={offerFor}
              onAssign={(id, extra) => assign(active, id, extra)}
              onOffer={(id, status) => setOffer(id, active.date, status)} />
          </Panel>
        )}
      </div>

      </>}

      {draft && <SlotDialog vacancy={vacancy} date={draft.date} onCancel={() => setDraft(null)}
        onSave={(placeId, section, headcount, start, end) => { addSlot(draft.date, placeId, section, headcount, start, end); setDraft(null) }} />}
      {addingPerson && <PersonDialog vacancy={vacancy} plan={plan} onCancel={() => setAddingPerson(false)}
        onSave={a => {
          setArrangements(cur => [...cur, a])
          /* Adding somebody to the vacancy IS putting them on its days —
             nobody adds a person and then wonders why the schedule is empty.
             The shifts are still ordinary shifts, so any single day can be
             changed or handed to somebody else afterwards. */
          fillFromArrangements([a])
          setSchedule(true)
          setAddingPerson(false)
        }} />}
      {replacing && <ReplaceDialog vacancy={vacancy} arrangement={replacing} plan={plan} onCancel={() => setReplacing(null)}
        onSave={(incoming, from, to, reason) => { replaceOver(replacing, incoming, from, to, reason); setReplacing(null) }} />}
      {sharing && <ShareView vacancy={vacancy} days={days} slotsOn={slotsOn} shiftsIn={shiftsIn} onClose={() => setSharing(false)} />}
    </>
  )
}

function useCandidates(vacancy: Vacancy, date: string, slot: { placeId: string | null; section: string | null; start: string | null; end: string | null }, plan: RosterEntry[]) {
  return useMemo(() => workers
    .filter(w => w.status === 'active' && w.companyAccess.includes(vacancy.companyId))
    .map(w => {
      const probe: RosterEntry = { id: 'probe', vacancyId: vacancy.id, date, placeId: slot.placeId, section: slot.section,
        workerId: w.id, extra: false, extraReason: null, standingId: null, start: slot.start, end: slot.end,
        outcome: 'planned', actualEnd: null, coversShiftId: null, note: null }
      const busy = plan.some(s => s.workerId === w.id && s.date === date && shiftsOverlap(s, probe))
      const onLeave = leaves.some(l => l.workerId === w.id && l.date === date)
      /* Already on THIS job today. Overlapping times catch most of it, but a
         slot at another hour would slip through and the client's sheet would
         show the same person twice. */
      const duplicate = alreadyOnVacancy(plan, vacancy.id, date, w.id)
      /* A course is a standing weekly commitment, not a day off. */
      const onCourse = isCourseDay(w, date)
      /* Some sites cannot be reached without a car at the hours we staff
         them, so this is a hard block rather than a hint — being close by
         does not help if there is no way to get there at 05:30. */
      const noCar = vacancy.carOnly && !w.hasCar
      return { w, busy, onLeave, noCar, duplicate, onCourse, elsewhere: assignmentOn(w.id, date, null, plan), travel: travelFor(w.id, vacancy.id) }
    }), [vacancy, date, slot.placeId, slot.section, slot.start, slot.end, plan])
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
  return (
    <label className="checkbox-inline candidate-filter">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      With car only
      <small>For strike days.</small>
    </label>
  )
}

function CandidateList({ vacancy, row, plan, offerFor, onAssign, onOffer }: {
  vacancy: Vacancy; row: Demand; plan: RosterEntry[]
  offerFor: (workerId: string, date: string) => Offer | null
  onAssign: (workerId: string, extra: boolean) => void
  onOffer: (workerId: string, status: 'offered' | 'declined' | null) => void
}) {
  /* A site that can only be reached by car already blocks everyone else, so
     the switch would be a no-op there and is not offered. */
  const [carOnly, setCarOnly] = useState(false)
  const base = useCandidates(vacancy, row.date, row, plan)
  const candidates = base.map(c => ({ ...c, offer: offerFor(c.w.id, row.date) }))
    /* Free and near the top, already-refused at the bottom so nobody is rung
       twice with the same offer by accident. */
    .sort((a, b) => Number(a.offer?.status === 'declined') - Number(b.offer?.status === 'declined')
      || Number(a.busy || a.onLeave || a.noCar || a.duplicate || a.onCourse) - Number(b.busy || b.onLeave || b.noCar || b.duplicate || b.onCourse)
      || (a.travel?.km ?? 1e9) - (b.travel?.km ?? 1e9))
  const shown = carOnly ? candidates.filter(c => c.w.hasCar) : candidates

  if (!candidates.length) return <StateBlock title="Nobody holds this contract" description="No active worker has access to this client." />
  return (
    <div className="candidate-list">
      {!vacancy.carOnly && <CarFilter on={carOnly} onChange={setCarOnly} />}
      {!shown.length && <StateBlock title="Nobody here has a car" description="Switch the filter off to see everyone who holds this contract." />}
      {shown.map(({ w, busy, onLeave, noCar, duplicate, onCourse, elsewhere, travel, offer }) => {
        const blocked = busy || onLeave || noCar || duplicate || onCourse
        return (
          <div key={w.id} className={`candidate-row ${offer?.status === 'declined' ? 'declined' : ''}`}>
            <span>
              <strong>{w.fullName}</strong>
              <small>
                {travel ? `${travel.km} km · ${travel.minutes} min` : 'no travel on record'}
                {duplicate ? ' · already on this job today' : noCar ? ' · no car — this site needs one' : onCourse ? ' · at a course this weekday' : onLeave ? ' · on leave' : busy ? ` · already on ${vacancies.find(v => v.id === elsewhere?.vacancyId)?.title ?? 'another job'}` : ' · free'}
                {!vacancy.carOnly && (w.hasCar ? ' · car' : ' · no car')}
                {offer && ` · ${offer.status === 'declined' ? 'declined' : 'offered'}${offer.note ? ` (${offer.note})` : ''}`}
              </small>
            </span>
            <div className="candidate-actions">
              {offer?.status === 'declined'
                ? <button className="button button-secondary button-small" onClick={() => onOffer(w.id, null)}>Clear</button>
                : <button className="button button-secondary button-small" onClick={() => onOffer(w.id, 'declined')}>Declined</button>}
              <button className="button button-secondary button-small" disabled={blocked} onClick={() => onAssign(w.id, false)}>Assign</button>
              <button className="button button-secondary button-small" disabled={blocked} onClick={() => onAssign(w.id, true)}
                title="On site beyond the client order — worked, not billed">+ extra</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReplaceDialog({ vacancy, arrangement, plan, onCancel, onSave }: {
  vacancy: Vacancy; arrangement: StandingAssignment; plan: RosterEntry[]
  onCancel: () => void; onSave: (incoming: string, from: string, to: string, reason: string) => void
}) {
  const { closing, close: dismiss } = useExit(onCancel)
  const outgoing = workers.find(w => w.id === arrangement.workerId)
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState(TODAY)
  const [reason, setReason] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [carOnly, setCarOnly] = useState(false)
  /* The working days actually touched by this replacement — not every day in
     the range, because the arrangement only covers some weekdays. */
  const touchedDays = useMemo(() => {
    const out: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) if (arrangement.weekdays.includes(weekdayOf(d))) out.push(d)
    return out
  }, [from, to, arrangement.weekdays])
  /* Availability is judged over the WHOLE range. Judging it on the first day
     alone was the hole through which somebody could be put on a job they
     already work later in the week — twice on the same day. */
  const candidates = useCandidates(vacancy, from, arrangement, plan).filter(c => c.w.id !== arrangement.workerId)
    .filter(c => !carOnly || c.w.hasCar)
    .map(c => ({ ...c, span: availabilityOver(c.w, touchedDays, vacancy.id, plan, leaves) }))
    .sort((a, b) => Number(!a.span.fullyFree) - Number(!b.span.fullyFree)
      || a.span.taken.length - b.span.taken.length
      || (a.travel?.km ?? 1e9) - (b.travel?.km ?? 1e9))
  const dayCount = Math.max(0, Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000) + 1)

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div><h2>Replace {outgoing?.fullName}</h2>
            <p>Only the days in the range change. The standing arrangement stays, so {outgoing?.fullName?.split(' ')[0]} returns by itself afterwards.</p></div>
          <button className="icon-button" onClick={dismiss} aria-label="Close"><X /></button>
        </div>
        <div className="dialog-row">
          <label>From<input type="date" value={from} onChange={e => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value) }} /></label>
          <label>Until<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
          <label>Reason (optional)<input value={reason} placeholder="Sick, holiday…" onChange={e => setReason(e.target.value)} /></label>
        </div>
        <p className="dialog-note">
          {dayCount === 1 ? 'One day' : `${dayCount} days`} — only the working days of this arrangement
          ({arrangement.weekdays.map(d => weekdayLabel[d]).join(' ')}) are touched, {touchedDays.length} in this range.
          {pick && (() => {
            const chosen = candidates.find(c => c.w.id === pick)
            return chosen && chosen.span.taken.length
              ? ` ${chosen.span.taken.length} of them stay with ${workers.find(w => w.id === arrangement.workerId)?.firstName ?? 'the original person'} — the cover is not free on those.`
              : ''
          })()}
        </p>
        <div className="candidate-list">
          {!vacancy.carOnly && <CarFilter on={carOnly} onChange={on => { setCarOnly(on); setPick(null) }} />}
          {!candidates.length && <StateBlock title={carOnly ? 'Nobody here has a car' : 'Nobody else holds this contract'}
            description={carOnly ? 'Switch the filter off to see everyone.' : 'No other active worker has access to this client.'} />}
          {candidates.map(({ w, noCar, travel, span }) => {
            /* Nobody free on a single one of the days is no use as cover. */
            const useless = noCar || !span.free.length
            return (
              <button key={w.id} type="button" className={`candidate-row ${pick === w.id ? 'selected' : ''}`}
                disabled={useless} onClick={() => setPick(w.id)}>
                <span><strong>{w.fullName}</strong>
                  <small>{travel ? `${travel.km} km · ${travel.minutes} min` : 'no travel on record'}{noCar ? ' · no car' : ''}{!vacancy.carOnly && (w.hasCar ? ' · car' : ' · no car')}
                    <br />{availabilityLabel(span)}</small></span>
                <Badge tone={noCar ? 'orange' : span.fullyFree ? 'green' : span.free.length ? 'blue' : 'orange'}>
                  {noCar ? 'No car' : span.fullyFree ? 'Free' : span.free.length ? `${span.free.length}/${span.days.length}` : 'Unavailable'}
                </Badge>
              </button>
            )
          })}
        </div>
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>Cancel</button>
          <button className="button button-primary" disabled={!pick} onClick={() => onSave(pick!, from, to, reason.trim())}>Replace</button>
        </div>
      </div>
    </div>
  )
}

/** How far ahead "the whole vacancy" is judged when it has no end date. Four
 *  weeks is what the office plans against; anything further is guesswork. */
const HORIZON_DAYS = 28

function PersonDialog({ vacancy, plan, onCancel, onSave }: {
  vacancy: Vacancy; plan: RosterEntry[]; onCancel: () => void; onSave: (a: StandingAssignment) => void
}) {
  const { closing, close: dismiss } = useExit(onCancel)
  const [workerId, setWorkerId] = useState('')
  const [weekdays, setWeekdays] = useState<Weekday[]>(vacancy.schedule.weekdays.length ? vacancy.schedule.weekdays : ['mon', 'tue', 'wed', 'thu', 'fri'])
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [section, setSection] = useState('')
  const [carOnly, setCarOnly] = useState(false)
  const eligible = workers.filter(w => w.status === 'active' && w.companyAccess.includes(vacancy.companyId))

  /* The days this arrangement would actually use: the chosen weekdays, inside
     the vacancy's own period, out to the horizon. Availability is judged
     against these and nothing else — being busy on a Sunday is irrelevant to
     an arrangement that never works Sundays. */
  const startFromDate = vacancy.startDate > TODAY ? vacancy.startDate : TODAY
  const days = useMemo(() => {
    const last = vacancy.endDate && vacancy.endDate < addDays(startFromDate, HORIZON_DAYS)
      ? vacancy.endDate : addDays(startFromDate, HORIZON_DAYS)
    const out: string[] = []
    for (let d = startFromDate; d <= last; d = addDays(d, 1)) if (weekdays.includes(weekdayOf(d))) out.push(d)
    return out
  }, [startFromDate, vacancy.endDate, weekdays])

  const candidates = eligible
    .filter(w => !carOnly || w.hasCar)
    .map(w => ({ w, span: availabilityOver(w, days, vacancy.id, plan, leaves), travel: travelFor(w.id, vacancy.id), noCar: vacancy.carOnly && !w.hasCar }))
    /* Free for the whole run first, then whoever frees up soonest, then by
       distance — the order the office would sort them in by hand. */
    .sort((a, b) => Number(a.noCar) - Number(b.noCar)
      || Number(!a.span.fullyFree) - Number(!b.span.fullyFree)
      || (a.span.freeFrom ?? '9999').localeCompare(b.span.freeFrom ?? '9999')
      || a.span.taken.length - b.span.taken.length
      || (a.travel?.km ?? 1e9) - (b.travel?.km ?? 1e9))

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="panel-header"><h2>Add a standing person</h2>
          <button className="icon-button" onClick={dismiss} aria-label="Close"><X /></button></div>
        <label>Working days</label>
        <div className="seg">
          {WEEKDAYS.map(d => (
            <button key={d} className={weekdays.includes(d) ? 'active' : ''} type="button"
              onClick={() => { setWeekdays(cur => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]); setWorkerId('') }}>{weekdayLabel[d]}</button>
          ))}
        </div>
        <p className="dialog-note">
          Judged over {days.length} working {days.length === 1 ? 'day' : 'days'}
          {vacancy.endDate ? ` to ${formatDate(vacancy.endDate)}` : ` — the next four weeks, since this vacancy has no end date`}.
        </p>
        <label>Person</label>
        {!vacancy.carOnly && <CarFilter on={carOnly} onChange={setCarOnly} />}
        {/* A dropdown answers "who exists". The question here is who is free,
            and if not now then from when — so the list says it. */}
        <div className="candidate-list">
          {candidates.map(({ w, span, travel, noCar }) => (
            <button key={w.id} type="button" className={`candidate-row ${workerId === w.id ? 'selected' : ''}`}
              disabled={noCar || !span.free.length} onClick={() => setWorkerId(w.id)}>
              <span><strong>{w.fullName}</strong>
                <small>{travel ? `${travel.km} km · ${travel.minutes} min` : 'no travel on record'}
                  {w.courseDays.length ? ` · course ${w.courseDays.map(d => weekdayLabel[d]).join(' ')}` : ''}
                  {noCar ? ' · no car — this site needs one' : ''}
                  <br />{availabilityLabel(span)}</small></span>
              <Badge tone={noCar ? 'orange' : span.fullyFree ? 'green' : span.free.length ? 'blue' : 'orange'}>
                {noCar ? 'No car' : span.fullyFree ? 'Free' : span.free.length ? `${span.free.length}/${span.days.length}` : 'Busy'}
              </Badge>
            </button>
          ))}
          {!candidates.length && <StateBlock title="Nobody holds this contract" description="No active worker has access to this client." />}
        </div>
        {vacancy.places.length > 0 && (
          <label>Place
            <select value={placeId ?? ''} onChange={e => setPlaceId(e.target.value || null)}>
              <option value="">Whole site</option>
              {vacancy.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label>Section (optional)<input value={section} onChange={e => setSection(e.target.value)} placeholder="Inbound…" /></label>
        <p className="dialog-note">The chosen days are filled in straight away; days that already have somebody are left alone. Each day stays an ordinary shift afterwards, so one of them can be swapped without touching the arrangement.</p>
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>Cancel</button>
          <button className="button button-primary" disabled={!workerId || !weekdays.length}
            onClick={() => onSave({ id: `sa-${Date.now()}`, vacancyId: vacancy.id, workerId, placeId, section: section.trim() || null,
              weekdays, start: null, end: null, from: TODAY, to: null, note: null })}>Add</button>
        </div>
      </div>
    </div>
  )
}

function SlotDialog({ vacancy, date, onCancel, onSave }: {
  vacancy: Vacancy; date: string; onCancel: () => void
  onSave: (placeId: string | null, section: string, headcount: number, start: string | null, end: string | null) => void
}) {
  const { closing, close: dismiss } = useExit(onCancel)
  const [placeId, setPlaceId] = useState<string | null>(vacancy.places[0]?.id ?? null)
  const [section, setSection] = useState('')
  const [headcount, setHeadcount] = useState(
    vacancy.schedule.headcount.kind === 'fixed' ? vacancy.schedule.headcount.count
      : vacancy.schedule.headcount.kind === 'perDate' ? vacancy.schedule.headcount.typical : 1)
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
        <div className="panel-header"><h2>Order people on {formatDate(date)}</h2>
          <button className="icon-button" onClick={dismiss} aria-label="Close"><X /></button></div>
        {vacancy.places.length > 0 && (
          <label>Place
            <select value={placeId ?? ''} onChange={e => setPlaceId(e.target.value || null)}>
              <option value="">Whole site — no place</option>
              {vacancy.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label>Section (optional)<input value={section} placeholder="Inbound, Outbound…" onChange={e => setSection(e.target.value)} /></label>
        <p className="dialog-note">A section is only written when the client asks for one. Conakryweg is ordered with none, and that is normal.</p>
        <label>People<input type="number" min={0} value={headcount} onChange={e => setHeadcount(Math.max(0, Number(e.target.value) || 0))} /></label>
        {timing !== 'none' && (
          <div className="dialog-row">
            <label>{timing === 'start' ? 'Start time' : 'From'}<TimeField value={start} label="Start time" onChange={v => setStart(v ?? '')} /></label>
            {timing === 'window' && <label>Until<TimeField value={end} label="End time" onChange={v => setEnd(v ?? '')} /></label>}
          </div>
        )}
        {timing === 'start' && <p className="dialog-note">No end time on this job — people leave when the work is done, so the rest of the day stays blocked for them.</p>}
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>Cancel</button>
          <button className="button button-primary"
            onClick={() => onSave(placeId, section, headcount, timing === 'none' ? null : start || null, timing === 'window' ? end || null : null)}>Add slot</button>
        </div>
      </div>
    </div>
  )
}

function ShareView({ vacancy, days, slotsOn, shiftsIn, onClose }: {
  vacancy: Vacancy; days: string[]
  slotsOn: (date: string) => Demand[]; shiftsIn: (row: Demand) => RosterEntry[]
  onClose: () => void
}) {
  const { closing, close: dismiss } = useExit(onClose)
  /* Only the days with something on them: an empty column is dead space in a
     screenshot, and dead space is what makes the names small in WhatsApp's
     preview. */
  const shown = days.filter(d => slotsOn(d).length)
  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="share-sheet" onClick={e => e.stopPropagation()}>
        <div className="share-head"><strong>{vacancy.title}</strong>
          <button className="icon-button" onClick={dismiss} aria-label="Close"><X /></button></div>
        {!shown.length && <StateBlock title="Nothing to share yet" description="No days in this view have anybody ordered on them." />}
        <div className={`share-grid ${shown.length === 1 ? 'share-one' : shown.length <= 7 ? 'share-row' : 'share-wrap'}`}>
          {shown.map(date => (
            <div className="share-day" key={date}>
              <div className="share-date">{weekdayLabel[weekdayOf(date)]} {formatDate(date).replace(/ \d{4}$/, '')}</div>
              {slotsOn(date).map(row => (
                <div className="share-slot" key={row.id}>
                  <div className="share-slot-head">
                    {[[placeName(vacancy, row.placeId), row.section].filter(Boolean).join(' · ') || 'Whole site', slotTimeLabel(vacancy, row)].filter(Boolean).join(' · ')}
                  </div>
                  <ol>
                    {shiftsIn(row).map((s, i) => <li key={s.id}><b>{i + 1}.</b> {workers.find(w => w.id === s.workerId)?.fullName ?? '—'}{s.extra ? ' *' : ''}</li>)}
                    {!shiftsIn(row).length && <li className="share-open">— nobody yet —</li>}
                  </ol>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="share-foot">Everything fits one screenshot — the preview will not crop the last name. * = beyond the client order.</p>
      </div>
    </div>
  )
}

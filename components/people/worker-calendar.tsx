'use client'

import { Badge, Panel } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { assignmentOn } from '@/lib/derive'
import type { Leave } from '@/lib/types'
import { addDays, formatDate } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '@/lib/today'

/* ------------------------------------------------------------------
   The worker's month.

   Days are picked, not opened: a holiday is two weeks, not one day, and
   clicking through fourteen dialogs to enter it is how people stop entering
   it at all. Tapping a day adds it to the selection, tapping it again takes
   it out, and shift-clicking fills the span between — then one action covers
   everything picked. The same selection is what removes leave again.
   ------------------------------------------------------------------ */
export function Calendar({ workerId }: { workerId: string }) {
  const today = useToday()
  const { leaves, roster, vacancies } = useWorkforceData()
  const [view, setView] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })
  const [picked, setPicked] = useState<string[]>([today])
  /* The anchor is the last day touched, which is what shift-click measures from. */
  const [anchor, setAnchor] = useState<string>(today)
  const [entries, setEntries] = useState<Leave[]>(leaves)
  const [reason, setReason] = useState('')
  const [paid, setPaid] = useState(true)
  const [savingAbsence, setSavingAbsence] = useState(false)
  const [absenceError, setAbsenceError] = useState('')

  const shiftMonth = (delta: number) =>
    setView(cur => {
      const d = new Date(Date.UTC(cur.y, cur.m + delta, 1))
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
    })

  const first = new Date(Date.UTC(view.y, view.m, 1))
  const start = (first.getUTCDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(view.y, view.m, 1 - start + i))
    return d.toISOString().slice(0, 10)
  })

  const span = (from: string, to: string) => {
    const [a, b] = from <= to ? [from, to] : [to, from]
    const out: string[] = []
    for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
    return out
  }
  const choose = (date: string, extend: boolean) => {
    setPicked(cur =>
      extend
        ? [...new Set([...cur, ...span(anchor, date)])]
        : cur.includes(date)
          ? cur.filter(d => d !== date)
          : [...cur, date],
    )
    setAnchor(date)
  }

  const leaveOn = (date: string) => entries.find(l => l.workerId === workerId && l.date === date)
  const dayState = (date: string) =>
    leaveOn(date) ? 'leave' : assignmentOn(workerId, date, null, roster, vacancies) ? 'working' : 'free'

  const chosen = [...picked].sort()
  /* Three reasons a picked day cannot take a day off, each worth naming: it
     has already gone, somebody is expecting this person on a job, or it is
     already a day off. */
  const pastDays = chosen.filter(d => d < today)
  const assigned = chosen.filter(
    d => d >= today && !leaveOn(d) && assignmentOn(workerId, d, null, roster, vacancies),
  )
  const markable = chosen.filter(d => d >= today && dayState(d) === 'free')
  const removable = chosen.filter(d => d >= today && leaveOn(d))

  const markOff = async () => {
    if (savingAbsence || !markable.length) return
    setSavingAbsence(true)
    setAbsenceError('')
    try {
      const response = await fetch(`/api/people/${encodeURIComponent(workerId)}/absence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: markable, reason: reason.trim(), paidLeave: paid }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not save time off.'
        throw new Error(message)
      }
      setEntries(cur => [
        ...cur,
        ...markable.map(date => ({
          id: `l-${workerId}-${date}`,
          workerId,
          date,
          reason: reason.trim() || 'Day off',
          paidLeave: paid,
        })),
      ])
      setPicked([])
      setReason('')
    } catch (cause) {
      setAbsenceError(cause instanceof Error ? cause.message : 'Could not save time off.')
    } finally {
      setSavingAbsence(false)
    }
  }
  const removeOff = async () => {
    if (savingAbsence || !removable.length) return
    setSavingAbsence(true)
    setAbsenceError('')
    try {
      const response = await fetch(`/api/people/${encodeURIComponent(workerId)}/absence`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: removable }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not remove time off.'
        throw new Error(message)
      }
      setEntries(cur => cur.filter(l => !(l.workerId === workerId && removable.includes(l.date))))
      setPicked([])
    } catch (cause) {
      setAbsenceError(cause instanceof Error ? cause.message : 'Could not remove time off.')
    } finally {
      setSavingAbsence(false)
    }
  }

  const single = chosen.length === 1 ? chosen[0] : null
  const info = single ? assignmentOn(workerId, single, null, roster, vacancies) : null
  const monthKey = `${view.y}-${String(view.m + 1).padStart(2, '0')}`

  return (
    <div className="calendar-area">
      <div className="calendar-head">
        <button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft />
        </button>
        <strong>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(first)}</strong>
        <button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight />
        </button>
      </div>
      <div className="calendar-weekdays">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map(date => {
          const state = dayState(date)
          return (
            <button
              key={date}
              onClick={e => choose(date, e.shiftKey)}
              aria-pressed={picked.includes(date)}
              className={`calendar-day ${date.slice(0, 7) !== monthKey ? 'muted' : ''} ${date === today ? 'today' : ''} ${picked.includes(date) ? 'picked' : ''} ${state}`}
            >
              <span>{Number(date.slice(-2))}</span>
              {state !== 'free' && <i />}
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span>
          <i className="working" />
          Working
        </span>
        <span>
          <i className="leave" />
          Leave
        </span>
        <span>
          <i className="free" />
          Free
        </span>
        <span className="legend-hint">Click to pick · shift-click for a span</span>
      </div>

      <Panel className="selected-day">
        {absenceError && (
          <p className="dialog-note" role="alert">
            {absenceError}
          </p>
        )}
        <div className="panel-header">
          <div>
            <h2>{single ? formatDate(single) : `${chosen.length} days selected`}</h2>
            <p>
              {single
                ? single === today
                  ? 'Today'
                  : single < today
                    ? 'Past day'
                    : 'Future day'
                : chosen.length
                  ? `${formatDate(chosen[0])} – ${formatDate(chosen[chosen.length - 1])}`
                  : 'Nothing picked yet'}
            </p>
          </div>
          {single && (
            <Badge tone={leaveOn(single) ? 'orange' : info ? 'blue' : 'neutral'}>
              {leaveOn(single) ? 'Leave' : info ? 'Working' : 'Free'}
            </Badge>
          )}
          {!single && chosen.length > 0 && (
            <button className="button button-secondary button-small" onClick={() => setPicked([])}>
              Clear
            </button>
          )}
        </div>

        {!chosen.length && <p className="muted-copy">Pick one or more days in the calendar above.</p>}

        {removable.length > 0 && (
          <div className="day-action">
            <strong>
              {removable.length === 1 ? leaveOn(removable[0])!.reason : `${removable.length} days off`}
            </strong>
            <span>
              {removable.length === 1
                ? leaveOn(removable[0])!.paidLeave
                  ? 'Paid leave'
                  : 'Unpaid leave'
                : 'Selected days that are marked off'}
            </span>
            <button
              className="button button-secondary"
              onClick={() => void removeOff()}
              disabled={savingAbsence}
            >
              {removable.length === 1 ? 'Remove day off' : `Remove ${removable.length} days off`}
            </button>
          </div>
        )}

        {markable.length > 0 && (
          <div className="day-action">
            <input
              placeholder="Reason"
              aria-label="Day off reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <label>
              <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Paid leave
            </label>
            <button className="button button-primary" onClick={() => void markOff()} disabled={savingAbsence}>
              {savingAbsence
                ? 'Saving…'
                : markable.length === 1
                  ? 'Mark as day off'
                  : `Mark ${markable.length} days off`}
            </button>
          </div>
        )}

        {assigned.length > 0 && (
          <p className="muted-copy">
            {assigned.length === 1
              ? `${formatDate(assigned[0])} is assigned — remove the assignment before marking it off.`
              : `${assigned.length} of the selected days are assigned and were left alone — remove those assignments first.`}
          </p>
        )}
        {pastDays.length > 0 && (
          <p className="muted-copy">
            {pastDays.length === 1 ? 'One selected day' : `${pastDays.length} selected days`} already passed
            and can only be viewed.
          </p>
        )}
      </Panel>
    </div>
  )
}

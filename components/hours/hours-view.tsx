'use client'

import { AppShell, Badge, PageHeading, Panel, StateBlock } from '@/components/app-shell'
import { ReportDialog } from '@/components/hours/report-dialog'
import { useWorkforceData } from '@/components/workforce-data-context'
import { assignmentOn, dayStatus, vacancyStatus } from '@/lib/derive'
import type { HoursEntry } from '@/lib/types'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToday } from '@/lib/today'

export function HoursView() {
  const today = useToday()
  const { vacancies, standing, roster, hours, workers, leaves, companies } = useWorkforceData()
  const trackableVacancies = vacancies.filter(
    x => x.trackHoursManually && vacancyStatus(x, standing, roster, today) !== 'archived',
  )
  const router = useRouter()
  const [date, setDate] = useState(today)
  const [vacancyId, setVacancyId] = useState(trackableVacancies[0]?.id ?? vacancies[0].id)
  /* Entries are keyed by person AND vacancy AND day. The previous version kept
   one value per person, so hours typed on Monday reappeared on Tuesday. */
  const [entries, setEntries] = useState<HoursEntry[]>(hours)
  const [dirtyWorkers, setDirtyWorkers] = useState<Set<string>>(new Set())
  const [hoursSaving, setHoursSaving] = useState(false)
  const [hoursError, setHoursError] = useState('')
  const [hoursSaved, setHoursSaved] = useState(false)
  const [report, setReport] = useState(false)
  const v = vacancies.find(x => x.id === vacancyId)!
  const inPeriod = date >= v.startDate && (!v.endDate || date <= v.endDate)
  /* Admission to a company is not an assignment to one of its vacancies —
   the timesheet lists whoever is actually on this job that day. */
  const people = workers.filter(
    w => w.status === 'active' && assignmentOn(w.id, date, null, roster, vacancies)?.vacancyId === v.id,
  )
  const typedFor = (workerId: string) => {
    const applicable = entries.filter(e => e.workerId === workerId && e.vacancyId === v.id && e.date === date)
    const manual = applicable.find(e => e.manual)
    return (
      manual?.hours ??
      (applicable.length ? applicable.reduce((sum, entry) => sum + entry.hours, 0) : undefined)
    )
  }
  /* A normal day is the same number for everybody on it, so that number is the
   starting point and the office only touches the days that went differently.
   Clearing a cell drops back to the default rather than to nothing — a blank
   would have to mean "not worked", and that is what typing 0 is for. */
  const valueFor = (workerId: string) => typedFor(workerId) ?? v.defaultHours ?? undefined
  const setValue = (workerId: string, raw: string) => {
    setHoursError('')
    setHoursSaved(false)
    setDirtyWorkers(cur => new Set(cur).add(workerId))
    const hoursValue = Number(raw)
    setEntries(cur => {
      const rest = cur.filter(
        e => !(e.manual && e.workerId === workerId && e.vacancyId === v.id && e.date === date),
      )
      if (raw === '' || Number.isNaN(hoursValue)) return rest
      return [
        ...rest,
        {
          id: `manual-edit-${workerId}-${v.id}-${date}`,
          workerId,
          vacancyId: v.id,
          date,
          hours: hoursValue,
          manual: true,
        },
      ]
    })
  }
  const saveHours = async () => {
    if (hoursSaving || dirtyWorkers.size === 0) return
    setHoursSaving(true)
    setHoursError('')
    setHoursSaved(false)
    try {
      const updates = [...dirtyWorkers].map(workerId => ({
        workerId,
        hours:
          entries.find(
            entry =>
              entry.manual && entry.workerId === workerId && entry.vacancyId === v.id && entry.date === date,
          )?.hours ?? null,
      }))
      const response = await fetch(`/api/vacancies/${encodeURIComponent(v.id)}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries: updates }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not save hours.'
        throw new Error(message)
      }
      setDirtyWorkers(new Set())
      setHoursSaved(true)
      router.refresh()
    } catch (cause) {
      setHoursError(cause instanceof Error ? cause.message : 'Could not save hours.')
    } finally {
      setHoursSaving(false)
    }
  }
  return (
    <AppShell>
      <div className="content-inner">
        <PageHeading
          eyebrow="Time tracking"
          title="Hours"
          description="Enter manual hours for active, non-archived vacancies."
          action={
            <button className="button button-secondary" onClick={() => setReport(true)}>
              <FileText />
              Weekly report
            </button>
          }
        />
        <Panel className="hours-panel">
          <div className="table-toolbar">
            <label>
              Date
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <label>
              Vacancy
              <select value={vacancyId} onChange={e => setVacancyId(e.target.value)}>
                {trackableVacancies.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
            {!inPeriod && <Badge tone="orange">Date outside vacancy period</Badge>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Availability</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {people.map(w => {
                  const state = dayStatus(w.id, date, roster, leaves, vacancies)
                  return (
                    <tr key={w.id}>
                      <td>
                        <Link className="person-cell" href={`/people/${w.id}`}>
                          <span>
                            <strong>{w.fullName}</strong>
                            <small>{w.city}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {state === 'leave' ? (
                          <Badge tone="orange">On leave</Badge>
                        ) : state === 'working' ? (
                          <Badge tone="blue">Working</Badge>
                        ) : (
                          <Badge tone="neutral">Free</Badge>
                        )}
                      </td>
                      <td>
                        <input
                          className="hours-input"
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={valueFor(w.id) ?? ''}
                          onChange={e => setValue(w.id, e.target.value)}
                          placeholder="0.0"
                          aria-label={`Hours for ${w.fullName}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!people.length && (
              <StateBlock
                title="Nobody is on this vacancy on this day"
                description="Assign people to the vacancy first, or pick another date."
              />
            )}
          </div>
          <div className="form-footer">
            <span>
              {dirtyWorkers.size
                ? `${dirtyWorkers.size} unsaved changes`
                : hoursSaved
                  ? `Saved · ${entries.filter(e => e.manual && e.vacancyId === v.id && e.date === date).length} manual entries`
                  : v.defaultHours !== null
                    ? `${people.filter(w => typedFor(w.id) !== undefined).length} of ${people.length} with hours · default ${v.defaultHours} h`
                    : `${people.filter(w => typedFor(w.id) !== undefined).length} of ${people.length} rows filled`}
            </span>
            <button
              className="button button-primary"
              disabled={hoursSaving || dirtyWorkers.size === 0}
              onClick={() => void saveHours()}
            >
              {hoursSaving ? 'Saving…' : 'Save hours'}
            </button>
          </div>
          {hoursError && (
            <p className="dialog-note" role="alert">
              {hoursError}
            </p>
          )}
        </Panel>
      </div>
      {report && <ReportDialog vacancy={v} entries={entries} onClose={() => setReport(false)} />}
    </AppShell>
  )
}

'use client'

import { StateBlock, useExit } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { lastNameOf, reportFilename, reportRows, reportSheet } from '@/lib/hours-report'
import type { HoursEntry, Vacancy } from '@/lib/types'
import { formatDate, isoWeek, weekDates } from '@/lib/types'
import { downloadXlsx } from '@/lib/xlsx'
import { FileText, X } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '@/lib/today'

export function ReportDialog({
  vacancy,
  entries,
  onClose,
}: {
  vacancy: Vacancy
  entries: HoursEntry[]
  onClose: () => void
}) {
  const today = useToday()
  const { workers, roster, companies } = useWorkforceData()
  const { closing, close: dismiss } = useExit(onClose)
  const current = isoWeek(today)
  const [week, setWeek] = useState(current.week)
  const [year, setYear] = useState(current.year)
  const days = weekDates(year, week)
  /* One source for the sheet and for the preview below, so what is on screen is
   what the client receives — including days nobody typed, which count as the
   vacancy's default when the person was on the schedule. */
  const input = {
    vacancy,
    company: companies.find(c => c.id === vacancy.companyId),
    workers,
    entries,
    roster,
    year,
    week,
  }
  const rows = reportRows(input)
  const download = () => downloadXlsx(reportSheet(input), reportFilename(input))
  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h2>Weekly report</h2>
            <p>
              {input.company?.name} · {vacancy.title}
            </p>
          </div>
          <button className="icon-button" onClick={dismiss} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="dialog-row">
          <label>
            ISO week
            <input
              type="number"
              min={1}
              max={53}
              value={week}
              onChange={e => setWeek(Math.min(53, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
          <label>
            Year
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value) || current.year)}
            />
          </label>
        </div>
        <p className="dialog-note">
          Week {week} runs {formatDate(days[0])} – {formatDate(days[6])}. The sheet goes out in the client's
          own layout — their name across the top, our contact lines, one row per person and the signature
          block at the foot.
          {vacancy.defaultHours !== null &&
            ` Days nobody typed count as ${vacancy.defaultHours} h for whoever was on the schedule.`}
        </p>
        {rows.length ? (
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>F-Name</th>
                  <th>L-Name</th>
                  <th>Projectcode</th>
                  {days.map(d => (
                    <th key={d}>{formatDate(d)}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.worker.id}>
                    <td>{r.worker.firstName}</td>
                    <td>{lastNameOf(r.worker)}</td>
                    <td>{vacancy.projectCode ?? '—'}</td>
                    {r.cells.map((c, i) => (
                      <td key={i}>{c || '—'}</td>
                    ))}
                    <td>
                      <strong>{r.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    {rows.length} {rows.length === 1 ? 'person' : 'people'}
                  </td>
                  {days.map((d, i) => (
                    <td key={d}>
                      <strong>{rows.reduce((sum, r) => sum + r.cells[i], 0) || '—'}</strong>
                    </td>
                  ))}
                  <td>
                    <strong>{rows.reduce((sum, r) => sum + r.total, 0)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <StateBlock
            title="Nothing to report for this week"
            description="Nobody was on the schedule and no hours were typed. Pick another week."
          />
        )}
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss}>
            Close
          </button>
          <button className="button button-primary" disabled={!rows.length} onClick={download}>
            <FileText />
            Download Excel
          </button>
        </div>
      </div>
    </div>
  )
}

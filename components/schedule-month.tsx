'use client'

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes, type RefObject } from 'react'
import { ChevronDown, FileText, ImagePlus, LoaderCircle, Plus } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { addDays, formatDate, isoWeek, weekdayLabel, weekdayOf } from '@/lib/types'

type Week = { key: string; number: number; dates: string[] }

/** The weeks a month calendar shows: each starts on its Monday, so the first
 *  row reaches back into the previous month, and stops at the month's last
 *  day — the next month starts a calendar of its own. */
function monthWeeks(anchor: string): Week[] {
  const first = `${anchor.slice(0, 7)}-01`
  const last = addDays(nextMonth(first), -1)
  const weekdayIndex = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(weekdayOf(first))
  const weeks: Week[] = []
  for (let monday = addDays(first, -weekdayIndex); monday <= last; monday = addDays(monday, 7)) {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter(date => date <= last)
    weeks.push({ key: monday, number: isoWeek(monday).week, dates })
  }
  return weeks
}

function nextMonth(first: string) {
  const [year, month] = first.split('-').map(Number)
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
}


/** Photo counts per day for a date range, in one request, plus the upload
 *  behind each day's photo button. The caller renders `inputProps` on a
 *  hidden file input; `pick(date)` opens it for that day. */
export function useDayPhotos(vacancyId: string, from: string, to: string, enabled = true) {
  const endpoint = `/api/vacancies/${encodeURIComponent(vacancyId)}/reports`
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const uploadDate = useRef<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`${endpoint}?from=${from}&to=${to}`, { signal, cache: 'no-store' })
        const result: unknown = await response.json()
        if (
          response.ok &&
          typeof result === 'object' &&
          result !== null &&
          'counts' in result &&
          typeof result.counts === 'object' &&
          result.counts !== null
        )
          setCounts(result.counts as Record<string, number>)
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
      }
    },
    [endpoint, from, to],
  )

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [enabled, load])

  const upload = async (files: File[]) => {
    const date = uploadDate.current
    if (!date || !files.length) return
    setUploading(date)
    setError('')
    try {
      for (const file of files) {
        const form = new FormData()
        form.append('date', date)
        form.append('photo', file)
        const response = await fetch(endpoint, { method: 'POST', body: form })
        if (!response.ok) {
          const result: unknown = await response.json().catch(() => null)
          throw new Error(
            typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
              ? result.error
              : `Could not upload ${file.name}.`,
          )
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the photos.')
    } finally {
      setUploading(null)
      if (input.current) input.current.value = ''
      void load()
    }
  }

  const inputProps: InputHTMLAttributes<HTMLInputElement> & { ref: RefObject<HTMLInputElement | null> } = {
    ref: input,
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    multiple: true,
    hidden: true,
    onChange: event => void upload(Array.from(event.currentTarget.files ?? [])),
  }
  const pick = (date: string) => {
    uploadDate.current = date
    input.current?.click()
  }
  return { counts, uploading, error, pick, inputProps }
}

/** A day's report in a calendar cell: open it for the slots, people and
 *  photos; the corner button adds photos straight from the calendar. */
export function DayReportCard({
  date,
  photos,
  uploading,
  busy,
  onOpen,
  onPick,
}: {
  date: string
  photos: number
  uploading: boolean
  busy: boolean
  onOpen: () => void
  onPick: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="month-report">
      <button className="month-report-open" onClick={onOpen} title={t('Open the day: slots, people and photos')}>
        <FileText />
        <span>
          <strong>{t('Daily work report')}</strong>
          <small>{t('Photos: {count}', { count: photos })}</small>
        </span>
      </button>
      <button
        className="month-report-photo"
        aria-label={t('Add photos for {date}', { date: formatDate(date) })}
        disabled={busy}
        onClick={onPick}
      >
        {uploading ? <LoaderCircle className="spin" /> : <ImagePlus />}
      </button>
    </div>
  )
}

/* The month as a calendar: one row per week, one cell per day. A day the
   client ordered work for shows its daily report (open it for the slots and
   the people); an empty day offers to add a slot. Editing a day happens in the
   day view — a month of full slot editors was the wall of panels this replaced. */
export function ScheduleMonth({
  vacancyId,
  anchor,
  today,
  workingDay,
  staffing,
  onOpenDay,
  onAddSlot,
}: {
  vacancyId: string
  anchor: string
  today: string
  workingDay: (date: string) => boolean
  /** People on the day against people needed; `short` only for days still to come. */
  staffing?: (date: string) => { filled: number; ordered: number; short: boolean } | null
  onOpenDay: (date: string) => void
  onAddSlot: (date: string) => void
}) {
  const { t } = useLanguage()
  const weeks = monthWeeks(anchor)
  const from = weeks[0].dates[0]
  const lastWeek = weeks[weeks.length - 1].dates
  const to = lastWeek[lastWeek.length - 1]
  const photos = useDayPhotos(vacancyId, from, to)
  /* On a phone the weeks fold up; the one holding today starts open. */
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(
    () => new Set([(weeks.find(w => w.dates.includes(today)) ?? weeks[0]).key]),
  )


  return (
    <div className="month-cal">
      <input {...photos.inputProps} />
      {photos.error && (
        <p className="dialog-note" role="alert">
          {t(photos.error)}
        </p>
      )}
      {weeks.map(week => {
        const worked = week.dates.filter(workingDay).length
        const short = week.dates.filter(date => staffing?.(date)?.short).length
        const open = openWeeks.has(week.key)
        const current = week.dates.includes(today)
        return (
          <section
            key={week.key}
            className={`month-week ${current ? 'current' : ''} ${open ? 'open' : ''}`}
            aria-label={t('Week {week}', { week: week.number })}
          >
            <button
              className="month-week-label"
              aria-expanded={open}
              onClick={() =>
                setOpenWeeks(cur => {
                  const next = new Set(cur)
                  if (next.has(week.key)) next.delete(week.key)
                  else next.add(week.key)
                  return next
                })
              }
            >
              <span>
                <strong>{t('Week {week}', { week: week.number })}</strong>
                <small>
                  {formatDate(week.dates[0])} – {formatDate(week.dates[week.dates.length - 1])}
                </small>
              </span>
              <em>
                {t('{worked} / {total} days', { worked, total: week.dates.length })}
                {short > 0 && <b className="month-week-short">{t('{count} short', { count: short })}</b>}
              </em>
              <ChevronDown className="month-week-chevron" />
            </button>
            <div className="month-week-days" style={{ ['--days' as string]: week.dates.length }}>
              {week.dates.map(date => {
                const staff = staffing?.(date) ?? null
                return (
                <div key={date} className={`month-day ${date === today ? 'today' : ''} ${staff?.short ? 'short' : ''}`}>
                  <div className="month-day-head">
                    <strong>{weekdayLabel[weekdayOf(date)]}</strong>
                    <span>{formatDate(date)}</span>
                    {staff && (
                      <em
                        className={`month-staff ${staff.short ? 'short' : staff.filled > staff.ordered ? 'over' : staff.filled < staff.ordered ? 'past' : 'full'}`}
                        title={t('{filled} of {ordered} people on this day', { filled: staff.filled, ordered: staff.ordered })}
                      >
                        {staff.filled}/{staff.ordered}
                      </em>
                    )}
                  </div>
                  {workingDay(date) ? (
                    <DayReportCard
                      date={date}
                      photos={photos.counts[date] ?? 0}
                      uploading={photos.uploading === date}
                      busy={photos.uploading !== null}
                      onOpen={() => onOpenDay(date)}
                      onPick={() => photos.pick(date)}
                    />
                  ) : (
                    <button className="month-add" onClick={() => onAddSlot(date)}>
                      <Plus />
                      {t('Add slot')}
                    </button>
                  )}
                </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

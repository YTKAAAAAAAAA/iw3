/**
 * The weekly hours sheet, in the client's own layout.
 *
 * The shape here is not invented: it follows the sheet the office already
 * sends out (report-week30-2026.xlsx) row for row — company name across the
 * top, our contact lines on the left, the week's dates above the weekday
 * names, one row per person with a formula in the totals column, and the
 * SUBTOTAL band at the foot that survives filtering. Accounts payable at the
 * other end reads these by eye every week; a report that arrives looking
 * different is a report somebody retypes.
 */
import type { Cell, SheetSpec } from './xlsx.ts'
import type { Company, HoursEntry, ISODate, RosterEntry, Vacancy, Worker } from './types.ts'
import { weekDates } from './types.ts'

/** Ours, printed under the company name. */
export const AGENCY_LINES = ['Internet : www.InternationalatWork.nl', 'E-mail    :  Info@iatw.nl']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export type ReportInput = {
  vacancy: Vacancy
  company: Company | undefined
  workers: Worker[]
  entries: HoursEntry[]
  /** Needed because a day nobody typed still counts as the default when the
   *  person was on the schedule. */
  roster: RosterEntry[]
  year: number
  week: number
}

export type ReportRow = { worker: Worker; cells: number[]; total: number }

/** Was this person on this vacancy that day, by the schedule? */
const scheduled = (workerId: string, vacancyId: string, date: ISODate, roster: RosterEntry[]) =>
  roster.some(r => r.workerId === workerId && r.vacancyId === vacancyId && r.date === date && r.outcome !== 'cancelled' && r.outcome !== 'no_show')

/** What a day is worth: what was typed, or the vacancy's default if the person
 *  was on the schedule and nobody touched the cell. A no-show is worth
 *  nothing, which is why the default is not applied blindly. */
export function hoursOn(input: ReportInput, workerId: string, date: ISODate): number {
  const entries = input.entries.filter(e => e.workerId === workerId && e.vacancyId === input.vacancy.id && e.date === date)
  const manual = entries.find(entry => entry.manual)
  if (manual) return manual.hours
  if (entries.length) return entries.reduce((sum, entry) => sum + entry.hours, 0)
  if (input.vacancy.defaultHours !== null && scheduled(workerId, input.vacancy.id, date, input.roster)) return input.vacancy.defaultHours
  return 0
}

/** Only people with something to report that week — the sheet is a claim for
 *  payment, not a directory. */
export function reportRows(input: ReportInput): ReportRow[] {
  const days = weekDates(input.year, input.week)
  return input.workers
    .map(worker => {
      const cells = days.map(date => hoursOn(input, worker.id, date))
      return { worker, cells, total: cells.reduce((a, b) => a + b, 0) }
    })
    .filter(row => row.total > 0)
    .sort((a, b) => a.worker.firstName.localeCompare(b.worker.firstName) || a.worker.lastName.localeCompare(b.worker.lastName))
}

/** Surname as the client writes it: the insertion belongs to the last name. */
export const lastNameOf = (worker: Worker) => [worker.insertion, worker.lastName].filter(Boolean).join(' ')

export function reportSheet(input: ReportInput): SheetSpec {
  const days = weekDates(input.year, input.week)
  const rows: Cell[][] = []
  const at = (index: number, cells: Record<number, Cell>): Cell[] => {
    const row: Cell[] = []
    for (const [column, cell] of Object.entries(cells)) row[Number(column)] = cell
    while (rows.length < index) rows.push([])
    return row
  }

  /* Columns: A first name, B last name, C CC, D project code, E–K the week,
     L a spacer, M totals, N a spacer, O remarks — the client's own order. */
  rows[0] = []
  rows[1] = at(1, { 8: { v: input.company?.name ?? '', s: 'title' } })
  rows[2] = at(2, { 0: { v: AGENCY_LINES[0], s: 'meta' }, 8: { v: 'weekly hours', s: 'title' } })
  rows[3] = at(3, { 0: { v: AGENCY_LINES[1], s: 'meta' } })
  rows[4] = at(4, { 7: { v: 'Week', s: 'label' }, 8: { v: input.week, s: 'accent' } })
  rows[5] = []
  rows[6] = []
  rows[7] = at(7, Object.fromEntries(days.map((date, i) => [4 + i, { date, s: 'date' } as Cell])))
  rows[8] = at(8, {
    0: { v: 'F-Name', s: 'headLeft' }, 1: { v: 'L-Name', s: 'headLeft' },
    2: { v: 'CC', s: 'headLeft' }, 3: { v: 'Projectcode', s: 'headLeft' },
    ...Object.fromEntries(WEEKDAYS.map((name, i) => [4 + i, { v: name, s: 'head' } as Cell])),
    12: { v: 'Totals', s: 'head' }, 14: { v: 'Remarks', s: 'headLeft' },
  })

  const body = reportRows(input)
  body.forEach((row, i) => {
    const r = 10 + i
    rows[r - 1] = at(r - 1, {
      0: { v: row.worker.firstName, s: 'text' },
      1: { v: lastNameOf(row.worker), s: 'text' },
      2: { v: '', s: 'text' },
      3: { v: input.vacancy.projectCode ?? '', s: 'text' },
      ...Object.fromEntries(row.cells.map((hours, d) => [4 + d, { v: hours, s: 'hours' } as Cell])),
      12: { f: `SUM(E${r}:K${r})`, s: 'total' },
    })
  })

  /* The foot uses SUBTOTAL so a filtered sheet still adds up to what is on
     screen — that is how the original behaves, and the office filters. */
  /* Never let the band collapse to a backwards range (A10:A9) on an empty
     week: Excel flips it and quietly swallows the header row. */
  const last = Math.max(10, 9 + body.length)
  const foot = last + 2
  rows[foot - 1] = at(foot - 1, {
    0: { f: `SUBTOTAL(3,A10:A${last})`, s: 'sum' },
    1: { f: `SUBTOTAL(3,B10:B${last})`, s: 'sum' },
    ...Object.fromEntries(days.map((_, d) => {
      const col = String.fromCharCode(69 + d)
      return [4 + d, { f: `SUBTOTAL(9,${col}10:${col}${last})`, s: 'sum' } as Cell]
    })),
    12: { f: `SUM(M10:M${last})`, s: 'sum' },
  })
  rows[foot + 1] = at(foot + 1, { 0: { v: 'Voor', s: 'label' }, 1: { v: 'Akkoord', s: 'label' } })

  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = []

  return {
    name: 'Urenstaat',
    rows,
    cols: [12.6, 17.4, 9, 11.4, 13.1, 10, 10, 10, 10, 10, 10, 3.7, 13.6, 5.3, 55.7],
    freezeRows: 9,
  }
}

/** `Warehouse_Week_30_2026.xlsx` — the name the office already files under. */
export const reportFilename = (input: ReportInput) =>
  `${(input.company?.name ?? input.vacancy.title).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_Week_${input.week}_${input.year}.xlsx`

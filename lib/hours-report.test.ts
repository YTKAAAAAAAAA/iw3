import test from 'node:test'
import assert from 'node:assert/strict'
import { hoursOn, lastNameOf, reportFilename, reportRows, reportSheet } from './hours-report.ts'
import type { ReportInput } from './hours-report.ts'
import type { Cell } from './xlsx.ts'
import type { HoursEntry, RosterEntry, Vacancy, Worker } from './types.ts'

/* Week 25 of 2024 runs Mon 17 – Sun 23 June. */
const WEEK = { year: 2024, week: 25 }

const worker = (id: string, firstName: string, lastName: string, insertion: string | null = null): Worker => ({
  id, flexpediaId: null, manatalCandidateId: null, initials: 'XX', firstName, insertion, lastName,
  fullName: [firstName, insertion, lastName].filter(Boolean).join(' '), gender: null, birthDate: null,
  street: null, streetNumber: null, streetNumberAddition: null, postCode: null, city: null,
  residenceCountry: null, nationality: null, phone: null, phoneCountry: null, mobile: null,
  email: `${id}@example.com`, lat: null, lon: null, geocodedAt: null, notes: '', hasCar: true,
  status: 'active', dismissedAt: null, companyAccess: ['c-1'], manatalLink: 'linked', cvUrl: null,
})
const shift = (workerId: string, date: string, outcome: RosterEntry['outcome'] = 'planned'): RosterEntry => ({
  id: `r-${workerId}-${date}`, vacancyId: 'v-1', date, placeId: null, section: null, workerId,
  extra: false, extraReason: null, standingId: null, start: null, end: null,
  outcome, actualEnd: null, coversShiftId: null, note: null,
})
const entry = (workerId: string, date: string, hours: number): HoursEntry =>
  ({ id: `h-${workerId}-${date}`, workerId, vacancyId: 'v-1', date, hours })

const vacancy = (defaultHours: number | null): Vacancy => ({
  id: 'v-1', title: 'Warehouse', companyId: 'c-1', address: '', lat: null, lon: null, description: '',
  startDate: '2024-01-01', endDate: null, trackHoursManually: true, places: [], carOnly: false,
  defaultHours, projectCode: 'ALWct',
  schedule: { weekdays: ['mon'], start: { kind: 'fixed', time: '07:00' }, end: { kind: 'fixed', time: '16:00' },
    headcount: { kind: 'fixed', count: 1 }, horizon: 'week', plannedBy: 'agency' },
})

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  vacancy: vacancy(8), company: { id: 'c-1', name: 'Amsterdam Warehouse & Company', contactPerson: null, phone: null, notes: null, logoUrl: null },
  workers: [worker('w-1', 'Andrii', 'Kotiuk'), worker('w-2', 'Sofia', 'Meer', 'van der')],
  entries: [], roster: [], ...WEEK, ...over,
})

const cellAt = (rows: Cell[][], row: number, col: number) => {
  const cell = rows[row - 1]?.[col]
  return cell && typeof cell === 'object' ? cell : { v: cell }
}

test('a scheduled day nobody typed is worth the default', () => {
  const i = input({ roster: [shift('w-1', '2024-06-17')] })
  assert.equal(hoursOn(i, 'w-1', '2024-06-17'), 8)
  /* Not scheduled that day — the default is not a blanket. */
  assert.equal(hoursOn(i, 'w-1', '2024-06-18'), 0)
})

test('what was typed always wins, including a typed zero', () => {
  const i = input({ roster: [shift('w-1', '2024-06-17')], entries: [entry('w-1', '2024-06-17', 5.25)] })
  assert.equal(hoursOn(i, 'w-1', '2024-06-17'), 5.25)
  const zero = input({ roster: [shift('w-1', '2024-06-17')], entries: [entry('w-1', '2024-06-17', 0)] })
  assert.equal(hoursOn(zero, 'w-1', '2024-06-17'), 0)
})

test('a no-show is not paid the default', () => {
  const i = input({ roster: [shift('w-1', '2024-06-17', 'no_show')] })
  assert.equal(hoursOn(i, 'w-1', '2024-06-17'), 0)
})

test('with no default set, only typed hours count', () => {
  const i = input({ vacancy: vacancy(null), roster: [shift('w-1', '2024-06-17')] })
  assert.equal(hoursOn(i, 'w-1', '2024-06-17'), 0)
})

test('only people with something to claim appear, first name first', () => {
  const i = input({ roster: [shift('w-2', '2024-06-17'), shift('w-1', '2024-06-18')] })
  const rows = reportRows(i)
  assert.deepEqual(rows.map(r => r.worker.id), ['w-1', 'w-2'])
  assert.deepEqual(rows[0].cells, [0, 8, 0, 0, 0, 0, 0])
  assert.equal(rows[0].total, 8)
})

test('the surname carries the insertion, the way the client writes it', () => {
  assert.equal(lastNameOf(worker('w-2', 'Sofia', 'Meer', 'van der')), 'van der Meer')
  assert.equal(lastNameOf(worker('w-1', 'Andrii', 'Kotiuk')), 'Kotiuk')
})

test('the sheet lands in the client’s layout', () => {
  const i = input({ roster: [shift('w-1', '2024-06-17')] })
  const sheet = reportSheet(i)
  assert.equal(sheet.name, 'Urenstaat')
  assert.equal(sheet.freezeRows, 9)
  /* Company name centred at the top — I2, exactly where their own sheet has it. */
  assert.deepEqual(cellAt(sheet.rows, 2, 8), { v: 'Amsterdam Warehouse & Company', s: 'title' })
  assert.deepEqual(cellAt(sheet.rows, 3, 8), { v: 'weekly hours', s: 'title' })
  assert.deepEqual(cellAt(sheet.rows, 5, 8), { v: 25, s: 'accent' })
  /* Monday's date above Monday's name. */
  assert.deepEqual(cellAt(sheet.rows, 8, 4), { date: '2024-06-17', s: 'date' })
  assert.deepEqual(cellAt(sheet.rows, 9, 4), { v: 'Monday', s: 'head' })
  assert.deepEqual(cellAt(sheet.rows, 9, 12), { v: 'Totals', s: 'head' })
  /* First data row, its project code and its live total. */
  assert.deepEqual(cellAt(sheet.rows, 10, 0), { v: 'Andrii', s: 'text' })
  assert.deepEqual(cellAt(sheet.rows, 10, 3), { v: 'ALWct', s: 'text' })
  assert.deepEqual(cellAt(sheet.rows, 10, 4), { v: 8, s: 'hours' })
  assert.deepEqual(cellAt(sheet.rows, 10, 12), { f: 'SUM(E10:K10)', s: 'total' })
  /* Foot: SUBTOTAL so a filtered sheet still adds up, then the signature. */
  assert.deepEqual(cellAt(sheet.rows, 12, 4), { f: 'SUBTOTAL(9,E10:E10)', s: 'sum' })
  assert.deepEqual(cellAt(sheet.rows, 14, 0), { v: 'Voor', s: 'label' })
})

test('the file is named the way the office already files it', () => {
  assert.equal(reportFilename(input()), 'Amsterdam_Warehouse_Company_Week_25_2024.xlsx')
})

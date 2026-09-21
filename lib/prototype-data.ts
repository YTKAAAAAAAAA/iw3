import { demand, roster, vacancies, workers } from './mock-data'
import type { AttendanceState, ConfirmationState, PrototypeAttention, PrototypeAttendance, PrototypeChange, PrototypeConfirmation, Requirement } from './types'

export const prototypeVacancyId = 'v-warehouse'
export const prototypeDate = '2024-06-19'

export const prototypeRequirements: Requirement[] = [
  { id: 'req-car', kind: 'transport', label: 'Own car', required: true },
  { id: 'req-vog', kind: 'document', label: 'VOG on file', required: true },
  { id: 'req-warehouse', kind: 'skill', label: 'Warehouse experience', required: true },
  { id: 'req-dutch', kind: 'language', label: 'Dutch or English', required: false },
]

export const prototypeConfirmations: PrototypeConfirmation[] = [
  { id: 'pc-1', shiftId: 'r-wh-2-0', workerId: 'w-01', state: 'accepted', lastContact: '2024-06-18T17:42:00Z', note: 'Confirmed by WhatsApp' },
  { id: 'pc-2', shiftId: 'r-wh-2-1', workerId: 'w-02', state: 'no_response', lastContact: '2024-06-18T16:10:00Z', note: 'Reminder sent' },
  { id: 'pc-3', shiftId: 'r-wh-2-2', workerId: 'w-03', state: 'accepted', lastContact: '2024-06-18T18:03:00Z', note: null },
  { id: 'pc-4', shiftId: 'r-wh-2-3', workerId: 'w-04', state: 'offered', lastContact: '2024-06-18T18:20:00Z', note: 'Waiting for reply' },
]

export const prototypeAttendance: PrototypeAttendance[] = [
  { shiftId: 'r-wh-2-0', state: 'present', actualStart: '07:02', actualEnd: null, breakMinutes: 30, note: null },
  { shiftId: 'r-wh-2-1', state: 'late', actualStart: '07:22', actualEnd: null, breakMinutes: 30, note: 'Traffic on A13' },
  { shiftId: 'r-wh-2-2', state: 'left_early', actualStart: '07:00', actualEnd: '10:00', breakMinutes: 0, note: 'Went home ill' },
  { shiftId: 'r-wh-2-3', state: 'no_show', actualStart: null, actualEnd: null, breakMinutes: 0, note: 'Could not reach worker' },
]

export const prototypeChanges: PrototypeChange[] = [
  { id: 'change-1', at: '2024-06-18T14:32:00Z', author: 'Office', type: 'order', text: 'Conakryweg headcount changed from 1 to 2' },
  { id: 'change-2', at: '2024-06-18T15:10:00Z', author: 'DHL site', type: 'time', text: 'Start moved from 07:00 to 06:00 for Slego · Inbound' },
  { id: 'change-3', at: '2024-06-19T10:05:00Z', author: 'Office', type: 'assignment', text: 'Mohamed El Amrani added as cover from 12:00' },
]

export const prototypeAttention: PrototypeAttention[] = [
  { id: 'att-1', severity: 'critical', kind: 'replacement', title: 'Cover needed for Slego · Inbound', detail: 'Fatima left at 10:00. The client is uncovered until 12:00.', vacancyId: prototypeVacancyId, date: prototypeDate, action: 'Find cover' },
  { id: 'att-2', severity: 'critical', kind: 'confirmation', title: 'No-show not replaced', detail: 'Omar has not arrived for the 07:00 shift.', vacancyId: prototypeVacancyId, date: prototypeDate, action: 'Replace now' },
  { id: 'att-3', severity: 'warning', kind: 'confirmation', title: 'Two people still need to confirm', detail: 'The warehouse roster goes out tomorrow at 06:00.', vacancyId: prototypeVacancyId, date: prototypeDate, action: 'Send reminders' },
  { id: 'att-4', severity: 'warning', kind: 'client', title: 'Client changed the order', detail: 'One extra person is requested for Conakryweg.', vacancyId: prototypeVacancyId, date: prototypeDate, action: 'Review change' },
  { id: 'att-5', severity: 'info', kind: 'hours', title: 'End-of-day check is open', detail: '3 of 5 attendance records still need a final hour.', vacancyId: prototypeVacancyId, date: prototypeDate, action: 'Close day' },
]

export const confirmationLabel: Record<ConfirmationState, string> = {
  not_contacted: 'Not contacted', offered: 'Awaiting reply', accepted: 'Confirmed', declined: 'Declined', no_response: 'No response', cancelled: 'Cancelled',
}
export const attendanceLabel: Record<AttendanceState, string> = {
  not_started: 'Not started', on_the_way: 'On the way', present: 'Present', late: 'Late', left_early: 'Left early', no_show: 'No show', worked: 'Worked',
}

export const prototypeShifts = roster.filter(r => r.vacancyId === prototypeVacancyId && r.date === prototypeDate)
export const prototypeDemand = demand.filter(d => d.vacancyId === prototypeVacancyId && d.date === prototypeDate)
export const prototypeWorkers = workers.filter(w => prototypeShifts.some(s => s.workerId === w.id))
export const prototypeVacancy = vacancies.find(v => v.id === prototypeVacancyId) ?? vacancies[0]

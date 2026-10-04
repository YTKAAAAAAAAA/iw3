import { type PickedAddress } from '@/components/address-picker'
import { timingOf } from '@/lib/derive'
import type { Requirement, Vacancy, VacancyPlace, Weekday } from '@/lib/types'

/* ------------------------------------------------------------------
   One form for a vacancy, used both to create one and to edit one.

   Two separate forms drift: a field added to creation quietly goes missing
   from editing, and the office finds out when a client asks for a change
   nobody can make. So there is one set of fields and one draft shape, and
   both screens render it.
   ------------------------------------------------------------------ */
export type VacancyDraft = {
  title: string
  companyId: string
  address: PickedAddress | null
  description: string
  startDate: string
  endDate: string | null
  timing: 'window' | 'start' | 'none'
  start: string | null
  end: string | null
  weekdays: Weekday[]
  headcount: number
  places: VacancyPlace[]
  carOnly: boolean
  requiresAvailableList: boolean
  trackHoursManually: boolean
  defaultHours: string
  projectCode: string
  requirements: Requirement[]
}

export const draftFromVacancy = (v: Vacancy): VacancyDraft => ({
  title: v.title,
  companyId: v.companyId,
  address: v.lat !== null && v.lon !== null ? { label: v.address, lat: v.lat, lon: v.lon } : null,
  description: v.description,
  startDate: v.startDate,
  endDate: v.endDate,
  timing: timingOf(v.schedule),
  start: v.schedule.start.kind === 'fixed' ? v.schedule.start.time : null,
  end: v.schedule.end.kind === 'fixed' ? v.schedule.end.time : null,
  weekdays: v.schedule.weekdays,
  headcount:
    v.schedule.headcount.kind === 'fixed'
      ? v.schedule.headcount.count
      : v.schedule.headcount.kind === 'perDate'
        ? v.schedule.headcount.typical
        : 1,
  places: v.places,
  carOnly: v.carOnly,
  requiresAvailableList: v.requiresAvailableList ?? false,
  requirements: v.requirements ?? [],
  trackHoursManually: v.trackHoursManually,
  defaultHours: v.defaultHours === null ? '' : String(v.defaultHours),
  projectCode: v.projectCode ?? '',
})

/** The draft back onto the vacancy. Rules the draft cannot express — a start
 *  chosen per day, a headcount that varies by weekday — are left exactly as
 *  they were rather than flattened into something simpler. */
export const applyDraft = (v: Vacancy, d: VacancyDraft): Vacancy => ({
  ...v,
  title: d.title.trim() || v.title,
  companyId: d.companyId,
  address: d.address?.label ?? v.address,
  lat: d.address?.lat ?? v.lat,
  lon: d.address?.lon ?? v.lon,
  description: d.description,
  startDate: d.startDate,
  endDate: d.endDate,
  places: d.places,
  carOnly: d.carOnly,
  requiresAvailableList: d.requiresAvailableList,
  requirements: d.requirements,
  trackHoursManually: d.trackHoursManually,
  defaultHours: d.defaultHours.trim() === '' ? null : Number(d.defaultHours),
  projectCode: d.projectCode.trim() || null,
  schedule: {
    ...v.schedule,
    weekdays: d.weekdays,
    start:
      d.timing === 'none'
        ? { kind: 'none' }
        : v.schedule.start.kind === 'fixed' || d.start
          ? { kind: 'fixed', time: d.start ?? '08:00' }
          : v.schedule.start,
    end:
      d.timing === 'window'
        ? v.schedule.end.kind === 'fixed' || d.end
          ? { kind: 'fixed', time: d.end ?? '16:30' }
          : v.schedule.end
        : { kind: 'open' },
    headcount:
      v.schedule.headcount.kind === 'perDate'
        ? { kind: 'perDate', typical: d.headcount }
        : v.schedule.headcount.kind === 'byWeekday'
          ? v.schedule.headcount
          : { kind: 'fixed', count: d.headcount },
  },
})

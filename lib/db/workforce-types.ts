export type WarehousePerson = {
  id: number
  fullName: string
  preferredSite: string | null
  preferredSiteName: string | null
  rating: 'green' | 'yellow' | 'new'
  language: string | null
  fixedCourseDays: string | null
  isActive: boolean
  isFired: boolean
  recommended: boolean
}

export type WarehouseShift = {
  id: number
  date: string
  workerId: number | null
  workerName: string | null
  siteSlug: string
  siteName: string
  section: string | null
  hours: number
  isExtra: boolean
}

export type WarehouseAbsence = {
  id: number
  workerId: number
  workerName: string
  startDate: string
  endDate: string
  reason: string | null
}

export type WarehouseSite = {
  slug: string
  name: string
  address: string
}

export type WarehouseRequirement = {
  id: number
  kind: string
  label: string
  required: boolean
}

export type WarehouseVacancy = {
  id: number
  slug: string
  title: string
  companyName: string
  description: string
  address: string | null
  startDate: string | null
  endDate: string | null
  trackHoursManually: boolean
  defaultHours: number | null
  sites: WarehouseSite[]
  requirements: WarehouseRequirement[]
}

export type WarehouseOverviewData = {
  today: string
  activePeople: number
  totalPeople: number
  totalShifts: number
  shiftsToday: WarehouseShift[]
  absencesToday: WarehouseAbsence[]
}

export type WarehousePersonProfile = WarehousePerson & {
  phone: string | null
  notes: string | null
  shifts: WarehouseShift[]
  absences: WarehouseAbsence[]
}

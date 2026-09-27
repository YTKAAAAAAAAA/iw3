import type {
  AppData,
  Company,
  Demand,
  HoursEntry,
  Leave,
  ManatalCandidate,
  Offer,
  RosterEntry,
  StandingAssignment,
  SyncState,
  Vacancy,
  Worker,
} from './types'

export const workers: Worker[] = []
export const companies: Company[] = []
export const vacancies: Vacancy[] = []
export const standing: StandingAssignment[] = []
export const assignments = standing
export const leaves: Leave[] = []
export const offers: Offer[] = []
export const roster: RosterEntry[] = []
export const hours: HoursEntry[] = []
export const demand: Demand[] = []
export const sync: SyncState[] = []
export const mockData: AppData = { workers, companies, vacancies, standing, roster, leaves, hours, sync }
export const manatalCandidates: ManatalCandidate[] = []

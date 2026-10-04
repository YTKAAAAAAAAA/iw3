'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AppData, Demand, HomeArea, Offer, PersonalDetails, TravelDistance } from '@/lib/types'

/** What a page can ask for on top of the base data (people, companies,
 *  vacancies and sync status). Each page loads only the parts it shows, so
 *  schedule history and personal details are not sent where they are unused. */
export const WORKFORCE_PARTS = ['schedule', 'leaves', 'hours', 'travel'] as const
export type WorkforcePart = (typeof WORKFORCE_PARTS)[number]

export type WorkforceScope = {
  include?: WorkforcePart[]
  /** Contact and identity details are loaded for this one worker only. */
  personalDetailsFor?: string
}

export type WorkforceData = AppData & {
  demand: Demand[]
  offers: Offer[]
  candidateVisibility: CandidateVisibility[]
  travel: TravelDistance[]
  homeAreas: HomeArea[]
  personalDetails: PersonalDetails | null
}

export type CandidateVisibility = {
  vacancyId: string
  workerId: string
  date: string | null
  hidden: boolean
}

const WorkforceDataContext = createContext<WorkforceData | null>(null)

export function WorkforceDataProvider({ data, children }: { data: WorkforceData; children: ReactNode }) {
  return <WorkforceDataContext.Provider value={data}>{children}</WorkforceDataContext.Provider>
}

export function useWorkforceData(): WorkforceData {
  const data = useContext(WorkforceDataContext)
  if (!data) throw new Error('Workforce data is missing from the page provider.')
  return data
}

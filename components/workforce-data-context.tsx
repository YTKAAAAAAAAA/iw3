'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AppData, Demand, ManatalCandidate, Offer } from '@/lib/types'

export type WorkforceData = AppData & {
  demand: Demand[]
  offers: Offer[]
  manatalCandidates: ManatalCandidate[]
  candidateVisibility: CandidateVisibility[]
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

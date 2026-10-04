'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { todayInAmsterdam, type ISODate } from './types'

const TodayContext = createContext<ISODate | null>(null)

/* The server passes the date it rendered with, so hydration matches. After
   that the browser keeps it current: a tab left open overnight, or a laptop
   woken from sleep, moves to the new day within a minute. */
export function TodayProvider({ initial, children }: { initial: ISODate; children: ReactNode }) {
  const [today, setToday] = useState(initial)

  useEffect(() => {
    const check = () => setToday(todayInAmsterdam())
    check()
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  return <TodayContext.Provider value={today}>{children}</TodayContext.Provider>
}

export function useToday(): ISODate {
  const today = useContext(TodayContext)
  if (!today) throw new Error('TodayProvider is missing.')
  return today
}

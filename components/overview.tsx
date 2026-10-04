'use client'

import { AppShell, Badge, PageHeading, Panel } from '@/components/app-shell'
import { PeopleTable } from '@/components/people/people-table'
import { useWorkforceData } from '@/components/workforce-data-context'
import { availableWorkers, dayStatus, vacancyStatus } from '@/lib/derive'
import { formatDate } from '@/lib/types'
import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react'
import Link from 'next/link'
import { useToday } from '@/lib/today'

export function Metric({
  label,
  value,
  caption,
  href,
}: {
  label: string
  value: string | number
  caption: string
  href: string
}) {
  return (
    <Link href={href} className="metric-card">
      <div className="metric-label">
        {label}
        <ArrowUpRight />
      </div>
      <div className="metric-value-row">
        <strong>{value}</strong>
      </div>
      <span className="metric-caption">{caption}</span>
    </Link>
  )
}
export function Overview() {
  const today = useToday()
  const { workers, companies, roster, leaves, vacancies, standing, hours } = useWorkforceData()
  const active = workers.filter(w => w.status === 'active')
  const free = availableWorkers(workers, today, roster, leaves, vacancies)
  const open = vacancies.filter(v => vacancyStatus(v, standing, roster, today) === 'open')
  const leave = workers.filter(w => dayStatus(w.id, today, roster, leaves, vacancies) === 'leave')
  return (
    <AppShell>
      <div className="content-inner">
        <PageHeading
          eyebrow="Workspace"
          title={new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(`${today}T12:00:00`))}
          description="Here’s what’s happening across your workforce today."
          action={
            <Link className="button button-primary" href="/vacancies/new">
              <Plus />
              Create vacancy
            </Link>
          }
        />
        <section className="metrics-grid">
          <Metric
            label="Open vacancies"
            value={open.length}
            caption={`${vacancies.length} total vacancies`}
            href="/vacancies"
          />
          <Metric
            label="People available"
            value={free.length}
            caption={`of ${active.length} active people`}
            href="/people"
          />
          <Metric
            label="On leave today"
            value={leave.length}
            caption="Leave takes priority over work"
            href="/people"
          />
          <Metric
            label="Total people"
            value={active.length}
            caption={`${workers.length - active.length} dismissed workers`}
            href="/people?status=dismissed"
          />
        </section>
        <div className="dashboard-grid">
          <Panel>
            <div className="panel-header">
              <div>
                <h2>Today’s availability</h2>
                <p>People ready for assignment</p>
              </div>
              <Link className="text-button" href="/people">
                View people <ArrowUpRight />
              </Link>
            </div>
            {free.slice(0, 5).map(w => (
              <Link className="availability-row" href={`/people/${w.id}`} key={w.id}>
                <div>
                  <strong>{w.fullName}</strong>
                  <span>{w.city} · Available today</span>
                </div>
                <Badge tone="green">Free</Badge>
              </Link>
            ))}
          </Panel>
          <Panel>
            <div className="panel-header">
              <div>
                <h2>Coming up</h2>
                <p>Leave and roster overview</p>
              </div>
              <CalendarDays />
            </div>
            {leaves.slice(0, 4).map(l => {
              const w = workers.find(x => x.id === l.workerId)
              return (
                w && (
                  <Link className="coming-item" href={`/people/${w.id}`} key={l.id}>
                    <div className="date-block">
                      <strong>{l.date.slice(-2)}</strong>
                      <span>{formatDate(l.date).split(' ')[1]}</span>
                    </div>
                    <div>
                      <strong>{w.fullName}</strong>
                      <span>
                        {l.reason} · {formatDate(l.date)}
                      </span>
                    </div>
                  </Link>
                )
              )
            })}
          </Panel>
        </div>
        <Panel className="people-preview">
          <div className="panel-header">
            <div>
              <h2>People</h2>
              <p>Recently active and available workers</p>
            </div>
            <Link className="text-button" href="/people">
              View all people <ArrowUpRight />
            </Link>
          </div>
          <PeopleTable compact />
        </Panel>
      </div>
    </AppShell>
  )
}

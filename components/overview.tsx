'use client'

import { AppShell, Badge, PageHeading, Panel } from '@/components/app-shell'
import { PeopleTable } from '@/components/people/people-table'
import { useWorkforceData } from '@/components/workforce-data-context'
import { availableWorkers, dayStatus, upcomingAbsences, vacancyStatus } from '@/lib/derive'
import { useLanguage } from '@/lib/i18n'
import { useToday } from '@/lib/today'
import { formatDate } from '@/lib/types'
import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react'
import Link from 'next/link'

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
  const { t, locale } = useLanguage()
  const { workers, roster, leaves, vacancies, standing } = useWorkforceData()
  const active = workers.filter(w => w.status === 'active')
  const free = availableWorkers(workers, today, roster, leaves, vacancies)
  const open = vacancies.filter(v => vacancyStatus(v, standing, roster, today) === 'open')
  const onLeave = active.filter(w => dayStatus(w.id, today, roster, leaves, vacancies) === 'leave')
  const workerById = new Map(workers.map(w => [w.id, w]))
  const comingUp = upcomingAbsences(leaves, today)
    .filter(period => workerById.get(period.workerId)?.status === 'active')
    .slice(0, 4)
  const weekday = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    timeZone: 'Europe/Amsterdam',
  }).format(new Date(`${today}T12:00:00Z`))

  return (
    <AppShell>
      <div className="content-inner">
        <PageHeading
          eyebrow="Workspace"
          title={`${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDate(today)}`}
          description="Here’s what’s happening across your workforce today."
          action={
            <Link className="button button-primary" href="/vacancies/new">
              <Plus />
              {t('Create vacancy')}
            </Link>
          }
        />
        <section className="metrics-grid">
          <Metric
            label={t('Open vacancies')}
            value={open.length}
            caption={t('{count} vacancies in total', { count: vacancies.length })}
            href="/vacancies"
          />
          <Metric
            label={t('People available')}
            value={free.length}
            caption={t('of {count} active people', { count: active.length })}
            href="/people"
          />
          <Metric
            label={t('On leave today')}
            value={onLeave.length}
            caption={t('Leave takes priority over work')}
            href="/people"
          />
          <Metric
            label={t('Total people')}
            value={workers.length}
            caption={t('{active} active · {dismissed} dismissed', {
              active: active.length,
              dismissed: workers.length - active.length,
            })}
            href="/people"
          />
        </section>
        <div className="dashboard-grid">
          <Panel>
            <div className="panel-header">
              <div>
                <h2>{t('Today’s availability')}</h2>
                <p>{t('People ready for assignment')}</p>
              </div>
              <Link className="text-button" href="/people">
                {t('View people')} <ArrowUpRight />
              </Link>
            </div>
            {free.slice(0, 5).map(w => (
              <Link className="availability-row" href={`/people/${w.id}`} key={w.id}>
                <div>
                  <strong>{w.fullName}</strong>
                  <span>{[w.city, t('Available today')].filter(Boolean).join(' · ')}</span>
                </div>
                <Badge tone="green">Free</Badge>
              </Link>
            ))}
            {!free.length && <p className="panel-empty">{t('Nobody is free today.')}</p>}
          </Panel>
          <Panel>
            <div className="panel-header">
              <div>
                <h2>{t('Coming up')}</h2>
                <p>{t('Current and upcoming absences')}</p>
              </div>
              <CalendarDays />
            </div>
            {comingUp.map(period => {
              const w = workerById.get(period.workerId)!
              const [, month, day] = period.from.split('-')
              return (
                <Link
                  className="coming-item"
                  href={`/people/${w.id}`}
                  key={`${period.workerId}-${period.from}-${period.reason}`}
                >
                  <div className="date-block" aria-hidden="true">
                    <strong>{day}</strong>
                    <span>{month}</span>
                  </div>
                  <div>
                    <strong>{w.fullName}</strong>
                    <span>
                      {t(period.reason)} ·{' '}
                      {period.from === period.to
                        ? formatDate(period.from)
                        : `${formatDate(period.from)} – ${formatDate(period.to)}`}
                    </span>
                  </div>
                </Link>
              )
            })}
            {!comingUp.length && <p className="panel-empty">{t('No absences planned.')}</p>}
          </Panel>
        </div>
        <Panel className="people-preview">
          <div className="panel-header">
            <div>
              <h2>{t('People')}</h2>
              <p>{t('Recently active and available workers')}</p>
            </div>
            <Link className="text-button" href="/people">
              {t('View all people')} <ArrowUpRight />
            </Link>
          </div>
          <PeopleTable compact />
        </Panel>
      </div>
    </AppShell>
  )
}

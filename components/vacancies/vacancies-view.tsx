'use client'

import { AppShell, Badge, PageHeading, Panel, StateBlock } from '@/components/app-shell'
import { CompanyAvatar } from '@/components/company-avatar'
import { useWorkforceData } from '@/components/workforce-data-context'
import { vacancyAttention, type Attention } from '@/lib/derive'
import { useLanguage } from '@/lib/i18n'
import { ArrowUpRight, Briefcase, Plus } from 'lucide-react'
import { formatDate, joinDetails } from '@/lib/types'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useToday } from '@/lib/today'

type Tab = 'open' | 'in_progress' | 'archived'
const SORT_KEY = 'iatw-vacancy-sort'

export function VacanciesView() {
  const today = useToday()
  const { vacancies, standing, roster, companies, demand, leaves } = useWorkforceData()
  const { t } = useLanguage()
  const [tab, setTab] = useState<Tab>('open')
  const [companyId, setCompanyId] = useState('all')
  const [order, setOrder] = useState<'nearest' | 'farthest'>('nearest')
  /* Read after mounting, so the server's HTML and the first render agree. */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SORT_KEY) === 'farthest') setOrder('farthest')
    } catch {
      // Without storage the order starts at "nearest" every time.
    }
  }, [])
  const changeOrder = (next: 'nearest' | 'farthest') => {
    setOrder(next)
    try {
      window.localStorage.setItem(SORT_KEY, next)
    } catch {
      // The order is a convenience; it simply is not remembered without storage.
    }
  }

  const attention = useMemo(
    () => new Map(vacancies.map(v => [v.id, vacancyAttention(v, demand, roster, standing, leaves, today)])),
    [vacancies, demand, roster, standing, leaves, today],
  )
  const filtered = vacancies.filter(v => companyId === 'all' || v.companyId === companyId)
  const inTab = (value: Tab) => filtered.filter(v => attention.get(v.id)?.status === value)
  /* Opening on an empty "Open" tab while a running job needs people hid the
     one thing worth seeing. Start where the attention is, else where the jobs are. */
  const [tabChosen, setTabChosen] = useState(false)
  useEffect(() => {
    if (tabChosen) return
    const tabs: Tab[] = ['open', 'in_progress']
    const urgent = tabs.find(value => inTab(value).some(v => attention.get(v.id)?.needsAttention))
    const busy = tabs.find(value => inTab(value).length > 0)
    const start = urgent ?? busy
    if (start) setTab(start)
    // Only the first choice is automatic; inTab reads the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attention, tabChosen])
  /* Anything that needs people sits on top, the earliest gap first; the rest
     follow the chosen order of start dates. */
  const list = [...inTab(tab)].sort((a, b) => {
    const x = attention.get(a.id)!, y = attention.get(b.id)!
    if (x.needsAttention !== y.needsAttention) return x.needsAttention ? -1 : 1
    if (x.needsAttention && y.needsAttention) {
      const gap = x.shortDays[0].date.localeCompare(y.shortDays[0].date)
      if (gap) return gap
    }
    const byStart = a.startDate.localeCompare(b.startDate)
    return (order === 'nearest' ? byStart : -byStart) || a.title.localeCompare(b.title)
  })

  const when = (a: Attention, startDate: string, endDate: string | null, archivedAt?: string | null) => {
    if (a.status === 'open')
      return a.daysToStart === 1
        ? t('Starts tomorrow · {date}', { date: formatDate(startDate) })
        : t('Starts in {count} days · {date}', { count: a.daysToStart, date: formatDate(startDate) })
    if (a.status === 'in_progress')
      return a.daysToStart === 0
        ? t('Started today')
        : t('Started {date}', { date: formatDate(startDate) })
    return archivedAt
      ? t('Archived {date}', { date: formatDate(archivedAt) })
      : t('Ended {date}', { date: formatDate(endDate) })
  }

  return (
    <AppShell>
      <div className="content-inner">
        <PageHeading
          eyebrow="Assignments"
          title="Vacancies"
          description="Client orders and the people assigned to them."
          action={
            <Link className="button button-primary" href="/vacancies/new">
              <Plus />
              {t('Create vacancy')}
            </Link>
          }
        />
        <div className="table-toolbar vacancy-company-filter">
          <label>
            {t('Company filter')}
            <select
              value={companyId}
              onChange={event => setCompanyId(event.target.value)}
              aria-label={t('Company filter')}
            >
              <option value="all">{t('All companies')}</option>
              {companies.filter(company => !company.archivedAt).map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Sort by start')}
            <select value={order} onChange={event => changeOrder(event.target.value as 'nearest' | 'farthest')}>
              <option value="nearest">{t('Nearest first')}</option>
              <option value="farthest">{t('Farthest first')}</option>
            </select>
          </label>
        </div>
        <div className="tabs">
          {(['open', 'in_progress', 'archived'] as const).map(value => {
            const count = inTab(value).length
            const alerts = inTab(value).filter(v => attention.get(v.id)?.needsAttention).length
            return (
              <button
                key={value}
                onClick={() => {
                  setTab(value)
                  setTabChosen(true)
                }}
                className={tab === value ? 'active' : ''}
              >
                {value === 'in_progress' ? t('In progress') : t(value[0].toUpperCase() + value.slice(1))}{' '}
                <span>{count}</span>
                {alerts > 0 && (
                  <i className="tab-alert" title={t('{count} need people', { count: alerts })}>
                    {alerts}
                  </i>
                )}
              </button>
            )
          })}
        </div>
        <Panel className="full-panel">
          {list.length ? (
            list.map(v => {
              const a = attention.get(v.id)!
              const company = companies.find(c => c.id === v.companyId)
              return (
                /* The whole row opens the vacancy (a stretched link); each short day
                   is its own link straight to that day, so a gap is one click away. */
                <div className={`vacancy-row ${a.needsAttention ? 'urgency-late' : ''}`} key={v.id}>
                  <div className="vacancy-icon">
                    <Briefcase />
                  </div>
                  <div>
                    <Link className="vacancy-row-link" href={`/vacancies/${v.id}`}>
                      <strong className="vacancy-title">
                        {v.title}
                        <CompanyAvatar company={company} />
                      </strong>
                    </Link>
                    <span>{joinDetails(company?.name, v.address)}</span>
                    {a.needsAttention && (
                      <span className="vacancy-short-days">
                        {a.shortDays.slice(0, 4).map(day => (
                          <Link
                            key={day.date}
                            href={`/vacancies/${v.id}?day=${day.date}`}
                            title={t('{staffed} of {needed} people — open this day', { staffed: day.staffed, needed: day.needed })}
                          >
                            {formatDate(day.date)} · {day.staffed}/{day.needed}
                          </Link>
                        ))}
                        {a.shortDays.length > 4 && <em>{t('+{count} more', { count: a.shortDays.length - 4 })}</em>}
                      </span>
                    )}
                  </div>
                  <Badge
                    tone={
                      a.needsAttention ? 'urgent' : a.status === 'open' ? 'green' : a.status === 'archived' ? 'neutral' : 'blue'
                    }
                  >
                    {a.needsAttention
                      ? t('Needs people')
                      : a.status === 'in_progress'
                        ? t('In progress')
                        : a.status === 'open'
                          ? t('Open')
                          : t('Archived')}
                  </Badge>
                  <small className="vacancy-when">{when(a, v.startDate, v.endDate, v.archivedAt)}</small>
                  <ArrowUpRight />
                </div>
              )
            })
          ) : (
            <StateBlock
              title="No vacancies in this view"
              description="Create a vacancy to start assigning people."
              action={
                <Link href="/vacancies/new" className="button button-primary">
                  <Plus />
                  {t('Create vacancy')}
                </Link>
              }
            />
          )}
        </Panel>
      </div>
    </AppShell>
  )
}

'use client'

import { AppShell, Badge, PageHeading, Panel, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { sortByUrgency, urgencyNote, vacancyStatus, vacancyUrgency } from '@/lib/derive'
import { useLanguage } from '@/lib/i18n'
import { ArrowUpRight, Briefcase, Plus } from 'lucide-react'
import { joinDetails } from '@/lib/types'
import Link from 'next/link'
import { useState } from 'react'
import { useToday } from '@/lib/today'

export function VacanciesView() {
  const today = useToday()
  const { vacancies, standing, roster, companies, demand } = useWorkforceData()
  const { t } = useLanguage()
  const [tab, setTab] = useState<'open' | 'in_progress' | 'archived'>('open')
  const [companyId, setCompanyId] = useState('all')
  const filtered = vacancies.filter(v => companyId === 'all' || v.companyId === companyId)
  /* Worst first: a job with a real unstaffed slot outranks one starting soon. */
  const list = sortByUrgency(
    filtered.filter(v => vacancyStatus(v, standing, roster, today) === tab),
    standing,
    roster,
    today,
    demand,
  )
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
              Create vacancy
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
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tabs">
          {(['open', 'in_progress', 'archived'] as const).map(value => (
            <button key={value} onClick={() => setTab(value)} className={tab === value ? 'active' : ''}>
              {value === 'in_progress' ? t('In progress') : t(value[0].toUpperCase() + value.slice(1))}{' '}
              <span>{filtered.filter(v => vacancyStatus(v, standing, roster, today) === value).length}</span>
            </button>
          ))}
        </div>
        <Panel className="full-panel">
          {list.length ? (
            list.map(v => {
              const urgency = vacancyUrgency(v, standing, roster, today, demand)
              const note = urgencyNote(v, urgency, today)
              return (
                <Link className={`vacancy-row urgency-${urgency}`} href={`/vacancies/${v.id}`} key={v.id}>
                  <div className="vacancy-icon">
                    <Briefcase />
                  </div>
                  <div>
                    <strong>{v.title}</strong>
                    <span>
                      {joinDetails(companies.find(c => c.id === v.companyId)?.name, v.address)}
                    </span>
                  </div>
                  <Badge
                    tone={
                      urgency === 'late'
                        ? 'urgent'
                        : urgency === 'soon'
                          ? 'orange'
                          : tab === 'open'
                            ? 'green'
                            : tab === 'archived'
                              ? 'neutral'
                              : 'blue'
                    }
                  >
                    {note
                      ? urgency === 'late'
                        ? 'Unstaffed'
                        : 'Starts soon'
                      : tab === 'in_progress'
                        ? t('In progress')
                        : t(tab[0].toUpperCase() + tab.slice(1))}
                  </Badge>
                  <small>
                    {note ??
                      `${v.places.length ? `${v.places.length} places` : 'single site'} · ${v.trackHoursManually ? t('Hours tracked manually') : t('No manual hours')}`}
                  </small>
                  <ArrowUpRight />
                </Link>
              )
            })
          ) : (
            <StateBlock
              title="No vacancies in this view"
              description="Create a vacancy to start assigning people."
              action={
                <Link href="/vacancies/new" className="button button-primary">
                  <Plus />
                  Create vacancy
                </Link>
              }
            />
          )}
        </Panel>
      </div>
    </AppShell>
  )
}

'use client'

import { Badge, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { currentAssignment, dayStatus } from '@/lib/derive'
import { FEATURES } from '@/lib/features'
import { useLanguage } from '@/lib/i18n'
import { formatDate } from '@/lib/types'
import { ArrowUpRight, CalendarDays, Filter, Search } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useToday } from '@/lib/today'

export function PeopleTable({ compact = false }: { compact?: boolean }) {
  const today = useToday()
  const { workers, companies, roster, leaves, vacancies } = useWorkforceData()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState('All availability')
  const [company, setCompany] = useState('All companies')
  const [date, setDate] = useState(today)
  const [page, setPage] = useState(1)
  const active = workers.filter(w => w.status === 'active')
  const filtered = active.filter(
    w =>
      w.fullName.toLowerCase().includes(query.toLowerCase()) &&
      (availability === 'All availability' ||
        (availability === 'Available' && dayStatus(w.id, date, roster, leaves, vacancies) === 'free') ||
        (availability === 'Working' && dayStatus(w.id, date, roster, leaves, vacancies) === 'working') ||
        (availability === 'Leave' && dayStatus(w.id, date, roster, leaves, vacancies) === 'leave')) &&
      (company === 'All companies' || w.companyAccess.includes(company)),
  )
  return (
    <div className="table-wrap">
      {!compact && (
        <div className="table-toolbar">
          <div className="search-field">
            <Search />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('Search people')}
              aria-label={t('Search people')}
            />
          </div>
          <select value={company} onChange={e => setCompany(e.target.value)} aria-label={t('Company filter')}>
            <option value="All companies">{t('All companies')}</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={availability}
            onChange={e => setAvailability(e.target.value)}
            aria-label={t('Availability filter')}
          >
            <option value="All availability">{t('All availability')}</option>
            <option value="Available">{t('Available')}</option>
            <option value="Working">{t('Working')}</option>
            <option value="Leave">{t('Leave')}</option>
          </select>
          <label className="date-filter">
            <CalendarDays />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              aria-label={t('Availability date')}
            />
          </label>
          <button className="button button-secondary">
            <Filter />
            {t('More filters')}
          </button>
          <span className="result-count">
            {t('Showing {from}–{to} of {count} people', {
              from: Math.min((page - 1) * 25 + 1, filtered.length),
              to: Math.min(page * 25, filtered.length),
              count: filtered.length,
            })}
          </span>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>{t('Person')}</th>
            {!FEATURES.leanPeopleList && <th>{t('Phone')}</th>}
            <th>{t('Company access')}</th>
            <th>{t('Availability · {date}', { date: formatDate(date) })}</th>
            <th>
              <span className="visually-hidden">{t('Open profile')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered
            .slice(0, compact ? 5 : 25)
            .slice((page - 1) * 25)
            .map(w => {
              const state = dayStatus(w.id, date, roster, leaves, vacancies)
              return (
                <tr key={w.id}>
                  <td>
                    <Link className="person-cell" href={`/people/${w.id}`}>
                      <span>
                        <strong>{w.fullName}</strong>
                        <small>{FEATURES.leanPeopleList ? w.city : `${w.city} · ${w.email}`}</small>
                      </span>
                    </Link>
                  </td>
                  {!FEATURES.leanPeopleList && <td>{w.mobile}</td>}
                  <td>
                    <div className="access-list">
                      {w.companyAccess.slice(0, 3).map(id => (
                        <span key={id}>{companies.find(c => c.id === id)?.name}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge tone={state === 'free' ? 'green' : state === 'leave' ? 'orange' : 'blue'}>
                      {t(state === 'free' ? 'Available' : state === 'leave' ? 'Leave' : 'Working')}
                    </Badge>
                    <small className="table-detail">
                      {state === 'working'
                        ? currentAssignment(w.id, date, roster, vacancies)?.title || t('Rostered shift')
                        : state === 'leave'
                          ? t('On leave')
                          : t('Ready for assignment')}
                    </small>
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      href={`/people/${w.id}`}
                      aria-label={t('Open {name}', { name: w.fullName })}
                    >
                      <ArrowUpRight />
                    </Link>
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
      {!filtered.length && (
        <StateBlock
          title="No people match these filters"
          description="Try changing the date, access company, or availability."
        />
      )}
    </div>
  )
}

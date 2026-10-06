'use client'

import { DateField } from '@/components/date-field'
import { Badge, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { currentAssignment, dayStatus } from '@/lib/derive'
import { useLanguage } from '@/lib/i18n'
import { useToday } from '@/lib/today'
import { formatDate, type DayState } from '@/lib/types'
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PAGE_SIZE = 25

type AvailabilityFilter = 'all' | DayState

export function PeopleTable({ compact = false }: { compact?: boolean }) {
  const today = useToday()
  const { workers, companies, roster, leaves, vacancies } = useWorkforceData()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState<AvailabilityFilter>('all')
  const [company, setCompany] = useState('all')
  const [date, setDate] = useState(today)
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase()
    return workers
      .filter(w => w.status === 'active')
      .map(w => ({ worker: w, state: dayStatus(w.id, date, roster, leaves, vacancies) }))
      .filter(
        ({ worker, state }) =>
          (!search || worker.fullName.toLowerCase().includes(search)) &&
          (availability === 'all' || state === availability) &&
          (company === 'all' || worker.companyAccess.includes(company)),
      )
  }, [workers, date, roster, leaves, vacancies, query, availability, company])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = compact
    ? rows.slice(0, 5)
    : rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const filterChanged =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPage(1)
    }

  return (
    <div className="table-wrap">
      {!compact && (
        <div className="table-toolbar">
          <div className="search-field">
            <Search />
            <input
              value={query}
              onChange={e => filterChanged(setQuery)(e.target.value)}
              placeholder={t('Search people')}
              aria-label={t('Search people')}
            />
          </div>
          <select
            value={company}
            onChange={e => filterChanged(setCompany)(e.target.value)}
            aria-label={t('Company filter')}
          >
            <option value="all">{t('All companies')}</option>
            {companies.filter(c => !c.archivedAt).map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={availability}
            onChange={e => filterChanged(setAvailability)(e.target.value as AvailabilityFilter)}
            aria-label={t('Availability filter')}
          >
            <option value="all">{t('All availability')}</option>
            <option value="free">{t('Available')}</option>
            <option value="working">{t('Working')}</option>
            <option value="leave">{t('Leave')}</option>
          </select>
          <label className="date-filter">
            <DateField
              value={date}
              label={t('Availability date')}
              onChange={value => filterChanged(setDate)(value || today)}
            />
          </label>
          <span className="result-count">
            {t('Showing {from}–{to} of {count} people', {
              from: rows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0,
              to: Math.min(currentPage * PAGE_SIZE, rows.length),
              count: rows.length,
            })}
          </span>
        </div>
      )}
      <table className="people-table">
        <thead>
          <tr>
            <th>{t('Person')}</th>
            <th>{t('Company access')}</th>
            <th>{t('Availability · {date}', { date: formatDate(date) })}</th>
            <th>
              <span className="visually-hidden">{t('Open profile')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ worker: w, state }) => (
            <tr key={w.id}>
              <td className="people-name">
                <Link className="person-cell" href={`/people/${w.id}`}>
                  <span>
                    <strong>{w.fullName}</strong>
                    {w.city && <small>{w.city}</small>}
                  </span>
                </Link>
              </td>
              <td className="people-access">
                <div className="access-list">
                  {w.companyAccess.slice(0, 3).map(id => (
                    <span key={id}>{companies.find(c => c.id === id)?.name}</span>
                  ))}
                </div>
              </td>
              <td className="people-state">
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
              <td className="people-open">
                <Link
                  className="icon-button"
                  href={`/people/${w.id}`}
                  aria-label={t('Open {name}', { name: w.fullName })}
                >
                  <ArrowUpRight />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <StateBlock
          title="No people match these filters"
          description="Try changing the date, access company, or availability."
        />
      )}
      {!compact && pages > 1 && (
        <nav className="pagination" aria-label={t('Pages')}>
          <button
            type="button"
            className="button button-secondary"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft />
            {t('Previous')}
          </button>
          <span>{t('Page {page} of {pages}', { page: currentPage, pages })}</span>
          <button
            type="button"
            className="button button-secondary"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            {t('Next')}
            <ChevronRight />
          </button>
        </nav>
      )}
    </div>
  )
}

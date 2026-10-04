'use client'

import { AppShell, PageHeading, Panel } from '@/components/app-shell'
import type { VacancyDraft } from '@/components/vacancies/vacancy-draft'
import { VacancyFields } from '@/components/vacancies/vacancy-fields'
import { useWorkforceData } from '@/components/workforce-data-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToday } from '@/lib/today'

export function VacancyForm() {
  const today = useToday()
  const router = useRouter()
  const { companies } = useWorkforceData()
  const [draft, setDraft] = useState<VacancyDraft>({
    title: '',
    companyId: companies[0]?.id ?? '',
    address: null,
    description: '',
    startDate: today,
    endDate: null,
    timing: 'window',
    start: '08:00',
    end: '16:30',
    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    headcount: 1,
    places: [],
    carOnly: false,
    requiresAvailableList: false,
    trackHoursManually: false,
    defaultHours: '8',
    projectCode: '',
    requirements: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<VacancyDraft>) => setDraft(cur => ({ ...cur, ...patch }))
  const create = async () => {
    if (saving) return
    if (!draft.title.trim()) {
      setError('Enter a vacancy title.')
      return
    }
    if (!companies.some(company => company.id === draft.companyId)) {
      setError('Select a company before creating the vacancy.')
      return
    }
    if (!draft.address) {
      setError('Choose a site address from the search results, or paste valid coordinates.')
      return
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError('End date must be on or after the start date.')
      return
    }
    if (draft.timing !== 'none' && !draft.start) {
      setError('Enter a valid usual start time.')
      return
    }
    if (draft.timing === 'window' && !draft.end) {
      setError('Enter a valid usual end time.')
      return
    }
    if (
      draft.trackHoursManually &&
      draft.defaultHours.trim() !== '' &&
      (!Number.isFinite(Number(draft.defaultHours)) ||
        Number(draft.defaultHours) < 0 ||
        Number(draft.defaultHours) > 24)
    ) {
      setError('Default hours must be between 0 and 24.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          companyId: draft.companyId,
          address: draft.address,
          description: draft.description,
          startDate: draft.startDate,
          endDate: draft.endDate,
          timing: draft.timing,
          start: draft.start,
          end: draft.end,
          weekdays: draft.weekdays,
          headcount: draft.headcount,
          places: draft.places,
          carOnly: draft.carOnly,
          requiresAvailableList: draft.requiresAvailableList,
          trackHoursManually: draft.trackHoursManually,
          defaultHours: draft.defaultHours.trim() === '' ? null : Number(draft.defaultHours),
          projectCode: draft.projectCode,
          requirements: draft.requirements,
        }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not save the vacancy.'
        setError(message)
        return
      }
      if (
        typeof result !== 'object' ||
        result === null ||
        !('vacancy' in result) ||
        typeof result.vacancy !== 'object' ||
        result.vacancy === null ||
        !('slug' in result.vacancy) ||
        typeof result.vacancy.slug !== 'string'
      )
        throw new Error('The server returned an invalid vacancy response.')
      router.push(`/vacancies/${result.vacancy.slug}`)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the vacancy.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <AppShell title="Create vacancy">
      <div className="content-inner">
        <div className="back-link">
          <Link href="/vacancies">← Back to vacancies</Link>
        </div>
        <PageHeading
          eyebrow="Assignments"
          title="Create vacancy"
          description="Add a client order without storing computed status."
        />
        <Panel className="form-panel">
          <VacancyFields draft={draft} set={set} />
          {error && (
            <p className="dialog-note" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <Link href="/vacancies" className="button button-secondary">
              Cancel
            </Link>
            <button className="button button-primary" disabled={saving || !companies.length} onClick={create}>
              {saving ? 'Creating…' : 'Create vacancy'}
            </button>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}

'use client'

import { AppShell, Badge, PageHeading, Panel } from '@/components/app-shell'
import type { VacancyDraft } from '@/components/vacancies/vacancy-draft'
import { applyDraft, draftFromVacancy } from '@/components/vacancies/vacancy-draft'
import { VacancyFields } from '@/components/vacancies/vacancy-fields'
import { VacancySchedule } from '@/components/vacancy-schedule'
import { useWorkforceData } from '@/components/workforce-data-context'
import { describeSchedule, vacancyStatus } from '@/lib/derive'
import { FEATURES } from '@/lib/features'
import { useLanguage } from '@/lib/i18n'
import { formatDate } from '@/lib/types'
import { CalendarDays, MapPin } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToday } from '@/lib/today'
/* Leaflet touches `window` on import and weighs more than the rest of the
   page, so the map is fetched only when asked for. Most of the time the
   kilometres next to each candidate are all anyone needs. */
const LazyMapPanel = dynamic(() => import('@/components/map-view').then(m => m.MapPanel), {
  ssr: false,
  loading: () => <p className="map-note">Loading map…</p>,
})

export function VacancyView({ id }: { id: string }) {
  const today = useToday()
  const router = useRouter()
  const { vacancies, standing, roster, companies } = useWorkforceData()
  const { t } = useLanguage()
  const found = vacancies.find(x => x.id === id) || vacancies[0]
  const [showMap, setShowMap] = useState(false)
  /* Everything about a vacancy moves once it is running: the client renames the
   job, opens a hall, drops the end date, changes the hours. So Edit opens the
   whole form, not the one field somebody guessed would be needed. */
  const [v, setVacancy] = useState(found)
  const [draft, setDraft] = useState(() => draftFromVacancy(found))
  const [editing, setEditing] = useState(false)
  const set = (patch: Partial<VacancyDraft>) => setDraft(cur => ({ ...cur, ...patch }))
  const startEditing = () => {
    setDraft(draftFromVacancy(v))
    setEditing(true)
  }
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [archiveSaving, setArchiveSaving] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const updated = applyDraft(v, draft)
      if (draft.endDate && draft.endDate < draft.startDate) {
        setSaveError('End date must be on or after the start date.')
        return
      }
      if (
        draft.trackHoursManually &&
        draft.defaultHours.trim() !== '' &&
        (!Number.isFinite(Number(draft.defaultHours)) ||
          Number(draft.defaultHours) < 0 ||
          Number(draft.defaultHours) > 24)
      ) {
        setSaveError('Default hours must be between 0 and 24.')
        return
      }
      const response = await fetch(`/api/vacancies/${encodeURIComponent(v.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updated.title,
          companyId: updated.companyId,
          address: draft.address,
          description: updated.description,
          startDate: updated.startDate,
          endDate: updated.endDate,
          schedule: updated.schedule,
          places: updated.places,
          requirements: updated.requirements,
          carOnly: updated.carOnly,
          requiresAvailableList: updated.requiresAvailableList,
          trackHoursManually: updated.trackHoursManually,
          defaultHours: updated.defaultHours,
          projectCode: updated.projectCode,
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
            : 'Could not save vacancy changes.'
        setSaveError(message)
        return
      }
      if (
        typeof result !== 'object' ||
        result === null ||
        !('places' in result) ||
        !Array.isArray(result.places)
      ) {
        throw new Error('The server returned an invalid vacancy response.')
      }
      const savedPlaces = result.places.filter(
        (place): place is { requestedId: string; id: string; name: string } =>
          typeof place === 'object' &&
          place !== null &&
          'requestedId' in place &&
          typeof place.requestedId === 'string' &&
          'id' in place &&
          typeof place.id === 'string' &&
          'name' in place &&
          typeof place.name === 'string',
      )
      const places = updated.places
        .map(place => savedPlaces.find(saved => saved.requestedId === place.id))
        .filter((place): place is { requestedId: string; id: string; name: string } => Boolean(place))
        .map(({ id, name }) => ({ id, name }))
      setVacancy({ ...updated, places })
      setEditing(false)
      router.refresh()
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save vacancy settings.')
    } finally {
      setSaving(false)
    }
  }
  const changeArchiveStatus = async (archived: boolean) => {
    if (archiveSaving) return
    setArchiveSaving(true)
    setArchiveError('')
    try {
      const response = await fetch(`/api/vacancies/${encodeURIComponent(v.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not update vacancy archive status.'
        setArchiveError(message)
        return
      }
      if (typeof result !== 'object' || result === null || !('archivedAt' in result)) {
        throw new Error('The server returned an invalid archive response.')
      }
      const archivedAt = result.archivedAt
      if (archivedAt !== null && typeof archivedAt !== 'string') {
        throw new Error('The server returned an invalid archive response.')
      }
      setVacancy(current => ({ ...current, archivedAt }))
      router.refresh()
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : 'Could not update vacancy archive status.')
    } finally {
      setArchiveSaving(false)
    }
  }
  const status = vacancyStatus(v, standing, roster, today)
  const canRestore = v.archivedAt !== null && v.archivedAt !== undefined && (!v.endDate || v.endDate >= today)
  const ended = status === 'archived' && !canRestore
  return (
    <AppShell title="Vacancy">
      <div className="content-inner">
        <div className="back-link">
          <Link href="/vacancies">← Back to vacancies</Link>
        </div>
        <PageHeading
          eyebrow="Vacancy detail"
          title={v.title}
          description={`${companies.find(c => c.id === v.companyId)?.name} · ${v.address}`}
          action={
            <Badge tone={status === 'archived' ? 'neutral' : status === 'open' ? 'orange' : 'green'}>
              {status.replace('_', ' ')}
            </Badge>
          }
        />
        <div className="vacancy-meta">
          <span>
            <MapPin />
            {v.address}
          </span>
          <span>
            <CalendarDays />
            {formatDate(v.startDate)} – {v.endDate ? formatDate(v.endDate) : 'Open-ended'}
          </span>
          <span>{v.trackHoursManually ? 'Hours tracked manually' : 'Hours not tracked manually'}</span>
        </div>

        <Panel className="full-panel">
          <div className="panel-header">
            <div>
              <h2>Details</h2>
              <p>
                {editing
                  ? 'Every field the client can ask us to change.'
                  : 'What the team does here, and how the job is set up.'}
              </p>
            </div>
            {!editing && (
              <div className="inline-actions">
                {status === 'archived' ? (
                  canRestore && (
                    <button
                      className="button button-secondary"
                      disabled={archiveSaving}
                      onClick={() => void changeArchiveStatus(false)}
                    >
                      {archiveSaving ? t('Saving…') : t('Restore vacancy')}
                    </button>
                  )
                ) : (
                  <button
                    className="button button-secondary"
                    disabled={archiveSaving}
                    onClick={() => void changeArchiveStatus(true)}
                  >
                    {archiveSaving ? t('Saving…') : t('Archive vacancy')}
                  </button>
                )}
                <button className="button button-secondary" onClick={startEditing}>
                  Edit
                </button>
              </div>
            )}
          </div>
          {archiveError && (
            <p className="dialog-note" role="alert">
              {t(archiveError)}
            </p>
          )}
          {ended && v.endDate && v.endDate < today && (
            <p className="field-hint">{t('This vacancy ended. Update its end date before restoring it.')}</p>
          )}
          {editing ? (
            <div className="vacancy-editor">
              <VacancyFields draft={draft} set={set} />
              {saveError && (
                <p className="dialog-note" role="alert">
                  {saveError}
                </p>
              )}
              <div className="form-footer">
                <button
                  className="button button-secondary"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : 'Save vacancy'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="muted-copy panel-body">{v.description || 'No description yet.'}</p>
              {Boolean(v.requirements?.length) && (
                <div className="vacancy-requirements">
                  <h3>What this vacancy requires</h3>
                  {v.requirements?.map(requirement => (
                    <div className="vacancy-requirement" key={requirement.id}>
                      <span>
                        <strong>{requirement.label}</strong>
                        <small>{requirement.kind}</small>
                      </span>
                      <Badge tone={requirement.required ? 'orange' : 'neutral'}>
                        {requirement.required ? 'Required' : 'Preferred'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>

        {FEATURES.schedulePattern && (
          <Panel className="full-panel">
            <div className="panel-header">
              <div>
                <h2>Schedule</h2>
                <p>How this object is normally staffed.</p>
              </div>
            </div>
            <ul className="schedule-lines">
              {describeSchedule(v).map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Panel>
        )}

        {/* People and days live in one place. There is no separate "assign person"
    any more: a schedule already says who works when, and a replacement is
    the same edit at a different size. */}
        <Panel className="full-panel">
          <VacancySchedule vacancy={v} />
        </Panel>

        <Panel className="full-panel vacancy-map">
          <div className="panel-header">
            <div>
              <h2>Who is nearby</h2>
              <p>
                Road distance from {v.address}. Kilometres show on every candidate when picking people; the
                map is for choosing by eye.
              </p>
            </div>
            <button className="button button-secondary" onClick={() => setShowMap(x => !x)}>
              {showMap ? 'Hide map' : 'Show on map'}
            </button>
          </div>
          {showMap && (
            <div className="panel-body">
              <LazyMapPanel vacancyId={v.id} />
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  )
}

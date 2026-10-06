'use client'

import { AppShell, Badge, PageHeading, Panel } from '@/components/app-shell'
import { Calendar } from '@/components/people/worker-calendar'
import { useWorkforceData } from '@/components/workforce-data-context'
import { useLanguage } from '@/lib/i18n'
import type { PersonalDetails, Worker } from '@/lib/types'
import { formatDate, joinDetails, weekdayLabel, WEEKDAYS } from '@/lib/types'
import { CircleAlert, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function PersonView({ id }: { id: string }) {
  const router = useRouter()
  const { workers, companies, personalDetails } = useWorkforceData()
  const { t } = useLanguage()
  const w = workers.find(x => x.id === id) || workers[0]
  const details = personalDetails?.workerId === w.id ? personalDetails : null
  const [notes, setNotes] = useState(details?.notes ?? '')
  const [access, setAccess] = useState(w?.companyAccess ?? [])
  const [accessError, setAccessError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const saveProfile = async (
    update: Partial<Pick<Worker, 'hasCar' | 'hasBike' | 'hasVog' | 'courseDays'> & Pick<PersonalDetails, 'notes'>>,
  ) => {
    setProfileSaving(true)
    setAccessError('')
    try {
      const response = await fetch(`/api/people/${encodeURIComponent(w.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not save worker profile.'
        throw new Error(message)
      }
      router.refresh()
      return true
    } catch (cause) {
      setAccessError(cause instanceof Error ? cause.message : 'Could not save worker profile.')
      return false
    } finally {
      setProfileSaving(false)
    }
  }
  const toggleCompanyAccess = async (companyId: string) => {
    if (profileSaving) return
    setProfileSaving(true)
    const wasAccessible = access.includes(companyId)
    setAccess(current =>
      wasAccessible ? current.filter(company => company !== companyId) : [...current, companyId],
    )
    setAccessError('')
    try {
      const response = await fetch(`/api/people/${encodeURIComponent(w.id)}/company-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, accessible: !wasAccessible }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Could not update company access.'
        throw new Error(message)
      }
      router.refresh()
    } catch (cause) {
      setAccess(current =>
        wasAccessible
          ? [...current.filter(company => company !== companyId), companyId]
          : current.filter(company => company !== companyId),
      )
      setAccessError(cause instanceof Error ? cause.message : 'Could not update company access.')
    } finally {
      setProfileSaving(false)
    }
  }
  /* Own transport is a switch, not a printed fact: cars are sold and bought,
   and a stale "no car" quietly keeps somebody out of every car-only site. */
  const [hasCar, setHasCar] = useState(w.hasCar)
  const [hasBike, setHasBike] = useState(w.hasBike)
  /* Certificate of conduct. Some clients refuse anybody without one, and it is
   renewed rather than granted once — so it is a switch on the profile, not a
   line of printed text. */
  const [hasVog, setHasVog] = useState(w.hasVog)
  /* Course days repeat every week and are not days off: the person is simply
   not offered work on them. Kept on the profile, not on the calendar, because
   nobody wants to enter the same Wednesday forty times. */
  const [courseDays, setCourseDays] = useState(w.courseDays)
  return (
    <AppShell title="Person">
      <div className="content-inner">
        <div className="back-link">
          <Link href="/people">← {t('Back to people')}</Link>
        </div>
        {w.status === 'dismissed' && (
          <div className="dismissed-banner">
            <CircleAlert />
            <span>
              {t('Dismissed on {date}. This record is read-only except internal notes.', {
                date: formatDate(w.dismissedAt),
              })}
            </span>
          </div>
        )}
        <PageHeading
          eyebrow="Worker profile"
          title={w.fullName}
          description={joinDetails(
            w.postCode,
            details?.age != null ? t('{count} years old', { count: details.age }) : null,
          )}
          action={
            <Badge tone={w.status === 'active' ? 'green' : 'neutral'}>
              {t(w.status === 'active' ? 'Active' : 'Dismissed')}
            </Badge>
          }
        />
        <div className="profile-grid">
          <div className="profile-left">
            <Panel>
              <div className="profile-hero">
                <div>
                  <h2>{w.fullName}</h2>
                </div>
              </div>
              <div className="detail-grid">
                {/* Of the personal data only the postcode and the age are shown;
                    the rest stays in the database (see PersonalDetails). */}
                {[
                  ['Postcode', w.postCode],
                  ['Age', details?.age != null ? String(details.age) : null],
                  [
                    'Course days',
                    <div className="seg seg-small course-days" key="course">
                      {WEEKDAYS.map(d => (
                        <button
                          type="button"
                          key={d}
                          className={courseDays.includes(d) ? 'active' : ''}
                          disabled={w.status === 'dismissed' || profileSaving}
                          onClick={() => {
                            const next = courseDays.includes(d)
                              ? courseDays.filter(x => x !== d)
                              : [...courseDays, d]
                            setCourseDays(next)
                            void saveProfile({ courseDays: next })
                          }}
                        >
                          {weekdayLabel[d]}
                        </button>
                      ))}
                    </div>,
                  ],
                  [
                    'VOG',
                    <div className="seg seg-small" key="vog">
                      {(
                        [
                          [true, 'On file'],
                          [false, 'None'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={label}
                          className={hasVog === value ? 'active' : ''}
                          disabled={w.status === 'dismissed' || profileSaving}
                          onClick={() => {
                            setHasVog(value)
                            void saveProfile({ hasVog: value })
                          }}
                        >
                          {t(label)}
                        </button>
                      ))}
                    </div>,
                  ],
                  [
                    'Own transport',
                    /* Car and bike are independent — somebody can have both — so
                       each toggles on its own; None says "neither", which is a
                       known answer and not the same as never having asked. */
                    <div className="seg seg-small" key="transport">
                      <button
                        type="button"
                        aria-pressed={hasCar === true}
                        className={hasCar === true ? 'active' : ''}
                        disabled={w.status === 'dismissed' || profileSaving}
                        onClick={() => {
                          const next = hasCar !== true
                          setHasCar(next)
                          void saveProfile({ hasCar: next })
                        }}
                      >
                        {t('Car')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={hasBike === true}
                        className={hasBike === true ? 'active' : ''}
                        disabled={w.status === 'dismissed' || profileSaving}
                        onClick={() => {
                          const next = hasBike !== true
                          setHasBike(next)
                          void saveProfile({ hasBike: next })
                        }}
                      >
                        {t('Bike')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={hasCar === false && hasBike !== true}
                        className={hasCar === false && hasBike !== true ? 'active' : ''}
                        disabled={w.status === 'dismissed' || profileSaving}
                        onClick={() => {
                          setHasCar(false)
                          setHasBike(false)
                          void saveProfile({ hasCar: false, hasBike: false })
                        }}
                      >
                        {t('None')}
                      </button>
                    </div>,
                  ],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <span>{t(label as string)}</span>
                    {typeof value === 'string' || value === null || value === undefined ? (
                      <strong>{value || '—'}</strong>
                    ) : (
                      value
                    )}
                  </div>
                ))}
              </div>
              {details && !details.hasHomeAddress && (
                <div className="inline-note">
                  <MapPin />
                  {t(
                    'No home address from Flexpedia yet, so travel distances cannot be calculated for this person.',
                  )}
                </div>
              )}
            </Panel>
            <Panel>
              <div className="panel-header">
                <div>
                  <h2>{t('Internal notes')}</h2>
                  <p>{t('Visible to dispatchers only.')}</p>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={w.status === 'dismissed' || profileSaving}
                aria-label={t('Internal notes')}
              />
              <div className="form-footer">
                <button
                  className="button button-primary"
                  disabled={w.status === 'dismissed' || profileSaving}
                  onClick={() => void saveProfile({ notes })}
                >
                  {t(profileSaving ? 'Saving…' : 'Save notes')}
                </button>
              </div>
            </Panel>
            <Panel>
              <div className="panel-header">
                <div>
                  <h2>{t('Company access')}</h2>
                  <p>{t('Access permits work at company sites; it is not an assignment.')}</p>
                </div>
              </div>
              {accessError && (
                <p className="dialog-note" role="alert">
                  {accessError}
                </p>
              )}
              {companies.filter(c => !c.archivedAt).map(c => (
                <label className="access-toggle" key={c.id}>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.contactPerson}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={access.includes(c.id)}
                    onChange={() => void toggleCompanyAccess(c.id)}
                    disabled={w.status === 'dismissed' || profileSaving}
                  />
                </label>
              ))}
            </Panel>
          </div>
          <div className="profile-right">
            <Panel>
              <Calendar workerId={w.id} />
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

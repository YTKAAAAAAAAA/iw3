'use client'

import { AppShell, Badge, PageHeading, Panel } from '@/components/app-shell'
import { Calendar } from '@/components/people/worker-calendar'
import { useWorkforceData } from '@/components/workforce-data-context'
import type { Worker } from '@/lib/types'
import { formatDate, weekdayLabel, WEEKDAYS } from '@/lib/types'
import { ArrowUpRight, CircleAlert, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function PersonView({ id }: { id: string }) {
  const router = useRouter()
  const { workers, companies, manatalCandidates, roster, vacancies, hours } = useWorkforceData()
  const w = workers.find(x => x.id === id) || workers[0]
  const [notes, setNotes] = useState(w?.notes ?? '')
  const [access, setAccess] = useState(w?.companyAccess ?? [])
  const [accessError, setAccessError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const saveProfile = async (update: Partial<Pick<Worker, 'notes' | 'hasCar' | 'hasVog' | 'courseDays'>>) => {
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
          <Link href="/people">← Back to people</Link>
        </div>
        {w.status === 'dismissed' && (
          <div className="dismissed-banner">
            <CircleAlert />
            <span>
              Dismissed on {formatDate(w.dismissedAt)}. This record is read-only except internal notes.
            </span>
          </div>
        )}
        <PageHeading
          eyebrow="Worker profile"
          title={w.fullName}
          description={`${w.city} · ${w.email}`}
          action={<Badge tone={w.status === 'active' ? 'green' : 'neutral'}>{w.status}</Badge>}
        />
        <div className="profile-grid">
          <div className="profile-left">
            <Panel>
              <div className="profile-hero">
                <div>
                  <h2>{w.fullName}</h2>
                  <p>
                    {w.initials} · {w.nationality}
                  </p>
                </div>
              </div>
              <div className="detail-grid">
                {[
                  ['First name', w.firstName],
                  ['Insertion', w.insertion],
                  ['Last name', w.lastName],
                  ['Gender', w.gender],
                  ['Birth date', formatDate(w.birthDate)],
                  ['Address', [w.street, w.streetNumber, w.streetNumberAddition].filter(Boolean).join(' ')],
                  ['Postcode / city', [w.postCode, w.city].filter(Boolean).join(' · ')],
                  ['Residence country', w.residenceCountry],
                  ['Nationality', w.nationality],
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
                          {label}
                        </button>
                      ))}
                    </div>,
                  ],
                  [
                    'Own transport',
                    <div className="seg seg-small" key="car">
                      {(
                        [
                          [true, 'Car'],
                          [false, 'No car'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={label}
                          className={hasCar === value ? 'active' : ''}
                          disabled={w.status === 'dismissed' || profileSaving}
                          onClick={() => {
                            setHasCar(value)
                            void saveProfile({ hasCar: value })
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>,
                  ],
                  ['Phone', w.phone],
                  ['Mobile', w.mobile],
                  ['Email', w.email],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <span>{label}</span>
                    {typeof value === 'string' || value === null || value === undefined ? (
                      <strong>{value || '—'}</strong>
                    ) : (
                      value
                    )}
                  </div>
                ))}
              </div>
              {w.lat === null && (
                <div className="inline-note">
                  <MapPin />
                  Coordinates are not defined. This person is excluded from distance matching.
                </div>
              )}
              <div className="section-divider" />
              <div className="panel-header">
                <div>
                  <h2>Manatal CV</h2>
                  <p>Linked resume remains in Manatal; no copy is stored here.</p>
                </div>
              </div>
              {w.manatalLink === 'linked' ? (
                <div className="match-row">
                  <a
                    className="button button-secondary"
                    href={w.cvUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open CV in Manatal <ArrowUpRight />
                  </a>
                </div>
              ) : w.manatalLink === 'not_found' ? (
                <div className="match-row">
                  <Badge tone="orange">Not found in Manatal</Badge>
                  <button className="button button-secondary">Link manually</button>
                </div>
              ) : (
                <div className="match-row">
                  <Badge tone="orange">Several candidates match this email</Badge>
                  <select aria-label="Select Manatal candidate">
                    {manatalCandidates.map(c => (
                      <option key={c.id}>
                        {c.name} · {c.email}
                      </option>
                    ))}
                  </select>
                  <button className="button button-secondary">Link candidate</button>
                </div>
              )}
            </Panel>
            <Panel>
              <div className="panel-header">
                <div>
                  <h2>Internal notes</h2>
                  <p>Only this field is editable in the worker profile.</p>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={w.status === 'dismissed' || profileSaving}
                aria-label="Internal notes"
              />
              <div className="form-footer">
                <button
                  className="button button-primary"
                  disabled={w.status === 'dismissed' || profileSaving}
                  onClick={() => void saveProfile({ notes })}
                >
                  {profileSaving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </Panel>
            <Panel>
              <div className="panel-header">
                <div>
                  <h2>Company access</h2>
                  <p>Access permits work at company sites; it is not an assignment.</p>
                </div>
              </div>
              {accessError && (
                <p className="dialog-note" role="alert">
                  {accessError}
                </p>
              )}
              {companies.map(c => (
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

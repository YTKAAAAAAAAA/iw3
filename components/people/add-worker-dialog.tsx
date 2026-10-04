'use client'

import { useExit } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function AddManualWorkerDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { companies } = useWorkforceData()
  const [fullName, setFullName] = useState('')
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [conflicts, setConflicts] = useState<Array<{ id: number; fullName: string }>>([])
  const [sharedResolution, setSharedResolution] = useState<{ id: string; fullName: string } | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { closing, close: dismiss } = useExit(onClose)

  const save = async (confirmDuplicates = false, resolutionWorkerId?: string) => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          companyIds,
          confirmDuplicates,
          ...(resolutionWorkerId ? { resolutionWorkerId } : {}),
        }),
      })
      const data = await response.json()
      if (response.status === 409 && Array.isArray(data.conflicts)) {
        setConflicts(data.conflicts)
        setError(data.error || 'Possible existing people were found.')
        return
      }
      if (!response.ok) throw new Error(data.error || 'Could not save the person.')
      if (data.alreadyResolved === true || data.resolvedNow === true) {
        setSharedResolution(data.worker)
        setConflicts([])
        setError(
          data.alreadyResolved
            ? 'This identity was already resolved by another dispatcher. The shared choice is shown below; no duplicate was created.'
            : 'Your choice is now shared. Other dispatchers will use this same person.',
        )
        router.refresh()
        return
      }
      dismiss()
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the person. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-worker-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <h2 id="manual-worker-title">Add person manually</h2>
            <p>
              This person can be linked to Flexpedia later without replacing their local schedule history.
            </p>
          </div>
          <button className="icon-button" onClick={dismiss} aria-label="Close" disabled={saving}>
            <X />
          </button>
        </div>
        <label>
          Full name
          <input
            autoFocus
            value={fullName}
            maxLength={200}
            onChange={e => {
              setFullName(e.target.value)
              setConflicts([])
            }}
            placeholder="First and last name"
          />
        </label>
        <fieldset className="manual-worker-companies">
          <legend>Company access</legend>
          {companies.map(company => (
            <label key={company.id}>
              <input
                type="checkbox"
                checked={companyIds.includes(company.id)}
                onChange={() =>
                  setCompanyIds(current =>
                    current.includes(company.id)
                      ? current.filter(id => id !== company.id)
                      : [...current, company.id],
                  )
                }
              />
              {company.name}
            </label>
          ))}
        </fieldset>
        {!companies.length && (
          <p className="dialog-note" role="alert">
            Create a company before adding a person.
          </p>
        )}
        {error && (
          <p className="dialog-note" role="alert">
            {error}
          </p>
        )}
        {conflicts.length > 0 && (
          <>
            <ul className="manual-worker-conflicts">
              {conflicts.map(person => (
                <li key={person.id}>
                  <span>
                    <strong>{person.fullName}</strong> — same name
                  </span>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    disabled={saving}
                    onClick={() => void save(false, String(person.id))}
                  >
                    Choose this person
                  </button>
                </li>
              ))}
            </ul>
            <p className="dialog-note">
              The first dispatcher to choose will decide for everyone submitting this same name; selecting an
              existing person never merges records.
            </p>
          </>
        )}
        {sharedResolution && (
          <div className="form-footer">
            <Link className="button button-primary" href={`/people/${sharedResolution.id}`} onClick={dismiss}>
              Open {sharedResolution.fullName}
            </Link>
          </div>
        )}
        {!sharedResolution && (
          <div className="form-footer">
            <button className="button button-secondary" disabled={saving} onClick={dismiss}>
              Cancel
            </button>
            {conflicts.length > 0 ? (
              <button
                className="button button-primary"
                disabled={saving || !companyIds.length}
                onClick={() => void save(true)}
              >
                {saving ? 'Saving…' : 'Add as a separate person'}
              </button>
            ) : (
              <button
                className="button button-primary"
                disabled={saving || !fullName.trim() || !companyIds.length}
                onClick={() => void save()}
              >
                {saving ? 'Saving…' : 'Add person'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { Badge, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { useLanguage } from '@/lib/i18n'
import { formatDate } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DismissedList() {
  const { workers, hours } = useWorkforceData()
  const { t } = useLanguage()
  const list = workers.filter(w => w.status === 'dismissed')
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('Person')}</th>
            <th>{t('Dismissed on')}</th>
            <th>{t('History')}</th>
            <th>{t('Status')}</th>
            <th>
              <span className="visually-hidden">{t('Actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map(w => (
            <tr key={w.id}>
              <td>
                <Link className="person-cell" href={`/people/${w.id}`}>
                  <span>
                    <strong>{w.fullName}</strong>
                    {w.city && <small>{w.city}</small>}
                  </span>
                </Link>
              </td>
              <td>{formatDate(w.dismissedAt)}</td>
              <td>
                {t('{hours} h worked', {
                  hours: hours
                    .filter(h => h.workerId === w.id)
                    .reduce((sum, h) => sum + h.hours, 0)
                    .toLocaleString('nl-NL'),
                })}
              </td>
              <td>
                <Badge tone="neutral">{t('Dismissed')}</Badge>
              </td>
              <td>
                <RestoreWorkerButton id={w.id} name={w.fullName} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <StateBlock
          title="No dismissed people"
          description="Dismissed workers will appear here so they can be restored."
        />
      )}
    </div>
  )
}

export function RestoreWorkerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const restore = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/people/${id}/restore`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not restore this person.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore this person. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="restore-worker-action">
      <button
        className="button button-secondary button-small"
        disabled={saving}
        onClick={() => void restore()}
      >
        {saving ? t('Restoring…') : t('Restore')}
      </button>
      {error && <span role="alert">{error}</span>}
      <span className="visually-hidden">{name}</span>
    </div>
  )
}

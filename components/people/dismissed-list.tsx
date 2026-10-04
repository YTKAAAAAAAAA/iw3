'use client'

import { Badge, StateBlock } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import { formatDate } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DismissedList() {
  const { workers, hours } = useWorkforceData()
  const list = workers.filter(w => w.status === 'dismissed')
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Dismissed on</th>
            <th>History</th>
            <th>Status</th>
            <th>
              <span className="visually-hidden">Actions</span>
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
                    <small>{w.email}</small>
                  </span>
                </Link>
              </td>
              <td>{formatDate(w.dismissedAt)}</td>
              <td>{hours.filter(h => h.workerId === w.id).length} saved hours</td>
              <td>
                <Badge tone="neutral">Dismissed</Badge>
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
        {saving ? 'Restoring…' : 'Restore'}
      </button>
      {error && <span role="alert">{error}</span>}
      <span className="visually-hidden">{name}</span>
    </div>
  )
}
/* ------------------------------------------------------------------
   The worker's month.

   Days are picked, not opened: a holiday is two weeks, not one day, and
   clicking through fourteen dialogs to enter it is how people stop entering
   it at all. Tapping a day adds it to the selection, tapping it again takes
   it out, and shift-clicking fills the span between — then one action covers
   everything picked. The same selection is what removes leave again.
   ------------------------------------------------------------------ */

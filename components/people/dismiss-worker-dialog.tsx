'use client'

import { useExit } from '@/components/app-shell'
import { useConfirm } from '@/components/confirm-dialog'
import { useWorkforceData } from '@/components/workforce-data-context'
import { useLanguage } from '@/lib/i18n'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DismissWorkerDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { workers } = useWorkforceData()
  const { t } = useLanguage()
  const active = workers.filter(worker => worker.status === 'active')
  const [workerId, setWorkerId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { closing, close: dismiss } = useExit(onClose)
  const { confirm, confirmElement } = useConfirm()

  const submit = async () => {
    const worker = active.find(candidate => candidate.id === workerId)
    if (
      !worker ||
      !(await confirm(t('Dismiss {name}? Their shifts and history will be preserved.', { name: worker.fullName }), {
        confirmLabel: 'Dismiss',
      }))
    )
      return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/people/${workerId}/dismiss`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not dismiss this person.')
      router.refresh()
      dismiss()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not dismiss this person. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dismiss-worker-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <h2 id="dismiss-worker-title">{t('Dismiss a worker')}</h2>
            <p>
              {t(
                'The worker and their shift history will remain saved. Flexpedia profile sync will not change this status.',
              )}
            </p>
          </div>
          <button className="icon-button" aria-label={t('Close')} onClick={dismiss}>
            <X />
          </button>
        </div>
        <label>
          {t('Person')}
          <select value={workerId} onChange={event => setWorkerId(event.target.value)} disabled={saving}>
            <option value="">{t('Select a person')}</option>
            {active.map(worker => (
              <option key={worker.id} value={worker.id}>
                {worker.fullName}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        <div className="form-footer">
          <button className="button button-secondary" onClick={dismiss} disabled={saving}>
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
            onClick={() => void submit()}
            disabled={saving || !workerId}
          >
            {saving ? t('Saving…') : t('Dismiss')}
          </button>
        </div>
      </section>
    </div>
    {confirmElement}
    </>
  )
}

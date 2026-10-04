'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useWorkforceData } from './workforce-data-context'
import { useLanguage } from '@/lib/i18n'
import { formatDateTime } from '@/lib/types'

/** The header's sync indicator. It shows when the stalest configured source
 *  last synced successfully, warns when a source is failing, and runs every
 *  source at once when clicked. Sources also sync on their own every hour. */
export function SyncStatusButton() {
  const router = useRouter()
  const { sync } = useWorkforceData()
  const { t } = useLanguage()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Relative times are rendered after mount, so server and browser agree.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const active = sync.filter(source => source.configured && source.enabled)
  const failing = active.filter(source => source.lastError)
  const oldest = active.every(source => source.lastSyncAt)
    ? active.map(source => source.lastSyncAt!).sort()[0]
    : null

  const ago = (iso: string) => {
    if (now === null) return formatDateTime(iso)
    const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
    if (minutes < 1) return t('just now')
    if (minutes < 60) return t('{count} min ago', { count: minutes })
    if (minutes < 24 * 60) return t('{count} h ago', { count: Math.round(minutes / 60) })
    return formatDateTime(iso)
  }

  const label = working
    ? t('Syncing…')
    : error || failing.length
      ? t('Sync problem')
      : !active.length
        ? t('Sync not set up')
        : oldest
          ? t('Synced {when}', { when: ago(oldest) })
          : t('Not synced yet')

  const run = async () => {
    if (!active.length) {
      router.push('/sync')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'The sync request failed.'
        setError(message)
      }
      router.refresh()
    } catch {
      setError('The sync request failed.')
    } finally {
      setWorking(false)
    }
  }

  const detail = error ?? failing.map(source => source.lastError).join(' ')
  return (
    <button
      type="button"
      className={`sync-button ${working ? 'syncing' : ''} ${error || failing.length ? 'sync-failing' : ''}`}
      onClick={() => void run()}
      disabled={working}
      title={detail ? t(detail) : t('Sync Flexpedia and Supabase now. They also sync every hour.')}
      aria-live="polite"
    >
      <RefreshCw aria-hidden="true" />
      {label}
    </button>
  )
}

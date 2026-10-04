'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { Brand } from './logo'

/** The page shown instead of a screen that failed or does not exist. It
 *  keeps the app's theme and language, says what happened in plain words, and
 *  always offers a way back. */
export function StatusPage({
  code,
  title,
  description,
  reference,
  onRetry,
}: {
  code?: string
  title: string
  description: string
  reference?: string
  onRetry?: () => void
}) {
  const { t } = useLanguage()
  return (
    <main className="auth-page">
      <section className="auth-card status-card" aria-labelledby="status-title">
        <div className="brand-row">
          <Brand size="large" />
        </div>
        {code && <p className="eyebrow">{code}</p>}
        <h1 id="status-title">{t(title)}</h1>
        <p>{t(description)}</p>
        {reference && (
          <p className="field-hint">
            {t('Reference for support:')} <code>{reference}</code>
          </p>
        )}
        <div className="button-row">
          {onRetry && (
            <button type="button" className="button button-primary" onClick={onRetry}>
              {t('Try again')}
            </button>
          )}
          <Link className={`button ${onRetry ? 'button-secondary' : 'button-primary'}`} href="/">
            {t('Go to overview')}
          </Link>
        </div>
      </section>
    </main>
  )
}

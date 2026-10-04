'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { changePassword, type LoginState } from '@/lib/auth/actions'
import { useLanguage } from '@/lib/i18n'

export function PasswordForm() {
  const { t } = useLanguage()
  const [state, action, pending] = useActionState<LoginState, FormData>(changePassword, {})

  return (
    <form action={action} className="auth-form">
      <label>{t('Current password')}<input name="current" type="password" autoComplete="current-password" required /></label>
      <label>{t('New password')}<input name="next" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label>{t('Repeat new password')}<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
      {state.error && <p className="error-message" role="alert">{t(state.error)}</p>}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? t('Saving…') : t('Change password')}
      </button>
      <Link className="button button-secondary" href="/">{t('Back to planner')}</Link>
    </form>
  )
}

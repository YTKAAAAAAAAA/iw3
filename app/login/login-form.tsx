'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/lib/auth/actions'
import { useLanguage } from '@/lib/i18n'

export function LoginForm() {
  const { t } = useLanguage()
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={action} className="auth-form">
      <label>
        {t('Password')}
        <input type="password" name="password" autoComplete="current-password" autoFocus required />
      </label>
      {state.error && <p className="error-message" role="alert">{t(state.error)}</p>}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? t('Signing in…') : t('Sign in')}
      </button>
    </form>
  )
}

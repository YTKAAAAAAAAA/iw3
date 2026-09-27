'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/lib/auth/actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={action} className="auth-form">
      <label>
        Password
        <input type="password" name="password" autoComplete="current-password" autoFocus required />
      </label>
      {state.error && <p className="error-message" role="alert">{state.error}</p>}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

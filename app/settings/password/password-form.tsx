'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { changePassword, type LoginState } from '@/lib/auth/actions'

export function PasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(changePassword, {})

  return (
    <form action={action} className="auth-form">
      <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
      <label>New password<input name="next" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label>Repeat new password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
      {state.error && <p className="error-message" role="alert">{state.error}</p>}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </button>
      <Link className="button button-secondary" href="/">Back to planner</Link>
    </form>
  )
}

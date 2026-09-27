import { requireSession } from '@/lib/auth/guard'
import { PasswordForm } from './password-form'

export const dynamic = 'force-dynamic'

export default async function PasswordSettingsPage() {
  await requireSession()
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <h1 id="password-title">Change password</h1>
        <p>Choose a new password with at least 12 characters.</p>
        <PasswordForm />
      </section>
    </main>
  )
}

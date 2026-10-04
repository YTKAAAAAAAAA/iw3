import { requireSession } from '@/lib/auth/guard'
import { PasswordForm } from './password-form'
import { PasswordCopy } from './password-copy'

export const dynamic = 'force-dynamic'

export default async function PasswordSettingsPage() {
  await requireSession()
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <PasswordCopy />
        <PasswordForm />
      </section>
    </main>
  )
}

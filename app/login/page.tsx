import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ passwordChanged?: string }>
}) {
  const { passwordChanged } = await searchParams
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-row"><strong>International@Work</strong></div>
        <h1 id="login-title">Sign in</h1>
        <p>Enter the dispatcher password to continue.</p>
        {passwordChanged === '1' && <p className="auth-notice" role="status">Password changed. Sign in with the new password.</p>}
        <LoginForm />
      </section>
    </main>
  )
}

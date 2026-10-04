import { LoginForm } from './login-form'
import { LoginCopy } from './login-copy'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ passwordChanged?: string }>
}) {
  const { passwordChanged } = await searchParams
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-row"><strong>International@Work</strong></div>
        <LoginCopy passwordChanged={passwordChanged === '1'} />
        <LoginForm />
      </section>
    </main>
  )
}

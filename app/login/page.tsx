import { LoginForm } from './login-form'
import { LoginCopy } from './login-copy'
import { Brand } from '@/components/logo'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ passwordChanged?: string }>
}) {
  const { passwordChanged } = await searchParams
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-row"><Brand size="large" /></div>
        <LoginCopy passwordChanged={passwordChanged === '1'} />
        <LoginForm />
      </section>
    </main>
  )
}

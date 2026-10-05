'use server'

import { createHmac } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { withDb } from '@/lib/db'
import { authenticatePassword } from './password'
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from './session'
import { getSession } from './guard'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export type LoginState = { error?: string }
type AppUser = { id: number; password_hash: string; session_version: number }

function backendUrl(path: string): string {
  const base = process.env.APP_BACKEND_URL
  if (!base) throw new Error('APP_BACKEND_URL must be configured to use the remote backend.')
  return `${base.replace(/\/+$/, '')}${path}`
}

async function remoteLogin(password: string, identity: string) {
  const proxySecret = process.env.BACKEND_PROXY_SECRET
  if (!proxySecret) throw new Error('BACKEND_PROXY_SECRET must be configured for remote sign-in.')
  const identitySignature = createHmac('sha256', proxySecret).update(identity).digest('hex')
  const response = await fetch(backendUrl('/api/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Backend-Secret': proxySecret,
      'X-Login-Identity': identity,
      'X-Login-Signature': identitySignature,
    },
    body: JSON.stringify({ password }),
    cache: 'no-store',
  })
  const result: unknown = await response.json()
  if (!response.ok) {
    const error = typeof result === 'object' && result !== null && 'error' in result
      && typeof result.error === 'string' ? result.error : 'Could not sign in.'
    return { error }
  }
  if (typeof result !== 'object' || result === null || !('userId' in result)
    || typeof result.userId !== 'number' || !Number.isSafeInteger(result.userId)
    || !('sessionVersion' in result) || typeof result.sessionVersion !== 'number'
    || !Number.isSafeInteger(result.sessionVersion)) {
    throw new Error('The backend returned an invalid sign-in response.')
  }
  return { userId: result.userId, sessionVersion: result.sessionVersion }
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const value = formData.get('password')
  const password = typeof value === 'string' ? value : ''
  if (!password) return { error: 'Enter the password.' }
  if (password.length > 1024) return { error: 'Password is too long.' }
  const requestHeaders = await headers()
  const identity = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    || requestHeaders.get('x-real-ip')?.trim() || 'unknown'
  const result = process.env.APP_BACKEND_URL
    ? await remoteLogin(password, identity)
    : await authenticatePassword(password, identity)
  if ('error' in result) return result

  const token = await createSessionToken(result.userId, result.sessionVersion)
  const store = await cookies()
  // Safari drops a Secure cookie on plain http://localhost, which signed the
  // user out on the next page. Mark it Secure only when the request really
  // came over HTTPS — directly or through the proxy in front of the app.
  const isHttps = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https'
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  })
  redirect('/')
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}

export async function changePassword(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (process.env.APP_BACKEND_URL) {
    const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value
    const session = await getSession()
    if (!session || !sessionToken) return { error: 'Session expired — sign in again.' }

    const current = formData.get('current')
    const next = formData.get('next')
    const confirmation = formData.get('confirmation')
    if (typeof current !== 'string' || !current || typeof next !== 'string') return { error: 'Enter both passwords.' }
    if (next.length < 12) return { error: 'New password must be at least 12 characters.' }
    if (next.length > 1024) return { error: 'New password is too long.' }
    if (confirmation !== next) return { error: 'The new passwords do not match.' }

    const response = await fetch(backendUrl('/api/auth/password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE}=${sessionToken}` },
      body: JSON.stringify({ current, next }),
      cache: 'no-store',
    })
    const result: unknown = await response.json()
    if (!response.ok) {
      const error = typeof result === 'object' && result !== null && 'error' in result
        && typeof result.error === 'string' ? result.error : 'Could not change the password.'
      return { error }
    }
    ;(await cookies()).delete(SESSION_COOKIE)
    redirect('/login?passwordChanged=1')
  }

  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value
  const session = sessionToken ? await verifySessionToken(sessionToken) : null
  if (!session) return { error: 'Session expired — sign in again.' }

  const current = formData.get('current')
  const next = formData.get('next')
  const confirmation = formData.get('confirmation')
  if (typeof current !== 'string' || !current || typeof next !== 'string') return { error: 'Enter both passwords.' }
  if (next.length < 12) return { error: 'New password must be at least 12 characters.' }
  if (next.length > 1024) return { error: 'New password is too long.' }
  if (confirmation !== next) return { error: 'The new passwords do not match.' }

  const user = await withDb(async db => {
    const { rows } = await db.query<AppUser>(
      'SELECT id, password_hash FROM app_user WHERE id = $1',
      [session.userId],
    )
    return rows[0]
  })
  if (!user) return { error: 'Account not found.' }
  if (!(await bcrypt.compare(current, user.password_hash))) return { error: 'Current password is wrong.' }

  await withDb(async db => {
    await db.query(`
      UPDATE app_user SET password_hash = $1, session_version = session_version + 1
      WHERE id = $2
    `, [
      await bcrypt.hash(next, 12),
      user.id,
    ])
  })
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login?passwordChanged=1')
}

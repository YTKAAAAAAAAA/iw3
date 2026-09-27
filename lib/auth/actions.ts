'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { withDb } from '@/lib/db'
import { createSessionToken, hasSessionSecret, rateLimitIdentity, SESSION_COOKIE, verifySessionToken } from './session'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const MAX_ATTEMPTS = 8
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL?.trim() || 'dispatcher@local'

export type LoginState = { error?: string }
type AppUser = { id: number; password_hash: string; session_version: number }

function secretsMatch(input: string, expected: string): boolean {
  const inputBytes = Buffer.from(input)
  const expectedBytes = Buffer.from(expected)
  return inputBytes.length === expectedBytes.length && timingSafeEqual(inputBytes, expectedBytes)
}

async function isLocked(key: string): Promise<boolean> {
  return withDb(async db => {
    const { rows } = await db.query<{ attempts: number }>(
      `SELECT attempts FROM auth_login_attempt
       WHERE key_hash = $1 AND window_started_at > now() - interval '10 minutes'`,
      [key],
    )
    return (rows[0]?.attempts ?? 0) >= MAX_ATTEMPTS
  })
}

async function recordFailure(key: string): Promise<void> {
  await withDb(async db => {
    await db.query(
      `INSERT INTO auth_login_attempt (key_hash, attempts, window_started_at)
       VALUES ($1, 1, now())
       ON CONFLICT (key_hash) DO UPDATE SET
         attempts = CASE
           WHEN auth_login_attempt.window_started_at <= now() - interval '10 minutes' THEN 1
           ELSE auth_login_attempt.attempts + 1
         END,
         window_started_at = CASE
           WHEN auth_login_attempt.window_started_at <= now() - interval '10 minutes' THEN now()
           ELSE auth_login_attempt.window_started_at
         END,
         updated_at = now()`,
      [key],
    )
    await db.query("DELETE FROM auth_login_attempt WHERE updated_at < now() - interval '30 days'")
  })
}

async function clearAttempts(key: string): Promise<void> {
  await withDb(async db => {
    await db.query('DELETE FROM auth_login_attempt WHERE key_hash = $1', [key])
  })
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const value = formData.get('password')
  const password = typeof value === 'string' ? value : ''
  if (!password) return { error: 'Enter the password.' }
  if (password.length > 1024) return { error: 'Password is too long.' }
  if (!hasSessionSecret()) return { error: 'Sign-in is not configured on this deployment.' }

  const requestHeaders = await headers()
  const attemptKey = rateLimitIdentity(requestHeaders.get('x-real-ip')?.trim() || 'unknown')
  if (await isLocked(attemptKey)) return { error: 'Too many attempts. Wait ten minutes and try again.' }

  let user = await withDb(async db => {
    const { rows } = await db.query<AppUser>(
      'SELECT id, password_hash, session_version FROM app_user WHERE email = $1 LIMIT 1',
      [ADMIN_EMAIL],
    )
    return rows[0]
  })

  if (!user) {
    const bootstrapPassword = process.env.INITIAL_ADMIN_PASSWORD
    if (!bootstrapPassword || bootstrapPassword.length < 12) {
      return { error: 'The initial administrator password has not been configured.' }
    }

    if (!secretsMatch(password, bootstrapPassword)) {
      await recordFailure(attemptKey)
      return { error: 'Wrong password.' }
    }

    const hash = await bcrypt.hash(password, 12)
    user = await withDb(async db => {
      await db.query(
        `INSERT INTO app_user (email, password_hash) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [ADMIN_EMAIL, hash],
      )
      const result = await db.query<AppUser>(
        'SELECT id, password_hash, session_version FROM app_user WHERE email = $1 LIMIT 1',
        [ADMIN_EMAIL],
      )
      return result.rows[0]
    })
  } else if (!(await bcrypt.compare(password, user.password_hash))) {
    const bootstrapPassword = process.env.INITIAL_ADMIN_PASSWORD
    if (!bootstrapPassword || bootstrapPassword.length < 12 || !secretsMatch(password, bootstrapPassword)) {
      await recordFailure(attemptKey)
      return { error: 'Wrong password.' }
    }

    const hash = await bcrypt.hash(password, 12)
    user = await withDb(async db => {
      const { rows } = await db.query<AppUser>(`
        UPDATE app_user
        SET password_hash = $1, session_version = session_version + 1
        WHERE id = $2
        RETURNING id, password_hash, session_version
      `, [hash, user.id])
      return rows[0]
    })
  }

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await recordFailure(attemptKey)
    return { error: 'Wrong password.' }
  }

  await clearAttempts(attemptKey)
  const token = await createSessionToken(user.id, user.session_version)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
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

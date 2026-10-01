import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { withDb } from '@/lib/db'
import { hasSessionSecret, rateLimitIdentity } from './session'

const MAX_ATTEMPTS = 8
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL?.trim() || 'dispatcher@local'

type AppUser = { id: number; password_hash: string; session_version: number }
export type PasswordLoginResult =
  | { ok: true; userId: number; sessionVersion: number }
  | { ok: false; error: string }

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

export async function authenticatePassword(password: string, identity: string): Promise<PasswordLoginResult> {
  if (!password) return { ok: false, error: 'Enter the password.' }
  if (password.length > 1024) return { ok: false, error: 'Password is too long.' }
  if (!hasSessionSecret()) return { ok: false, error: 'Sign-in is not configured on this deployment.' }

  const attemptKey = rateLimitIdentity(identity || 'unknown')
  if (await isLocked(attemptKey)) {
    return { ok: false, error: 'Too many attempts. Wait ten minutes and try again.' }
  }

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
      return { ok: false, error: 'The initial administrator password has not been configured.' }
    }

    if (!secretsMatch(password, bootstrapPassword)) {
      await recordFailure(attemptKey)
      return { ok: false, error: 'Wrong password.' }
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
      return { ok: false, error: 'Wrong password.' }
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
    return { ok: false, error: 'Wrong password.' }
  }

  await withDb(async db => {
    await db.query('DELETE FROM auth_login_attempt WHERE key_hash = $1', [attemptKey])
  })
  return { ok: true, userId: user.id, sessionVersion: user.session_version }
}

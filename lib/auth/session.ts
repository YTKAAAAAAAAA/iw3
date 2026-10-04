import 'server-only'
import { createHmac } from 'node:crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { withDb } from '@/lib/db'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const DEVELOPMENT_SECRET = 'local-development-only-session-secret'
export const SESSION_COOKIE = 'iatw_session'

function sessionSecret(): string | null {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET
  return process.env.NODE_ENV === 'development' ? DEVELOPMENT_SECRET : null
}

export type SessionPayload = { userId: number; expiresAt: number; sessionVersion: number }

export function hasSessionSecret(): boolean {
  return sessionSecret() !== null
}

export function rateLimitIdentity(identity: string): string {
  const secret = sessionSecret()
  if (!secret) throw new Error('SESSION_SECRET must be configured before rate limiting sign-in.')
  return createHmac('sha256', secret).update(identity).digest('hex')
}

export async function createSessionToken(userId: number, sessionVersion: number): Promise<string> {
  const secret = sessionSecret()
  if (!secret) throw new Error('SESSION_SECRET must be configured before issuing a session.')

  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000
  return new SignJWT({ userId, expiresAt, sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret))
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = sessionSecret()
  if (!secret) return null

  let payload: JWTPayload
  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    payload = verified.payload
  } catch {
    return null
  }

  const userId = Number(payload.userId)
  const expiresAt = Number(payload.expiresAt)
  const sessionVersion = Number(payload.sessionVersion ?? 0)
  if (!Number.isSafeInteger(userId) || userId < 1
    || !Number.isSafeInteger(expiresAt) || Date.now() > expiresAt
    || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0) return null
  const currentVersion = await withDb(async db => {
    const { rows } = await db.query<{ session_version: number }>(
      'SELECT session_version FROM app_user WHERE id = $1',
      [userId],
    )
    return rows[0]?.session_version
  })
  if (currentVersion === undefined || currentVersion !== sessionVersion) return null
  return { userId, expiresAt, sessionVersion }
}

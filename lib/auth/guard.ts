import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from './session'

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const backendUrl = process.env.APP_BACKEND_URL
  if (!backendUrl) return verifySessionToken(token)

  let response: Response
  try {
    response = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/auth/check`, {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      cache: 'no-store',
    })
  } catch (cause) {
    console.error('Could not reach the session backend.', cause)
    throw new Error('The session backend is unavailable.')
  }
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Session backend returned ${response.status}.`)
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null || !('authenticated' in value)
    || value.authenticated !== true || !('userId' in value) || typeof value.userId !== 'number'
    || !Number.isSafeInteger(value.userId) || !('expiresAt' in value)
    || typeof value.expiresAt !== 'number' || !Number.isSafeInteger(value.expiresAt)
    || !('sessionVersion' in value) || typeof value.sessionVersion !== 'number'
    || !Number.isSafeInteger(value.sessionVersion)) {
    throw new Error('The session backend returned an invalid response.')
  }
  return {
    userId: value.userId,
    expiresAt: value.expiresAt,
    sessionVersion: value.sessionVersion,
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function assertSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

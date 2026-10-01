import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authenticatePassword } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

function authenticatedLoginIdentity(request: Request): string | null {
  const expected = process.env.BACKEND_PROXY_SECRET
  const provided = request.headers.get('x-backend-secret')
  const identity = request.headers.get('x-login-identity')
  const signature = request.headers.get('x-login-signature')
  if (!expected || !provided || !identity || !signature || identity.length > 255
    || !/^[\da-f]{64}$/i.test(signature)) return null

  const expectedSecretBytes = Buffer.from(expected)
  const providedSecretBytes = Buffer.from(provided)
  if (expectedSecretBytes.length !== providedSecretBytes.length
    || !timingSafeEqual(expectedSecretBytes, providedSecretBytes)) return null

  const expectedSignature = createHmac('sha256', expected).update(identity).digest()
  const providedSignature = Buffer.from(signature, 'hex')
  if (providedSignature.length !== expectedSignature.length
    || !timingSafeEqual(expectedSignature, providedSignature)) return null
  return identity
}

export async function POST(request: Request) {
  const identity = authenticatedLoginIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request must be valid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || !('password' in body)
    || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
  }

  try {
    const result = await authenticatePassword(body.password, identity)
    if (!result.ok) {
      const status = result.error.startsWith('Too many attempts') ? 429 : 401
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ userId: result.userId, sessionVersion: result.sessionVersion }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Backend password authentication failed.', error)
    return NextResponse.json({ error: 'Sign-in service is unavailable.' }, { status: 503 })
  }
}

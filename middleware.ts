import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * One shared password for the whole site.
 *
 * This is deliberately NOT an account system: there are no users, no sessions
 * and nothing to administer — it is a lock on the door, so that a link which
 * ends up in the wrong WhatsApp group does not hand a stranger the agency's
 * worker list. Five people in an office share one password; when real accounts
 * arrive, this file is deleted in one go.
 *
 * Basic auth rather than a login screen on purpose: the browser owns the
 * prompt, there is no cookie to forge, no session to expire, and nobody can
 * mistake it for the sign-in that does not exist yet.
 *
 * Configure in Vercel (never in the repo):
 *   npx vercel env add SITE_PASSWORD production
 *
 * With no SITE_PASSWORD set the site stays open — that keeps local development
 * frictionless, and it means forgetting the variable leaves the site exactly as
 * public as it was before, rather than locking the office out of their own tool.
 */

const USER = process.env.SITE_USER ?? 'IatW'

/** Compare without leaking the answer through timing. */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD
  if (!password) return NextResponse.next()

  const header = request.headers.get('authorization')
  if (header?.startsWith('Basic ')) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(':')
      /* A password may contain colons; only the first one separates. The name
         is not the secret, so it is matched case-insensitively — a phone that
         autocapitalises should not lock somebody out. The password stays exact
         and is compared in constant time. */
      if (user.toLowerCase() === USER.toLowerCase() && sameSecret(rest.join(':'), password)) return NextResponse.next()
    } catch { /* malformed header — fall through to the challenge */ }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="International@Work", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

export const config = {
  /* Everything except Next's own static output and the tab icon. */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}

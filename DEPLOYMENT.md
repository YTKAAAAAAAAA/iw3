# Temporary preview deployment

The repository is configured for Next.js on Vercel. The protected workforce,
hours, time-off, and Warehouse vacancy screens read their records from
PostgreSQL. These screens are currently read-only; do not use this preview for
operational dispatch until schedule and absence changes are wired to persistent
database writes.

## Before deploying

1. Create a Vercel preview project and a managed PostgreSQL database with TLS
   and a pooled connection string.
2. Set these server-only variables in the Vercel **Preview** environment:
   - `DATABASE_URL` — the pooled PostgreSQL URL.
   - `SESSION_SECRET` — a cryptographically random secret of at least 32 bytes.
   - `INITIAL_ADMIN_EMAIL` — the dispatcher account email (defaults to `dispatcher@local`).
   - `INITIAL_ADMIN_PASSWORD` — a unique password of at least 12 characters.
   - `GEOCODER_USER_AGENT` — a real application identifier and contact URL if
     address search is enabled.
3. Run `npm run db:migrate` with `DATABASE_URL` pointing at the preview
   database. Migrations create/extend the schema; they do not seed, export, or
   overwrite workers or shifts.
4. Deploy the preview and verify `/login`, login/logout, and the protected
   routes before sharing the URL.
5. The first successful login creates the dispatcher account using
   `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`. If that account already
   exists, the configured initial password can reset its password at sign-in.
   After signing in, remove `INITIAL_ADMIN_PASSWORD` from Vercel. Keep
   `INITIAL_ADMIN_EMAIL` unchanged so the app continues to look up the same
   account.

Use Preview-only secrets for a temporary deployment. Never put credentials in
`NEXT_PUBLIC_*`, source files, command output, or Git.

## Real records

The local PostgreSQL database contains real worker, absence, and Warehouse
shift data. Do not copy it to a third-party host until that host and the
personal-data processing have been approved. If approved, migrate the target
schema first and transfer only the required business tables through an
encrypted, access-controlled process. Exclude local account and migration
metadata. Keep no unencrypted dump in the repository or deployment artifacts.

The UI reads worker, shift, absence, site, company, and requirement records from
the configured database. Home addresses are not required and are not displayed.

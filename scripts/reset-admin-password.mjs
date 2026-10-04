/* Sets a new dispatcher password and signs out every existing session.
 *
 *   ADMIN_NEW_PASSWORD='…' npm run admin:reset-password
 *
 * It runs on the server, next to the database, because that is the only place
 * a password reset should be possible: the sign-in form never accepts the
 * initial password again once the account exists. In Docker:
 *
 *   docker compose exec -e ADMIN_NEW_PASSWORD='…' app node scripts/reset-admin-password.mjs
 */
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
const email = process.env.INITIAL_ADMIN_EMAIL?.trim() || 'dispatcher@local'
const password = process.env.ADMIN_NEW_PASSWORD ?? ''

if (!connectionString) throw new Error('Set DATABASE_URL before resetting the password.')
if (password.length < 12 || password.length > 1024) {
  throw new Error('Set ADMIN_NEW_PASSWORD to a password of 12 to 1024 characters.')
}

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
try {
  const hash = await bcrypt.hash(password, 12)
  const { rowCount } = await pool.query(
    `INSERT INTO app_user (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           session_version = app_user.session_version + 1`,
    [email, hash],
  )
  if (rowCount !== 1) throw new Error('The dispatcher account could not be updated.')
  console.log(`Password updated for ${email}. Every existing session has been signed out.`)
} finally {
  await pool.end()
}

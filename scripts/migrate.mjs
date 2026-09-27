import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('Set DATABASE_URL before running database migrations.')

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
const client = await pool.connect()

try {
  await client.query('BEGIN')
  await client.query("SELECT pg_advisory_xact_lock(hashtext('international-at-work:migrations'))")
  await client.query(await readFile(join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8'))
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const migrationDirectory = join(process.cwd(), 'db', 'migrations')
  const migrations = (await readdir(migrationDirectory))
    .filter(name => name.endsWith('.sql'))
    .sort()

  for (const name of migrations) {
    const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
    if (rows.length) continue

    await client.query(await readFile(join(migrationDirectory, name), 'utf8'))
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
    console.log(`Applied ${name}`)
  }

  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}

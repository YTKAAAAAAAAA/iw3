import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
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
  client.release()
  await pool.end()
  throw error
}

/* Workday photos still stored as BYTEA are written to the photo directory
   (lib/photo-storage.ts) in small batches, then cleared from the row. Safe to
   run repeatedly: only rows without a file are touched. */
try {
  const photoDirectory = resolve(process.env.PHOTO_STORAGE_DIR ?? join(process.cwd(), 'data', 'photos'))
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  let moved = 0
  for (;;) {
    const { rows } = await client.query(`
      SELECT id, content_type, image FROM vacancy_workday_photo
      WHERE storage_key IS NULL AND image IS NOT NULL
      ORDER BY id LIMIT 20
    `)
    if (!rows.length) break
    await mkdir(photoDirectory, { recursive: true })
    for (const row of rows) {
      const key = `${randomUUID()}.${extension[row.content_type]}`
      const temporary = join(photoDirectory, `.${key}.tmp`)
      await writeFile(temporary, row.image, { flag: 'wx' })
      await rename(temporary, join(photoDirectory, key))
      await client.query(
        'UPDATE vacancy_workday_photo SET storage_key = $1, image = NULL WHERE id = $2 AND storage_key IS NULL',
        [key, row.id],
      )
      moved++
    }
  }
  if (moved) console.log(`Moved ${moved} workday photos from the database to ${photoDirectory}`)
} finally {
  client.release()
  await pool.end()
}

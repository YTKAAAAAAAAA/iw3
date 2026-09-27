import 'server-only'
import { Pool, type PoolClient } from 'pg'

let pool: Pool | undefined

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (process.env.NODE_ENV === 'production' && !connectionString) {
      throw new Error('DATABASE_URL must be configured in production.')
    }

    pool = new Pool({
      ...(connectionString ? { connectionString } : {
        host: process.env.PGHOST ?? 'localhost',
        port: Number(process.env.PGPORT ?? 5433),
        user: process.env.PGUSER ?? 'dispatcher',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE ?? 'dispatcher',
      }),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  }

  return pool
}

export async function withDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

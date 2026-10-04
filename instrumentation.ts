/* Runs once when a server starts. The hourly Flexpedia and Supabase sync
   lives in the backend process that owns the database; a frontend-only
   deployment (APP_BACKEND_URL set, e.g. on Vercel) and the build skip it. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.APP_BACKEND_URL || process.env.NEXT_PHASE === 'phase-production-build') return
  const { startSyncScheduler } = await import('./lib/sync/scheduler')
  startSyncScheduler()
}

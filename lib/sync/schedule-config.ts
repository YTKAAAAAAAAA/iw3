/** Minutes between automatic syncs. 60 by default in production; off in
 *  development unless SYNC_INTERVAL_MINUTES is set, so a local `next dev`
 *  does not quietly import into whatever database it points at. */
export function syncIntervalMinutes(): number {
  const configured = process.env.SYNC_INTERVAL_MINUTES
  if (configured === undefined || configured === '') return process.env.NODE_ENV === 'production' ? 60 : 0
  const minutes = Number(configured)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0
}

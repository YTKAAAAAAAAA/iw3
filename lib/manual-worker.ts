import { createHash } from 'node:crypto'

export type WorkerIdentityConflict = {
  id: number
  fullName: string
}

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()

export function manualWorkerIdentityKey(fullName: string): string {
  // The trailing separator keeps keys of decisions saved before phone numbers were removed valid.
  return createHash('sha256')
    .update(`${normalizeName(fullName)}\0`)
    .digest('hex')
}

export function findWorkerIdentityConflicts(
  fullName: string,
  existing: WorkerIdentityConflict[],
): WorkerIdentityConflict[] {
  const name = normalizeName(fullName)
  return existing.filter(worker => normalizeName(worker.fullName) === name)
}

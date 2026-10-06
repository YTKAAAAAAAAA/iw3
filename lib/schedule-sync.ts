/* ------------------------------------------------------------------
   Saving a vacancy schedule as changes, not as a snapshot.

   The page used to send the whole schedule on every edit and the server
   rewrote every row. That was slow (2 s for one headcount on 600 shifts),
   it turned every slot the server had only *inferred* from shifts into a
   stored client order, and — worst — it silently put back any row someone
   else had changed since the page loaded, the hourly Warehouse sync included.

   Now the page keeps the last state it knows the server has (`base`), sends
   only what differs from it, and when the server says the schedule moved on
   (`stale`) it fetches the new state and replays its own changes on top
   (`mergeSchedule`). A row the user did not touch is never written.
   ------------------------------------------------------------------ */
import type { Demand, Offer, RosterEntry, StandingAssignment } from './types.ts'

export type DemandRow = Pick<
  Demand,
  'id' | 'vacancyId' | 'date' | 'placeId' | 'section' | 'headcount' | 'start' | 'end' | 'note'
>
export type RosterRow = Pick<
  RosterEntry,
  | 'id'
  | 'vacancyId'
  | 'date'
  | 'placeId'
  | 'section'
  | 'workerId'
  | 'extra'
  | 'extraReason'
  | 'standingId'
  | 'start'
  | 'end'
  | 'note'
> & { position: number }

export type ScheduleState = {
  demand: DemandRow[]
  roster: RosterRow[]
  standing: StandingAssignment[]
  offers: Offer[]
}

export type ScheduleDiff = {
  demand: DemandRow[]
  roster: RosterRow[]
  deleteDemandIds: string[]
  deleteRosterIds: string[]
  /** Sent whole, and only when something in them changed. */
  standing?: StandingAssignment[]
  offers?: Offer[]
}

/** Ids the server issued; client-made ids (`d-…`, `r-…`, `derived-…`) are not. */
export const isStoredId = (id: string) => /^[1-9]\d{0,14}$/.test(id)

export const demandRow = (row: Demand): DemandRow => ({
  id: row.id,
  vacancyId: row.vacancyId,
  date: row.date,
  placeId: row.placeId,
  section: row.section ?? null,
  headcount: row.headcount,
  start: row.start ?? null,
  end: row.end ?? null,
  note: row.note ?? null,
})

const slotKey = (row: { date: string; placeId: string | null; section: string | null }) =>
  [row.date, row.placeId ?? '', row.section ?? ''].join('\u0000')

/** A shift's place in its slot is its order in the list — the number beside a
 *  name — so moving somebody up is a change to two rows. */
export function rosterRows(rows: RosterEntry[]): RosterRow[] {
  const next = new Map<string, number>()
  return rows.map(row => {
    const key = slotKey(row)
    const position = next.get(key) ?? 0
    next.set(key, position + 1)
    return {
      id: row.id,
      vacancyId: row.vacancyId,
      date: row.date,
      placeId: row.placeId,
      section: row.section ?? null,
      workerId: row.workerId,
      extra: row.extra,
      extraReason: row.extraReason ?? null,
      standingId: row.standingId ?? null,
      start: row.start ?? null,
      end: row.end ?? null,
      note: row.note ?? null,
      position,
    }
  })
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function changed<T extends { id: string }>(base: T[], current: T[]) {
  const before = new Map(base.map(row => [row.id, row]))
  const now = new Set(current.map(row => row.id))
  return {
    upserts: current.filter(row => !before.has(row.id) || !same(before.get(row.id), row)),
    /* Only rows the server knows can be deleted on the server. A slot it had
       merely inferred disappears by itself once its shifts are gone. */
    deletes: base.filter(row => !now.has(row.id) && isStoredId(row.id)).map(row => row.id),
  }
}

export function diffSchedule(base: ScheduleState, current: ScheduleState): ScheduleDiff | null {
  const demand = changed(base.demand, current.demand)
  const roster = changed(base.roster, current.roster)
  const diff: ScheduleDiff = {
    demand: demand.upserts,
    roster: roster.upserts,
    deleteDemandIds: demand.deletes,
    deleteRosterIds: roster.deletes,
  }
  if (!same(base.standing, current.standing)) diff.standing = current.standing
  if (!same(base.offers, current.offers)) diff.offers = current.offers
  const empty =
    !diff.demand.length &&
    !diff.roster.length &&
    !diff.deleteDemandIds.length &&
    !diff.deleteRosterIds.length &&
    !diff.standing &&
    !diff.offers
  return empty ? null : diff
}

/** Three-way merge by id: start from what the server has now (`theirs`) and
 *  replay what this page changed since `base`. A row changed here wins over
 *  the same row changed elsewhere; a row deleted elsewhere stays deleted even
 *  if it was edited here, because there is nothing left to edit. */
export function mergeRows<T extends { id: string }>(base: T[], mine: T[], theirs: T[]): T[] {
  const before = new Map(base.map(row => [row.id, row]))
  const mineById = new Map(mine.map(row => [row.id, row]))
  const theirIds = new Set(theirs.map(row => row.id))
  const merged: T[] = []
  for (const row of theirs) {
    const original = before.get(row.id)
    const local = mineById.get(row.id)
    if (original && !local) continue // deleted here
    merged.push(original && local && !same(original, local) ? local : row)
  }
  for (const row of mine) {
    if (!before.has(row.id) && !theirIds.has(row.id)) merged.push(row) // added here
  }
  return merged
}

export function mergeSchedule(base: ScheduleState, mine: ScheduleState, theirs: ScheduleState): ScheduleState {
  return {
    demand: mergeRows(base.demand, mine.demand, theirs.demand),
    roster: mergeRows(base.roster, mine.roster, theirs.roster),
    standing: mergeRows(base.standing, mine.standing, theirs.standing),
    offers: mergeRows(base.offers, mine.offers, theirs.offers),
  }
}

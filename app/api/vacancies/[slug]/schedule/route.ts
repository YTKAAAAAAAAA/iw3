import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { parseScheduleSave } from '@/lib/schedule-persistence'

class ScheduleRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

type RouteContext = { params: Promise<{ slug: string }> }

const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status })

function isPgError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function hasSameFields(current: unknown, next: Record<string, unknown>, fields: string[]): boolean {
  if (typeof current !== 'object' || current === null || Array.isArray(current)) return false
  const record = current as Record<string, unknown>
  return fields.every(field => JSON.stringify(record[field]) === JSON.stringify(next[field]))
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const { slug } = await params

  try {
    const result = await withDb(async db => {
      const vacancy = await db.query<{ id: number }>('SELECT id FROM vacancy WHERE slug = $1', [slug])
      if (!vacancy.rows[0]) return null
      const vacancyId = vacancy.rows[0].id
      const [state, demand, shifts] = await Promise.all([
        db.query<{ revision: number; standing: unknown; offers: unknown }>(
          'SELECT revision, standing, offers FROM vacancy_schedule_state WHERE vacancy_id = $1',
          [vacancyId],
        ),
        db.query<{
          id: number; date: string; site_slug: string | null; section: string | null
          headcount: number; start_time: string | null; end_time: string | null; note: string | null
        }>(`
          SELECT id, date::text AS date, site_slug, section, headcount,
            to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time, note
          FROM vacancy_demand
          WHERE vacancy_id = $1
          ORDER BY date, site_slug NULLS FIRST, section NULLS FIRST, id
        `, [vacancyId]),
        db.query<{
          id: number; date: string; site_slug: string; section: string | null
          worker_id: number | null; is_extra: boolean; scheduled_start: string | null
          scheduled_end: string | null; note: string | null
        }>(`
          SELECT id, date::text AS date, site_slug, section, worker_id, is_extra,
            to_char(scheduled_start, 'HH24:MI') AS scheduled_start,
            to_char(scheduled_end, 'HH24:MI') AS scheduled_end, note
          FROM shift
          WHERE vacancy_id = $1 AND confirmation_status IS DISTINCT FROM 'cancelled'
          ORDER BY date, site_slug, section NULLS FIRST, schedule_position, id
        `, [vacancyId]),
      ])
      const demandSlots = demand.rows.map(row => ({
        id: String(row.id), vacancyId: slug, date: row.date, placeId: row.site_slug,
        section: row.section, headcount: row.headcount, start: row.start_time,
        end: row.end_time, note: row.note,
      }))
      const slotKeys = new Set(demandSlots.map(row => [row.date, row.placeId ?? '', row.section ?? ''].join('\u0000')))
      const inferred = new Map<string, {
        id: string; vacancyId: string; date: string; placeId: string; section: string | null
        headcount: number; start: string | null; end: string | null; note: string | null
      }>()
      for (const shift of shifts.rows) {
        const key = [shift.date, shift.site_slug, shift.section ?? ''].join('\u0000')
        if (slotKeys.has(key)) continue
        const row = inferred.get(key)
        if (row) row.headcount += 1
        else inferred.set(key, {
          id: `derived-${shift.id}`, vacancyId: slug, date: shift.date, placeId: shift.site_slug,
          section: shift.section, headcount: 1, start: shift.scheduled_start, end: shift.scheduled_end, note: null,
        })
      }
      return {
        vacancyId: slug,
        revision: state.rows[0]?.revision ?? 0,
        demand: [...demandSlots, ...inferred.values()],
        roster: shifts.rows.map(shift => ({
          id: String(shift.id), vacancyId: slug, date: shift.date, placeId: shift.site_slug,
          section: shift.section, workerId: shift.worker_id === null ? null : String(shift.worker_id),
          extra: shift.is_extra, extraReason: null, standingId: null,
          start: shift.scheduled_start, end: shift.scheduled_end, note: shift.note,
        })),
        standing: state.rows[0]?.standing ?? [],
        offers: state.rows[0]?.offers ?? [],
      }
    })
    return result ? NextResponse.json(result) : jsonError(404, 'Vacancy not found.')
  } catch (error) {
    console.error('Failed to load vacancy schedule.', error)
    return jsonError(500, 'Could not load the schedule. Please try again.')
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return jsonError(401, 'Authentication required.')
  const { slug } = await params

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
    return jsonError(413, 'Schedule request is too large.')
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return jsonError(400, 'Request body must be readable.')
  }
  if (new TextEncoder().encode(rawBody).byteLength > 2_000_000) {
    return jsonError(413, 'Schedule request is too large.')
  }
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return jsonError(400, 'Request body must be valid JSON.')
  }
  const input = parseScheduleSave(body, slug)
  if (!input) return jsonError(400, 'Invalid schedule snapshot.')

  try {
    const result = await withDb(async db => {
      await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
      try {
        const vacancy = await db.query<{ id: number; company_id: number }>(
          'SELECT id, company_id FROM vacancy WHERE slug = $1 FOR UPDATE',
          [slug],
        )
        if (!vacancy.rows[0]) throw new ScheduleRequestError(404, 'Vacancy not found.')
        const vacancyId = vacancy.rows[0].id
        const state = await db.query<{ revision: number; standing: unknown; offers: unknown }>(
          'SELECT revision, standing, offers FROM vacancy_schedule_state WHERE vacancy_id = $1 FOR UPDATE',
          [vacancyId],
        )
        if (!state.rows[0]) throw new ScheduleRequestError(503, 'Schedule persistence is not initialized.')
        if (state.rows[0].revision !== input.revision) {
          throw new ScheduleRequestError(409, 'This schedule changed since it was loaded. Reload before saving.')
        }

        const isStoredId = (id: string) => /^[1-9]\d{0,14}$/.test(id) && Number.isSafeInteger(Number(id))
        const selectedIds = (rows: { id: string }[]) => rows.map(row => row.id).filter(isStoredId).map(Number)
        const demandIds = selectedIds(input.demand)
        const rosterIds = selectedIds(input.roster)
        const deleteDemandIds = input.deleteDemandIds.map(Number)
        const deleteRosterIds = input.deleteRosterIds.map(Number)

        const [ownedDemand, ownedRoster] = await Promise.all([
          db.query<{ id: number }>(`
            SELECT id FROM vacancy_demand
            WHERE vacancy_id = $1 AND id = ANY($2::int[])
            FOR UPDATE
          `, [vacancyId, [...demandIds, ...deleteDemandIds]]),
          db.query<{
            id: number; date: string; site_slug: string; section: string | null; worker_id: number | null
            actual_start: string | null; actual_end: string | null; attendance_status: string | null
            is_extra: boolean; note: string | null; scheduled_start: string | null; scheduled_end: string | null
            supabase_schedule_id: string | null; offer_count: number; cover_count: number
          }>(`
            SELECT sh.id, sh.date::text AS date, sh.site_slug, sh.section, sh.worker_id,
              sh.actual_start::text AS actual_start, sh.actual_end::text AS actual_end,
                sh.attendance_status, sh.is_extra, sh.note,
                to_char(sh.scheduled_start, 'HH24:MI') AS scheduled_start,
                to_char(sh.scheduled_end, 'HH24:MI') AS scheduled_end,
                sh.supabase_schedule_id::text,
                (SELECT count(*)::int FROM shift_offer so WHERE so.shift_id = sh.id) AS offer_count,
                (SELECT count(*)::int FROM shift covered WHERE covered.covers_shift_id = sh.id) AS cover_count
              FROM shift sh
              WHERE sh.vacancy_id = $1 AND sh.id = ANY($2::int[])
              FOR UPDATE OF sh
          `, [vacancyId, [...rosterIds, ...deleteRosterIds]]),
        ])
        if (ownedDemand.rows.length !== new Set([...demandIds, ...deleteDemandIds]).size) {
          throw new ScheduleRequestError(409, 'A demand row no longer belongs to this vacancy.')
        }
        if (ownedRoster.rows.length !== new Set([...rosterIds, ...deleteRosterIds]).size) {
          throw new ScheduleRequestError(409, 'A shift no longer belongs to this vacancy.')
        }

        const referencedSites = new Set<string>()
        for (const row of input.demand) if (row.placeId) referencedSites.add(row.placeId)
        for (const row of input.roster) referencedSites.add(row.placeId)
        for (const row of input.standing) if (row.placeId) referencedSites.add(row.placeId)
        if (referencedSites.size) {
          const sites = await db.query<{ site_slug: string }>(
            'SELECT site_slug FROM vacancy_site WHERE vacancy_id = $1 AND site_slug = ANY($2::text[])',
            [vacancyId, [...referencedSites]],
          )
          if (sites.rows.length !== referencedSites.size) {
            throw new ScheduleRequestError(400, 'A selected site is not part of this vacancy.')
          }
        }

        const existingRoster = new Map(ownedRoster.rows.map(row => [row.id, row]))
        const sourceRowsChangedByHand = new Set<number>()
        const workerIds = new Set<string>()
        const workersNeedingAccess = new Set<string>()
        for (const row of input.roster) {
          if (!row.workerId) continue
          workerIds.add(row.workerId)
          const current = isStoredId(row.id) ? existingRoster.get(Number(row.id)) : undefined
          if (current?.supabase_schedule_id && (
            current.date !== row.date
            || current.site_slug !== row.placeId
            || (current.section ?? null) !== row.section
            || current.worker_id !== (row.workerId === null ? null : Number(row.workerId))
            || current.is_extra !== row.extra
            || current.note !== row.note
            || current.scheduled_start !== row.start
            || current.scheduled_end !== row.end
          )) sourceRowsChangedByHand.add(current.id)
          if (!current || current.worker_id !== Number(row.workerId) || current.date !== row.date
            || current.site_slug !== row.placeId || (current.section ?? null) !== row.section) {
            workersNeedingAccess.add(row.workerId)
          }
        }
        for (const row of input.standing) {
          workerIds.add(row.workerId)
          const previous = Array.isArray(state.rows[0].standing)
            ? state.rows[0].standing.find(item => hasSameFields(item, row, ['id']))
            : undefined
          if (!previous || !hasSameFields(previous, row, [
            'id', 'vacancyId', 'workerId', 'placeId', 'section', 'weekdays',
            'start', 'end', 'from', 'to', 'note',
          ])) workersNeedingAccess.add(row.workerId)
        }
        for (const offer of input.offers) {
          workerIds.add(offer.workerId)
          const previous = Array.isArray(state.rows[0].offers)
            ? state.rows[0].offers.find(item => hasSameFields(item, offer, ['id']))
            : undefined
          if (!previous || !hasSameFields(previous, offer, [
            'id', 'vacancyId', 'workerId', 'date', 'status', 'note', 'at',
          ])) workersNeedingAccess.add(offer.workerId)
        }
        if (workerIds.size) {
          const workers = await db.query<{ id: number }>(
            'SELECT id FROM worker WHERE id = ANY($1::int[])',
            [[...workerIds].map(Number)],
          )
          if (workers.rows.length !== workerIds.size) {
            throw new ScheduleRequestError(400, 'A selected worker does not exist.')
          }
        }
        if (workersNeedingAccess.size) {
          const eligible = await db.query<{ id: number }>(`
            SELECT w.id
            FROM worker w
            JOIN worker_company_access access ON access.worker_id = w.id
            WHERE access.company_id = $1
              AND w.id = ANY($2::int[])
              AND w.is_active
              AND NOT w.is_fired
          `, [vacancy.rows[0].company_id, [...workersNeedingAccess].map(Number)])
          if (eligible.rows.length !== workersNeedingAccess.size) {
            throw new ScheduleRequestError(403, 'Only active workers with access to this company can be added to the schedule.')
          }
        }

        const unassignWithOffers = new Set<number>()
        for (const row of input.roster) {
          if (!isStoredId(row.id)) continue
          const current = existingRoster.get(Number(row.id))
          if (!current) continue
          const moved = current.date !== row.date || current.site_slug !== row.placeId
            || (current.section ?? null) !== row.section
          const reassigned = (current.worker_id === null ? null : String(current.worker_id)) !== row.workerId
          const hasWorkRecord = current.actual_start !== null || current.actual_end !== null
            || ['present', 'late', 'left_early', 'no_show', 'worked'].includes(current.attendance_status ?? '')
          if ((moved || reassigned) && hasWorkRecord) {
            throw new ScheduleRequestError(409, 'A shift with attendance or actual-time records cannot be moved or reassigned.')
          }
          if (moved && current.offer_count > 0) {
            throw new ScheduleRequestError(409, 'A shift with offer history cannot be moved.')
          }
          if (reassigned && current.offer_count > 0 && row.workerId === null && current.worker_id !== null) {
            unassignWithOffers.add(current.id)
          } else if (reassigned && current.offer_count > 0) {
            throw new ScheduleRequestError(409, 'A shift with offer history cannot be reassigned.')
          }
        }
        for (const id of deleteRosterIds) {
          const row = existingRoster.get(id)
          if (row && (row.actual_start !== null || row.actual_end !== null
            || ['present', 'late', 'left_early', 'no_show', 'worked'].includes(row.attendance_status ?? ''))) {
            throw new ScheduleRequestError(409, 'A shift with attendance or actual-time records cannot be removed.')
          }
        }

        const slotKeys = new Set<string>()
        for (const row of input.demand) {
          const key = [row.date, row.placeId ?? '', row.section ?? ''].join('\u0000')
          if (slotKeys.has(key)) throw new ScheduleRequestError(400, 'A demand slot may appear only once per date and site.')
          slotKeys.add(key)
        }

        const cancelled: number[] = []
        const removedSnapshots: Array<{ id: number; date: string; site_slug: string; section: string | null; worker_id: number | null }> = []
        for (const id of unassignWithOffers) {
          const row = existingRoster.get(id)!
          removedSnapshots.push({ id: row.id, date: row.date, site_slug: row.site_slug, section: row.section, worker_id: row.worker_id })
          await db.query(`
            UPDATE shift
            SET worker_id = NULL, confirmation_status = 'cancelled',
              supabase_sync_locked = supabase_sync_locked OR supabase_schedule_id IS NOT NULL
            WHERE id = $1 AND vacancy_id = $2
          `, [row.id, vacancyId])
          cancelled.push(row.id)
        }
        for (const row of ownedRoster.rows) {
          if (!deleteRosterIds.includes(row.id)) continue
          removedSnapshots.push({ id: row.id, date: row.date, site_slug: row.site_slug, section: row.section, worker_id: row.worker_id })
          if (row.offer_count > 0 || row.cover_count > 0) {
            await db.query(`
              UPDATE shift
              SET worker_id = NULL, confirmation_status = 'cancelled',
                supabase_sync_locked = supabase_sync_locked OR supabase_schedule_id IS NOT NULL
              WHERE id = $1 AND vacancy_id = $2
            `, [row.id, vacancyId])
            cancelled.push(row.id)
          } else {
            await db.query('DELETE FROM shift WHERE id = $1 AND vacancy_id = $2', [row.id, vacancyId])
          }
        }

        if (deleteDemandIds.length) {
          await db.query('DELETE FROM vacancy_demand WHERE vacancy_id = $1 AND id = ANY($2::int[])', [vacancyId, deleteDemandIds])
        }

        const updatedDemandIds = demandIds.filter(id => !deleteDemandIds.includes(id))
        if (updatedDemandIds.length) {
          const nonce = randomUUID()
          for (const id of updatedDemandIds) {
            await db.query(
              'UPDATE vacancy_demand SET section = $3 WHERE vacancy_id = $1 AND id = $2',
              [vacancyId, id, `__schedule_tmp_${nonce}_${id}`],
            )
          }
        }

        const mappings = { demand: {} as Record<string, string>, roster: {} as Record<string, string> }
        for (const row of input.demand) {
          const values = [vacancyId, row.date, row.placeId, row.section, row.headcount, row.start, row.end, row.note]
          if (isStoredId(row.id)) {
            await db.query(`
              UPDATE vacancy_demand
              SET date = $3::date, site_slug = $4, section = $5, headcount = $6,
                start_time = $7::time, end_time = $8::time, note = $9
              WHERE vacancy_id = $1 AND id = $2
            `, [vacancyId, Number(row.id), ...values.slice(1)])
            mappings.demand[row.id] = row.id
          } else {
            const created = await db.query<{ id: number }>(`
              INSERT INTO vacancy_demand
                (vacancy_id, date, site_slug, section, headcount, start_time, end_time, note)
              VALUES ($1, $2::date, $3, $4, $5, $6::time, $7::time, $8)
              RETURNING id
            `, values)
            mappings.demand[row.id] = String(created.rows[0].id)
          }
        }

        const updatedIds = rosterIds.filter(id => !deleteRosterIds.includes(id))
        if (updatedIds.length) {
          const nonce = randomUUID()
          for (const id of updatedIds) {
            await db.query(
              'UPDATE shift SET section = $3 WHERE vacancy_id = $1 AND id = $2',
              [vacancyId, id, `__schedule_tmp_${nonce}_${id}`],
            )
          }
        }

        const positions = new Map<string, number>()
        const nextPosition = new Map<string, number>()
        for (const row of input.roster) {
          const key = [row.date, row.placeId, row.section ?? ''].join('\u0000')
          const position = nextPosition.get(key) ?? 0
          positions.set(row.id, position)
          nextPosition.set(key, position + 1)
        }

        for (const row of input.roster) {
          if (isStoredId(row.id) && unassignWithOffers.has(Number(row.id))) {
            mappings.roster[row.id] = row.id
            continue
          }
          const values = [
            row.date, row.placeId, row.section, row.workerId === null ? null : Number(row.workerId),
            row.extra, row.note, row.start, row.end,
          ]
          if (isStoredId(row.id)) {
            await db.query(`
              UPDATE shift
              SET date = $3::date, site_slug = $4, section = $5, worker_id = $6,
                is_extra = $7, note = $8,
                scheduled_start = $9::time,
                scheduled_end = $10::time,
                schedule_position = $11,
                supabase_sync_locked = supabase_sync_locked OR $12
              WHERE vacancy_id = $1 AND id = $2
            `, [
              vacancyId, Number(row.id), ...values, positions.get(row.id),
              sourceRowsChangedByHand.has(Number(row.id)),
            ])
            mappings.roster[row.id] = row.id
          } else {
            const created = await db.query<{ id: number }>(`
              INSERT INTO shift
                (vacancy_id, date, site_slug, section, worker_id, is_extra, note, hours, scheduled_start, scheduled_end, schedule_position)
              VALUES ($1, $2::date, $3, $4, $5, $6, $7, 0, $8::time, $9::time, $10)
              RETURNING id
            `, [vacancyId, ...values, positions.get(row.id)])
            mappings.roster[row.id] = String(created.rows[0].id)
          }
        }

        const revision = state.rows[0].revision + 1
        await db.query(`
          UPDATE vacancy_schedule_state
          SET revision = $2, standing = $3::jsonb, offers = $4::jsonb,
            updated_at = now(), updated_by = $5
          WHERE vacancy_id = $1
        `, [vacancyId, revision, JSON.stringify(input.standing), JSON.stringify(input.offers), session.userId])
        await db.query(`
          INSERT INTO vacancy_change (vacancy_id, actor_user_id, event_type, details)
          VALUES ($1, $2, 'schedule_saved', $3::jsonb)
        `, [vacancyId, session.userId, JSON.stringify({
          revision, removed: removedSnapshots, cancelledShiftIds: cancelled,
          demandCount: input.demand.length, rosterCount: input.roster.length,
          standing: input.standing, offers: input.offers,
        })])

        await db.query('COMMIT')
        return { vacancyId: slug, revision, ids: mappings, cancelledShiftIds: cancelled.map(String) }
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ScheduleRequestError) return jsonError(error.status, error.message)
    if (isPgError(error, '40001')) return jsonError(409, 'This schedule changed concurrently. Reload before saving.')
    if (isPgError(error, '23505')) return jsonError(409, 'The requested schedule conflicts with an existing shift or demand slot.')
    if (isPgError(error, '23503')) return jsonError(400, 'A selected site, worker, or referenced record is invalid.')
    console.error('Failed to save vacancy schedule.', error)
    return jsonError(500, 'Could not save the schedule. Please try again.')
  }
}

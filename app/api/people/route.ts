import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { findWorkerIdentityConflicts, manualWorkerIdentityKey } from '@/lib/manual-worker'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (!isRecord(body)) return NextResponse.json({ error: 'Invalid worker details.' }, { status: 400 })

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : ''
  const companyIds = body.companyIds
  const resolutionWorkerId = body.resolutionWorkerId
  if (Object.keys(body).some(key => !['fullName', 'companyIds', 'confirmDuplicates', 'resolutionWorkerId'].includes(key))
    || fullName.length < 2 || fullName.length > 200
    || !Array.isArray(companyIds) || companyIds.length === 0 || companyIds.length > 50
    || !companyIds.every(id => typeof id === 'string' && /^c-[1-9]\d*$/.test(id)
      && Number.isSafeInteger(Number(id.slice(2))))
    || new Set(companyIds).size !== companyIds.length
    || body.confirmDuplicates !== undefined && typeof body.confirmDuplicates !== 'boolean'
    || resolutionWorkerId !== undefined && (typeof resolutionWorkerId !== 'string'
      || !/^[1-9]\d*$/.test(resolutionWorkerId)
      || !Number.isSafeInteger(Number(resolutionWorkerId)))
    || resolutionWorkerId !== undefined && body.confirmDuplicates === true) {
    return NextResponse.json({ error: 'Enter a name and at least one company.' }, { status: 400 })
  }

  const companyNumbers = (companyIds as string[]).map(id => Number(id.slice(2)))
  const identityKey = manualWorkerIdentityKey(fullName)
  try {
    const result = await withDb(async db => {
      await db.query('BEGIN')
      try {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('manual-worker:create'))")
        const priorDecision = await db.query<{ id: number; full_name: string }>(`
          SELECT w.id, w.full_name
          FROM manual_worker_identity_decision d
          JOIN worker w ON w.id = d.worker_id
          WHERE d.identity_key = $1
        `, [identityKey])
        if (priorDecision.rows[0]) {
          await db.query('COMMIT')
          return {
            kind: 'already-resolved' as const,
            worker: { id: String(priorDecision.rows[0].id), fullName: priorDecision.rows[0].full_name },
          }
        }

        const existing = await db.query<{ id: number; full_name: string }>(`
          SELECT id, full_name FROM worker
        `)
        const conflicts = findWorkerIdentityConflicts(fullName, existing.rows.map(row => ({
          id: row.id, fullName: row.full_name,
        })))
        if (resolutionWorkerId !== undefined) {
          const chosen = conflicts.find(person => person.id === Number(resolutionWorkerId))
          if (!chosen) {
            await db.query('ROLLBACK')
            return { kind: 'stale-choice' as const }
          }
          await db.query(`
            INSERT INTO manual_worker_identity_decision (identity_key, worker_id)
            VALUES ($1, $2)
          `, [identityKey, chosen.id])
          await db.query('COMMIT')
          return {
            kind: 'resolved-now' as const,
            worker: { id: String(chosen.id), fullName: chosen.fullName },
          }
        }
        if (conflicts.length && body.confirmDuplicates !== true) {
          await db.query('ROLLBACK')
          return { kind: 'conflict' as const, conflicts }
        }

        const companies = await db.query<{ id: number }>(
          'SELECT id FROM company WHERE id = ANY($1::int[]) AND archived_at IS NULL',
          [companyNumbers],
        )
        if (companies.rows.length !== companyNumbers.length) {
          await db.query('ROLLBACK')
          return { kind: 'invalid-company' as const }
        }

        const inserted = await db.query<{ id: number; full_name: string }>(`
          INSERT INTO worker (full_name, is_manually_created)
          VALUES ($1, TRUE)
          RETURNING id, full_name
        `, [fullName])
        const workerId = inserted.rows[0].id
        for (const companyId of companyNumbers) {
          await db.query(`
            INSERT INTO worker_company_access (worker_id, company_id)
            VALUES ($1, $2)
          `, [workerId, companyId])
        }
        await db.query(`
          INSERT INTO manual_worker_identity_decision (identity_key, worker_id)
          VALUES ($1, $2)
        `, [identityKey, workerId])
        await db.query('COMMIT')
        return { kind: 'created' as const, worker: { id: String(workerId), fullName: inserted.rows[0].full_name } }
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })

    if (result.kind === 'conflict') {
      return NextResponse.json({
        error: 'Possible existing people use the same name.',
        conflicts: result.conflicts,
      }, { status: 409 })
    }
    if (result.kind === 'stale-choice') {
      return NextResponse.json({ error: 'The possible matches changed. Review them again before choosing.' }, { status: 409 })
    }
    if (result.kind === 'invalid-company') {
      return NextResponse.json({ error: 'One or more selected companies no longer exist or were archived. Refresh and try again.' }, { status: 400 })
    }
    if (result.kind === 'already-resolved') {
      return NextResponse.json({ worker: result.worker, alreadyResolved: true }, { status: 200 })
    }
    if (result.kind === 'resolved-now') {
      return NextResponse.json({ worker: result.worker, resolvedNow: true }, { status: 200 })
    }
    return NextResponse.json({ worker: result.worker }, { status: 201 })
  } catch (error) {
    console.error('Failed to create worker manually.', error)
    return NextResponse.json({ error: 'Could not save the person. Please try again.' }, { status: 500 })
  }
}

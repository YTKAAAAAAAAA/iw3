import 'server-only'

import type { PoolClient } from 'pg'
import { withDb } from '@/lib/db'
import {
  flexpediaEmployeeName,
  flexpediaProfile,
  mergeFlexpediaProfile,
  resolveFlexpediaWorkerMatch,
  type FlexpediaEmployee,
  type FlexpediaWorkerProfile,
} from './flexpedia-employee'
import { readFlexpediaEmployees } from './flexpedia-test'
import { composeAddress } from './travel-sync'
import type { FlexpediaSyncStatus, FlexpediaSyncSummary } from './types'

type FlexpediaWorkerRow = {
  id: number
  full_name: string
  flexpedia_id: number | null
  is_active: boolean
  is_fired: boolean
  local_status_override: boolean
  home_address: string | null
  flexpedia_initials: string | null
  flexpedia_first_name: string | null
  flexpedia_insertion: string | null
  flexpedia_last_name: string | null
  flexpedia_gender: 'm' | 'f' | null
  flexpedia_birth_date: string | null
  flexpedia_street: string | null
  flexpedia_street_number: string | null
  flexpedia_street_number_addition: string | null
  flexpedia_post_code: string | null
  flexpedia_city: string | null
  flexpedia_phone: string | null
  flexpedia_phone_country: string | null
  flexpedia_mobile: string | null
  flexpedia_email: string | null
  flexpedia_residence_country: string | null
  flexpedia_nationality: string | null
}

export class FlexpediaSyncError extends Error {}

function profileFromRow(worker: FlexpediaWorkerRow): FlexpediaWorkerProfile {
  return {
    flexpediaId: worker.flexpedia_id,
    initials: worker.flexpedia_initials ?? '',
    firstName: worker.flexpedia_first_name ?? '',
    insertion: worker.flexpedia_insertion,
    lastName: worker.flexpedia_last_name ?? '',
    gender: worker.flexpedia_gender,
    birthDate: worker.flexpedia_birth_date,
    street: worker.flexpedia_street,
    streetNumber: worker.flexpedia_street_number,
    streetNumberAddition: worker.flexpedia_street_number_addition,
    postCode: worker.flexpedia_post_code,
    city: worker.flexpedia_city,
    phone: worker.flexpedia_phone,
    phoneCountry: worker.flexpedia_phone_country,
    mobile: worker.flexpedia_mobile,
    email: worker.flexpedia_email ?? '',
    residenceCountry: worker.flexpedia_residence_country,
    nationality: worker.flexpedia_nationality,
  }
}

function profileValues(profile: FlexpediaWorkerProfile) {
  return [
    profile.flexpediaId,
    profile.initials,
    profile.firstName,
    profile.insertion,
    profile.lastName,
    profile.gender,
    profile.birthDate,
    profile.street,
    profile.streetNumber,
    profile.streetNumberAddition,
    profile.postCode,
    profile.city,
    profile.phone,
    profile.phoneCountry,
    profile.mobile,
    profile.email,
    profile.residenceCountry,
    profile.nationality,
  ]
}

const profileColumns = `flexpedia_id, flexpedia_initials, flexpedia_first_name, flexpedia_insertion,
  flexpedia_last_name, flexpedia_gender, flexpedia_birth_date, flexpedia_street,
  flexpedia_street_number, flexpedia_street_number_addition, flexpedia_post_code,
  flexpedia_city, flexpedia_phone, flexpedia_phone_country, flexpedia_mobile,
  flexpedia_email, flexpedia_residence_country, flexpedia_nationality`

const profileAssignments = `flexpedia_id = $2, flexpedia_initials = $3, flexpedia_first_name = $4,
  flexpedia_insertion = $5, flexpedia_last_name = $6, flexpedia_gender = $7,
  flexpedia_birth_date = $8::date, flexpedia_street = $9, flexpedia_street_number = $10,
  flexpedia_street_number_addition = $11, flexpedia_post_code = $12, flexpedia_city = $13,
  flexpedia_phone = $14, flexpedia_phone_country = $15, flexpedia_mobile = $16,
  flexpedia_email = $17, flexpedia_residence_country = $18, flexpedia_nationality = $19`

async function syncSnapshot(
  db: PoolClient,
  employees: FlexpediaEmployee[],
): Promise<FlexpediaSyncSummary> {
  await db.query("SELECT pg_advisory_xact_lock(hashtext('international-at-work:flexpedia-sync'))")
  const workers = await db.query<FlexpediaWorkerRow>(`
    SELECT id, full_name, flexpedia_id, is_active, is_fired, local_status_override,
      home_address, flexpedia_initials, flexpedia_first_name,
      flexpedia_insertion, flexpedia_last_name, flexpedia_gender,
      flexpedia_birth_date::text, flexpedia_street, flexpedia_street_number,
      flexpedia_street_number_addition, flexpedia_post_code, flexpedia_city,
      flexpedia_phone, flexpedia_phone_country, flexpedia_mobile, flexpedia_email,
      flexpedia_residence_country, flexpedia_nationality
    FROM worker
    ORDER BY id
    FOR UPDATE
  `)
  if (employees.length === 0 && workers.rows.some(worker => worker.flexpedia_id !== null)) {
    throw new FlexpediaSyncError('Flexpedia returned an empty employee snapshot; synchronization was stopped and no employee data was changed.')
  }

  const summary: FlexpediaSyncSummary = {
    employeesAdded: 0,
    employeesUpdated: 0,
  }
  const workerById = new Map(workers.rows.map(worker => [worker.id, worker]))
  const matches = workers.rows.map(worker => ({
    id: worker.id,
    fullName: worker.full_name,
    flexpediaId: worker.flexpedia_id,
  }))

  for (const employee of employees) {
    const match = resolveFlexpediaWorkerMatch(employee, matches)
    if (match.kind === 'ambiguous') {
      throw new FlexpediaSyncError('A Flexpedia employee matches multiple local workers by name; resolve the identity before syncing.')
    }
    if (match.kind === 'identity-conflict') {
      throw new FlexpediaSyncError('A Flexpedia employee name belongs to a worker linked to a different Flexpedia ID.')
    }

    const fullName = flexpediaEmployeeName(employee)
    const profile = flexpediaProfile(employee)
    const address = composeAddress(employee) || null
    const values = profileValues(profile)

    if (match.kind === 'new') {
      await db.query(`
        INSERT INTO worker (
          full_name, rating, recommend, is_active, is_fired,
          home_address, ${profileColumns}
        )
        VALUES ($1, 'new', FALSE, TRUE, FALSE, $20, $2, $3, $4, $5, $6,
          $7, $8::date, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [fullName, ...values, address])
      summary.employeesAdded++
      continue
    }

    const current = workerById.get(match.workerId)
    if (!current) throw new FlexpediaSyncError('A matched Flexpedia worker could not be loaded.')
    const merged = mergeFlexpediaProfile(profileFromRow(current), employee)
    const changed = merged.changedFields.length > 0
      || current.full_name !== fullName
      || current.flexpedia_id !== employee.id
      || current.home_address !== address
    if (changed) {
      await db.query(`
        UPDATE worker SET
          full_name = $1, ${profileAssignments}, home_address = $20
        WHERE id = $21
      `, [fullName, ...profileValues(merged.profile), address, current.id])
      summary.employeesUpdated++
    }
    current.full_name = fullName
    current.flexpedia_id = employee.id
    Object.assign(current, {
      flexpedia_initials: employee.initials,
      flexpedia_first_name: employee.firstname,
      flexpedia_insertion: employee.insertion,
      flexpedia_last_name: employee.lastname,
      flexpedia_gender: employee.gender,
      flexpedia_birth_date: employee.birthdate,
      flexpedia_street: employee.street,
      flexpedia_street_number: employee.streetNumber,
      flexpedia_street_number_addition: employee.streetNumberAddition,
      flexpedia_post_code: employee.postCode,
      flexpedia_city: employee.city,
      flexpedia_phone: employee.phone,
      flexpedia_phone_country: employee.phoneCountryISOCode,
      flexpedia_mobile: employee.mobile,
      flexpedia_email: employee.email,
      flexpedia_residence_country: employee.residenceCountryISOCode,
      flexpedia_nationality: employee.nationalityISOCode,
      home_address: address,
    })
    const existingMatch = matches.find(row => row.id === current.id)
    if (existingMatch) {
      existingMatch.fullName = fullName
      existingMatch.flexpediaId = employee.id
    }
  }

  return summary
}

export async function getFlexpediaSyncStatus(): Promise<FlexpediaSyncStatus> {
  return withDb(async db => {
    const { rows } = await db.query<{
      last_sync_at: Date | null
      last_summary: FlexpediaSyncSummary
      last_error: string | null
    }>(`
      SELECT last_sync_at, last_summary, last_error
      FROM flexpedia_sync_control
      WHERE singleton = TRUE
    `)
    const row = rows[0]
    if (!row) throw new FlexpediaSyncError('Flexpedia sync state is not initialized.')
    return {
      lastSyncAt: row.last_sync_at?.toISOString() ?? null,
      lastSummary: Object.keys(row.last_summary ?? {}).length ? row.last_summary : null,
      lastError: row.last_error,
    }
  })
}

export async function recordFlexpediaSyncFailure(message: string): Promise<void> {
  await withDb(async db => {
    await db.query(`
      UPDATE flexpedia_sync_control
      SET last_error = $1, updated_at = now()
      WHERE singleton = TRUE
    `, [message.slice(0, 250)])
  })
}

export async function syncFlexpediaEmployees(): Promise<FlexpediaSyncSummary> {
  const employees = await readFlexpediaEmployees()
  return withDb(async db => {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    try {
      const summary = await syncSnapshot(db, employees)
      await db.query(`
        UPDATE flexpedia_sync_control
        SET last_sync_at = now(), last_summary = $1::jsonb, last_error = NULL, updated_at = now()
        WHERE singleton = TRUE
      `, [JSON.stringify(summary)])
      await db.query('COMMIT')
      return summary
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
}

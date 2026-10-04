import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { WEEKDAYS, type RequirementKind, type SchedulePattern, type Weekday } from '@/lib/types'

const kinds: RequirementKind[] = ['skill', 'language', 'document', 'transport', 'availability']
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const isWeekday = (value: unknown): value is Weekday =>
  typeof value === 'string' && WEEKDAYS.includes(value as Weekday)
const validCount = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 500

function validSchedule(value: unknown): value is SchedulePattern {
  if (!isRecord(value) || !Array.isArray(value.weekdays) || !value.weekdays.every(isWeekday)
    || new Set(value.weekdays).size !== value.weekdays.length
    || !['day', 'week', 'month'].includes(String(value.horizon))
    || !isRecord(value.start) || !isRecord(value.end) || !isRecord(value.headcount)) return false
  const startValid = value.start.kind === 'none'
    || value.start.kind === 'fixed' && isTime(value.start.time)
    || value.start.kind === 'perDate' && Array.isArray(value.start.options) && value.start.options.every(isTime)
    || value.start.kind === 'byWeekday' && isRecord(value.start.times)
      && Object.entries(value.start.times).every(([day, time]) => isWeekday(day) && isTime(time))
  const endValid = value.end.kind === 'open' || value.end.kind === 'perDate'
    || value.end.kind === 'fixed' && isTime(value.end.time)
    || value.end.kind === 'byWeekday' && isRecord(value.end.times)
      && Object.entries(value.end.times).every(([day, time]) => isWeekday(day) && isTime(time))
  const countValid = value.headcount.kind === 'fixed' && validCount(value.headcount.count)
    || value.headcount.kind === 'perDate' && validCount(value.headcount.typical)
    || value.headcount.kind === 'byWeekday' && isRecord(value.headcount.counts)
      && Object.entries(value.headcount.counts).every(([day, count]) => isWeekday(day) && validCount(count))
  return startValid && endValid && countValid
}

type PlaceInput = { id: string; name: string }
type RequirementInput = { kind: RequirementKind; label: string; required: boolean }

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { slug } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (!isRecord(body)) return NextResponse.json({ error: 'Invalid vacancy details.' }, { status: 400 })

  if (Object.keys(body).length === 1 && typeof body.archived === 'boolean') {
    try {
      const archived = body.archived
      const { rows } = await withDb(db => db.query<{ slug: string; archived_at: string | null }>(`
        UPDATE vacancy
        SET is_active = NOT $2,
            archived_at = CASE WHEN $2 THEN COALESCE(archived_at, now()) ELSE NULL END,
            updated_at = now()
        WHERE slug = $1
        RETURNING slug, archived_at::text AS archived_at
      `, [slug, archived]))
      const row = rows[0]
      if (!row) return NextResponse.json({ error: 'Vacancy not found.' }, { status: 404 })
      return NextResponse.json({ slug: row.slug, archivedAt: row.archived_at })
    } catch (error) {
      console.error('Failed to update vacancy archive status.', error)
      return NextResponse.json({ error: 'Could not update vacancy archive status.' }, { status: 500 })
    }
  }

  if (Object.keys(body).length === 1 && typeof body.requiresAvailableList === 'boolean') {
    const { rows } = await withDb(db => db.query<{ slug: string }>(`
      UPDATE vacancy
      SET schedule_pattern = jsonb_set(COALESCE(schedule_pattern, '{}'::jsonb),
          '{requiresAvailableList}', to_jsonb($2::boolean), true),
          updated_at = now()
      WHERE slug = $1
      RETURNING slug
    `, [slug, body.requiresAvailableList]))
    if (!rows[0]) return NextResponse.json({ error: 'Vacancy not found.' }, { status: 404 })
    return NextResponse.json({ slug: rows[0].slug, requiresAvailableList: body.requiresAvailableList })
  }

  const companyMatch = typeof body.companyId === 'string' ? body.companyId.match(/^c-([1-9]\d*)$/) : null
  const schedule = body.schedule
  const places = body.places
  const requirements = body.requirements
  const address = body.address
  const defaultHours = body.defaultHours
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200
    || !companyMatch || !Number.isSafeInteger(Number(companyMatch[1]))
    || typeof body.description !== 'string' || body.description.length > 10_000
    || !isDate(body.startDate) || body.endDate !== null && (!isDate(body.endDate) || body.endDate < body.startDate)
    || !validSchedule(schedule)
    || !Array.isArray(places) || places.length > 50
    || places.some(place => !isRecord(place) || typeof place.id !== 'string' || !place.id
      || typeof place.name !== 'string' || !place.name.trim() || place.name.trim().length > 200)
    || new Set(places.map(place => isRecord(place) ? place.id : '')).size !== places.length
    || !Array.isArray(requirements) || requirements.length > 30
    || requirements.some(item => !isRecord(item) || typeof item.kind !== 'string'
      || !kinds.includes(item.kind as RequirementKind) || typeof item.label !== 'string'
      || !item.label.trim() || item.label.length > 200 || typeof item.required !== 'boolean')
    || new Set(requirements.map(item => isRecord(item) && typeof item.kind === 'string' && typeof item.label === 'string'
      ? `${item.kind}\u0000${item.label.trim().toLowerCase()}` : '')).size !== requirements.length
    || typeof body.carOnly !== 'boolean' || typeof body.requiresAvailableList !== 'boolean'
    || typeof body.trackHoursManually !== 'boolean'
    || defaultHours !== null && (typeof defaultHours !== 'number' || !Number.isFinite(defaultHours) || defaultHours < 0 || defaultHours > 24)
    || body.projectCode !== null && (typeof body.projectCode !== 'string' || body.projectCode.length > 100)
    || address !== null && (!isRecord(address) || typeof address.label !== 'string'
      || !address.label.trim() || address.label.length > 500 || typeof address.lat !== 'number'
      || !Number.isFinite(address.lat) || address.lat < -90 || address.lat > 90
      || typeof address.lon !== 'number' || !Number.isFinite(address.lon) || address.lon < -180 || address.lon > 180)) {
    return NextResponse.json({ error: 'Some vacancy fields are invalid. Review the form and try again.' }, { status: 400 })
  }

  const normalizedPlaces = places as PlaceInput[]
  const normalizedRequirements = requirements as RequirementInput[]
  const title = (body.title as string).trim()
  try {
    const result = await withDb(async db => {
      await db.query('BEGIN')
      try {
        const current = await db.query<{
          id: number; slug: string; worksite_address: string | null; latitude: number | null; longitude: number | null
        }>(`
          SELECT id, slug, worksite_address, latitude, longitude
          FROM vacancy WHERE slug = $1 FOR UPDATE
        `, [slug])
        if (!current.rows[0]) {
          await db.query('ROLLBACK')
          return { status: 404 as const, error: 'Vacancy not found.' }
        }
        const company = await db.query<{ name: string }>('SELECT name FROM company WHERE id = $1', [Number(companyMatch[1])])
        if (!company.rows[0]) {
          await db.query('ROLLBACK')
          return { status: 400 as const, error: 'Select a company that exists.' }
        }
        const vacancy = current.rows[0]
        const siteRows = await db.query<{ slug: string; name: string }>(`
          SELECT s.slug, s.name FROM vacancy_site vs
          JOIN site s ON s.slug = vs.site_slug
          WHERE vs.vacancy_id = $1 FOR UPDATE OF s
        `, [vacancy.id])
        const currentSites = new Map(siteRows.rows.map(row => [row.slug, row]))
        const savedPlaces: Array<{ requestedId: string; id: string; name: string }> = []
        const retained = new Set<string>()
        const addressLabel = address === null ? vacancy.worksite_address : (address as { label: string }).label.trim()
        const latitude = address === null ? vacancy.latitude : (address as { lat: number }).lat
        const longitude = address === null ? vacancy.longitude : (address as { lon: number }).lon

        for (const [index, place] of normalizedPlaces.entries()) {
          if (currentSites.has(place.id)) {
            retained.add(place.id)
            await db.query(`
              UPDATE site SET name = $2, address = $3, company = $4, company_id = $5
              WHERE slug = $1
            `, [place.id, place.name.trim(), addressLabel ?? '', company.rows[0].name, Number(companyMatch[1])])
            savedPlaces.push({ requestedId: place.id, id: place.id, name: place.name.trim() })
          } else {
            const siteSlug = `${slug}-${randomUUID()}`
            await db.query(`
              INSERT INTO site (slug, name, company, address, company_id)
              VALUES ($1, $2, $3, $4, $5)
            `, [siteSlug, place.name.trim(), company.rows[0].name, addressLabel ?? '', Number(companyMatch[1])])
            await db.query('INSERT INTO vacancy_site (vacancy_id, site_slug) VALUES ($1, $2)', [vacancy.id, siteSlug])
            retained.add(siteSlug)
            savedPlaces.push({ requestedId: place.id, id: siteSlug, name: place.name.trim() })
          }
        }
        for (const [siteSlug] of currentSites) {
          if (retained.has(siteSlug)) continue
          const referenced = await db.query<{ used: boolean }>(`
            SELECT EXISTS (SELECT 1 FROM shift WHERE vacancy_id = $1 AND site_slug = $2)
                OR EXISTS (SELECT 1 FROM vacancy_demand WHERE vacancy_id = $1 AND site_slug = $2) AS used
          `, [vacancy.id, siteSlug])
          if (referenced.rows[0].used) {
            await db.query('ROLLBACK')
            return { status: 409 as const, error: `Cannot remove ${currentSites.get(siteSlug)?.name}; it has schedule history.` }
          }
          await db.query('DELETE FROM vacancy_site WHERE vacancy_id = $1 AND site_slug = $2', [vacancy.id, siteSlug])
          await db.query('DELETE FROM site WHERE slug = $1', [siteSlug])
        }

        const normalizedSchedule = {
          ...schedule,
          requiresAvailableList: body.requiresAvailableList,
        }
        await db.query(`
          UPDATE vacancy SET title = $2, company_id = $3, description = $4,
            worksite_address = $5, latitude = $6, longitude = $7,
            start_date = $8::date, end_date = $9::date, schedule_pattern = $10::jsonb,
            track_hours_manually = $11, car_only = $12,
            default_hours = $13, project_code = $14, updated_at = now()
          WHERE id = $1
        `, [
          vacancy.id, title, Number(companyMatch[1]), body.description,
          addressLabel, latitude, longitude, body.startDate, body.endDate,
          JSON.stringify(normalizedSchedule), body.trackHoursManually, body.carOnly,
          body.trackHoursManually ? defaultHours : null,
          body.trackHoursManually && typeof body.projectCode === 'string' ? body.projectCode.trim() || null : null,
        ])
        const existingRequirements = await db.query<{
          id: number; kind: RequirementKind; label: string; is_required: boolean
        }>(`
          SELECT id, kind, label, is_required FROM vacancy_requirement
          WHERE vacancy_id = $1 FOR UPDATE
        `, [vacancy.id])
        const retainedRequirements = new Set<number>()
        for (const requirement of normalizedRequirements) {
          const existing = existingRequirements.rows.find(row =>
            row.kind === requirement.kind && row.label.toLowerCase() === requirement.label.trim().toLowerCase())
          if (existing) {
            retainedRequirements.add(existing.id)
            await db.query('UPDATE vacancy_requirement SET label = $2, is_required = $3 WHERE id = $1', [
              existing.id, requirement.label.trim(), requirement.required,
            ])
            continue
          }
          await db.query(`
            INSERT INTO vacancy_requirement (vacancy_id, kind, label, is_required)
            VALUES ($1, $2, $3, $4)
          `, [vacancy.id, requirement.kind, requirement.label.trim(), requirement.required])
        }
        for (const requirement of existingRequirements.rows) {
          if (!retainedRequirements.has(requirement.id)) {
            await db.query('DELETE FROM vacancy_requirement WHERE id = $1', [requirement.id])
          }
        }
        await db.query('COMMIT')
        return { status: 200 as const, slug: vacancy.slug, places: savedPlaces }
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ slug: result.slug, places: result.places })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'A site or requirement conflicts with an existing record.' }, { status: 409 })
    }
    console.error('Failed to update vacancy.', error)
    return NextResponse.json({ error: 'Could not save vacancy changes.' }, { status: 500 })
  }
}

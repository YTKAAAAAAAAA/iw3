import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { WEEKDAYS, type RequirementKind, type Weekday } from '@/lib/types'

const REQUIREMENT_KINDS: RequirementKind[] = ['skill', 'language', 'document', 'transport', 'availability']
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export async function POST(request: Request) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (!isRecord(body)) return NextResponse.json({ error: 'Invalid vacancy data.' }, { status: 400 })

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const companyMatch = typeof body.companyId === 'string' ? body.companyId.match(/^c-([1-9]\d*)$/) : null
  const startDate = body.startDate
  const endDate = body.endDate
  const requiresAvailableList = body.requiresAvailableList
  const address = isRecord(body.address) ? body.address : null
  const weekdays = body.weekdays
  const places = body.places
  const requirements = body.requirements
  const timing = body.timing
  const start = body.start
  const end = body.end
  const headcount = body.headcount
  const defaultHours = body.defaultHours
  const projectCode = body.projectCode
  const addressLabel = address && typeof address.label === 'string' ? address.label.trim() : ''
  const latitude = address && typeof address.lat === 'number' ? address.lat : Number.NaN
  const longitude = address && typeof address.lon === 'number' ? address.lon : Number.NaN

  if (!title || title.length > 200) return NextResponse.json({ error: 'Enter a vacancy title (up to 200 characters).' }, { status: 400 })
  if (!companyMatch) return NextResponse.json({ error: 'Select a valid company.' }, { status: 400 })
  if (!validDate(startDate) || (endDate !== null && !validDate(endDate)) || (typeof endDate === 'string' && endDate < startDate)) {
    return NextResponse.json({ error: 'Enter a valid vacancy period.' }, { status: 400 })
  }
  if (!address || !addressLabel || addressLabel.length > 500
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Choose a site address or enter valid coordinates.' }, { status: 400 })
  }
  if (typeof body.carOnly !== 'boolean' || typeof body.trackHoursManually !== 'boolean'
    || typeof requiresAvailableList !== 'boolean' || typeof description !== 'string' || description.length > 10_000) {
    return NextResponse.json({ error: 'Some vacancy details are invalid.' }, { status: 400 })
  }
  if (!Array.isArray(weekdays) || weekdays.some(day => typeof day !== 'string' || !WEEKDAYS.includes(day as Weekday))
    || new Set(weekdays).size !== weekdays.length) {
    return NextResponse.json({ error: 'Select valid working days.' }, { status: 400 })
  }
  if (typeof headcount !== 'number' || !Number.isInteger(headcount) || headcount < 0 || headcount > 500) {
    return NextResponse.json({ error: 'People per day must be between 0 and 500.' }, { status: 400 })
  }
  if (!['window', 'start', 'none'].includes(String(timing))
    || (timing !== 'none' && !validTime(start))
    || (timing === 'window' && !validTime(end))) {
    return NextResponse.json({ error: 'Enter valid working times.' }, { status: 400 })
  }
  if (defaultHours !== null && (typeof defaultHours !== 'number' || !Number.isFinite(defaultHours) || defaultHours < 0 || defaultHours > 24)) {
    return NextResponse.json({ error: 'Default hours must be between 0 and 24.' }, { status: 400 })
  }
  if (projectCode !== null && (typeof projectCode !== 'string' || projectCode.length > 100)) {
    return NextResponse.json({ error: 'Project code must be at most 100 characters.' }, { status: 400 })
  }
  if (!Array.isArray(places) || places.length > 50
    || places.some(place => !isRecord(place) || typeof place.name !== 'string' || !place.name.trim() || place.name.length > 200)) {
    return NextResponse.json({ error: 'Site places must have names of at most 200 characters.' }, { status: 400 })
  }
  if (!Array.isArray(requirements) || requirements.length > 30
    || requirements.some(requirement => !isRecord(requirement)
      || typeof requirement.label !== 'string' || !requirement.label.trim() || requirement.label.length > 200
      || typeof requirement.kind !== 'string' || !REQUIREMENT_KINDS.includes(requirement.kind as RequirementKind)
      || typeof requirement.required !== 'boolean')) {
    return NextResponse.json({ error: 'Vacancy requirements are invalid.' }, { status: 400 })
  }

  const companyId = Number(companyMatch[1])
  const schedulePattern = {
    weekdays,
    start: timing === 'none' ? { kind: 'none' } : { kind: 'fixed', time: start },
    end: timing === 'window' ? { kind: 'fixed', time: end } : { kind: 'open' },
    headcount: { kind: 'fixed', count: headcount },
    horizon: 'day',
    requiresAvailableList,
  }
  const slugBase = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'vacancy'
  const slug = `${slugBase}-${crypto.randomUUID()}`

  try {
    const result = await withDb(async db => {
      await db.query('BEGIN')
      try {
        const company = await db.query<{ name: string }>(
          'SELECT name FROM company WHERE id = $1 AND archived_at IS NULL', [companyId],
        )
        if (!company.rows[0]) {
          await db.query('ROLLBACK')
          return null
        }
        const inserted = await db.query<{ id: number; slug: string }>(`
          INSERT INTO vacancy
            (slug, title, company_id, description, worksite_address, latitude, longitude,
             start_date, end_date, schedule_pattern, track_hours_manually, car_only,
             default_hours, project_code)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10::jsonb, $11, $12, $13, $14)
          RETURNING id, slug
        `, [
          slug, title, companyId, description, addressLabel, latitude, longitude,
          startDate, endDate, JSON.stringify(schedulePattern), body.trackHoursManually,
          body.carOnly, body.trackHoursManually ? defaultHours : null,
          body.trackHoursManually && typeof projectCode === 'string' ? projectCode.trim() || null : null,
        ])
        const vacancy = inserted.rows[0]
        const placeNames = places.length ? places.map(place => (place as { name: string }).name.trim()) : [title]
        for (const [index, name] of placeNames.entries()) {
          const siteSlug = `${slug}-${index + 1}`
          await db.query(`
            INSERT INTO site (slug, name, company, address, company_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [siteSlug, name, company.rows[0].name, addressLabel, companyId])
          await db.query('INSERT INTO vacancy_site (vacancy_id, site_slug) VALUES ($1, $2)', [vacancy.id, siteSlug])
        }
        for (const requirement of requirements as Array<{ kind: RequirementKind; label: string; required: boolean }>) {
          await db.query(`
            INSERT INTO vacancy_requirement (vacancy_id, kind, label, is_required)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (vacancy_id, kind, label) DO NOTHING
          `, [vacancy.id, requirement.kind, requirement.label.trim(), requirement.required])
        }
        await db.query('COMMIT')
        return vacancy
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    if (!result) return NextResponse.json({ error: 'The selected company no longer exists.' }, { status: 400 })
    return NextResponse.json({ vacancy: result }, { status: 201 })
  } catch (error) {
    console.error('Failed to create vacancy.', error)
    return NextResponse.json({ error: 'Could not save the vacancy. Please try again.' }, { status: 500 })
  }
}

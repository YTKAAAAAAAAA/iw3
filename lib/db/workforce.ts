import 'server-only'
import type { PoolClient } from 'pg'
import { assertSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { normalizeAddress } from '@/lib/travel/address'
import { companyLogoUrl } from '@/lib/company-logo'
import {
  addDays,
  initialsFor,
  WEEKDAYS,
  type Company,
  type Demand,
  type HomeArea,
  type HoursEntry,
  type Leave,
  type PersonalDetails,
  type RequirementKind,
  type RosterEntry,
  type StandingAssignment,
  type SyncStatus,
  type TravelDistance,
  type Vacancy,
  type Worker,
} from '@/lib/types'
import type { CandidateVisibility, WorkforceData, WorkforceScope } from '@/components/workforce-data-context'

type ShiftRow = {
  id: number
  date: string
  worker_id: number | null
  site_slug: string
  vacancy_slug: string
  section: string | null
  hours: string
  is_extra: boolean
}

/* Home coordinates are rounded to two decimals — about a kilometre — before
   they leave the server. The map needs the neighbourhood, not the house. */
const roundToArea = (value: number) => Math.round(value * 100) / 100

async function loadWorkers(db: PoolClient): Promise<Worker[]> {
  const [workerResult, accessResult, courseResult, qualificationResult] = await Promise.all([
    db.query<{
      id: number
      full_name: string
      fixed_course_days: string | null
      is_active: boolean
      is_fired: boolean
      flexpedia_id: number | null
      flexpedia_initials: string | null
      flexpedia_first_name: string | null
      flexpedia_insertion: string | null
      flexpedia_last_name: string | null
      flexpedia_city: string | null
      dismissed_at: string | null
    }>(`
      SELECT id, full_name, fixed_course_days, is_active, is_fired, flexpedia_id,
        flexpedia_initials, flexpedia_first_name, flexpedia_insertion, flexpedia_last_name,
        flexpedia_city, dismissed_at::text
      FROM worker ORDER BY id
    `),
    db.query<{ worker_id: number; company_id: number }>(
      `SELECT a.worker_id, a.company_id FROM worker_company_access a
       JOIN company c ON c.id = a.company_id AND c.archived_at IS NULL
       ORDER BY a.worker_id, a.company_id`,
    ),
    db.query<{ worker_id: number; weekday: Worker['courseDays'][number] }>(
      'SELECT worker_id, weekday FROM worker_course_day ORDER BY worker_id, weekday',
    ),
    db.query<{ worker_id: number; kind: string; label: string; status: string }>(`
      SELECT worker_id, kind, label, status FROM worker_qualification
      WHERE (kind = 'transport' AND label = 'Own car')
         OR (kind = 'document' AND label = 'VOG on file')
    `),
  ])

  const access = new Map<number, string[]>()
  for (const row of accessResult.rows)
    access.set(row.worker_id, [...(access.get(row.worker_id) ?? []), `c-${row.company_id}`])
  const courseDays = new Map<number, Worker['courseDays']>()
  for (const row of courseResult.rows)
    courseDays.set(row.worker_id, [...(courseDays.get(row.worker_id) ?? []), row.weekday])
  const qualifications = new Map<number, Map<string, boolean>>()
  for (const row of qualificationResult.rows) {
    const current = qualifications.get(row.worker_id) ?? new Map<string, boolean>()
    current.set(`${row.kind}:${row.label}`, row.status === 'verified')
    qualifications.set(row.worker_id, current)
  }

  return workerResult.rows.map(worker => {
    const parts = worker.full_name.trim().split(/\s+/)
    const legacyCourseDays = (worker.fixed_course_days ?? '')
      .split(',')
      .map(day => day.trim().slice(0, 3).toLowerCase())
      .filter((day): day is Worker['courseDays'][number] =>
        WEEKDAYS.includes(day as Worker['courseDays'][number]),
      )
    return {
      id: String(worker.id),
      flexpediaId: worker.flexpedia_id,
      initials: worker.flexpedia_initials ?? initialsFor(worker.full_name),
      firstName: worker.flexpedia_first_name ?? parts[0] ?? '',
      insertion:
        worker.flexpedia_insertion ??
        (worker.flexpedia_id !== null ? null : parts.length > 2 ? parts.slice(1, -1).join(' ') : null),
      lastName: worker.flexpedia_last_name ?? (parts.length > 1 ? parts[parts.length - 1] : ''),
      fullName: worker.full_name,
      city: worker.flexpedia_city,
      hasCar: qualifications.get(worker.id)?.get('transport:Own car') ?? null,
      hasVog: qualifications.get(worker.id)?.get('document:VOG on file') ?? null,
      courseDays: courseDays.get(worker.id) ?? legacyCourseDays,
      status: worker.is_active && !worker.is_fired ? 'active' : 'dismissed',
      dismissedAt: worker.dismissed_at,
      companyAccess: access.get(worker.id) ?? [],
    }
  })
}

async function loadCompaniesAndVacancies(
  db: PoolClient,
): Promise<{ companies: Company[]; vacancies: Vacancy[] }> {
  const [companyResult, vacancyResult, siteResult, requirementResult] = await Promise.all([
    db.query<{
      id: number
      name: string
      contact_person: string | null
      phone: string | null
      notes: string | null
      logo_url: string | null
      archived_at: string | null
      logo_key: string | null
    }>(`
      SELECT id, name, contact_person, phone, notes, logo_url, archived_at::text AS archived_at, logo_key
      FROM company ORDER BY name, id
    `),
    db.query<{
      id: number
      slug: string
      title: string
      company_id: number
      description: string
      worksite_address: string | null
      latitude: number | null
      longitude: number | null
      start_date: string
      end_date: string | null
      track_hours_manually: boolean
      archived_at: string | null
      car_only: boolean
      default_hours: string | null
      project_code: string | null
      schedule_pattern: (Vacancy['schedule'] & { requiresAvailableList?: boolean }) | null
    }>(`
      SELECT v.id, v.slug, v.title, v.company_id, v.description, v.worksite_address,
        v.latitude, v.longitude,
        COALESCE(v.start_date, (SELECT min(sh.date) FROM shift sh WHERE sh.vacancy_id = v.id), CURRENT_DATE)::text AS start_date,
        v.end_date::text AS end_date, v.track_hours_manually, v.archived_at::text AS archived_at,
        v.car_only, v.default_hours::text AS default_hours, v.project_code, v.schedule_pattern
      FROM vacancy v
      ORDER BY (v.slug = 'warehouse') DESC, v.id
    `),
    db.query<{ vacancy_id: number; slug: string; name: string; address: string }>(`
      SELECT vs.vacancy_id, s.slug, s.name, s.address
      FROM vacancy_site vs JOIN site s ON s.slug = vs.site_slug
      ORDER BY vs.vacancy_id, s.name
    `),
    db.query<{ id: number; vacancy_id: number; kind: RequirementKind; label: string; is_required: boolean }>(
      'SELECT id, vacancy_id, kind, label, is_required FROM vacancy_requirement ORDER BY id',
    ),
  ])

  const companies = companyResult.rows.map(company => ({
    id: `c-${company.id}`,
    name: company.name,
    contactPerson: company.contact_person,
    phone: company.phone,
    notes: company.notes,
    logoUrl: companyLogoUrl(company.id, company.logo_key, company.logo_url),
    archivedAt: company.archived_at,
  }))
  const vacancies = vacancyResult.rows.map((row): Vacancy => {
    const pattern = row.schedule_pattern
    const sites = siteResult.rows.filter(site => site.vacancy_id === row.id)
    return {
      id: row.slug,
      title: row.title,
      companyId: `c-${row.company_id}`,
      address: row.worksite_address ?? sites[0]?.address ?? '',
      lat: row.latitude,
      lon: row.longitude,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      archivedAt: row.archived_at,
      trackHoursManually: row.track_hours_manually,
      schedule: pattern ?? {
        weekdays: [],
        start: { kind: 'none' },
        end: { kind: 'open' },
        headcount: { kind: 'perDate', typical: 1 },
        horizon: 'day',
      },
      places: sites.map(site => ({ id: site.slug, name: site.name })),
      carOnly: row.car_only,
      requiresAvailableList: pattern?.requiresAvailableList === true,
      defaultHours: row.default_hours === null ? null : Number(row.default_hours),
      projectCode: row.project_code,
      requirements: requirementResult.rows
        .filter(requirement => requirement.vacancy_id === row.id)
        .map(requirement => ({
          id: String(requirement.id),
          kind: requirement.kind,
          label: requirement.label,
          required: requirement.is_required,
        })),
    }
  })
  return { companies, vacancies }
}

async function loadSyncStatus(db: PoolClient): Promise<SyncStatus[]> {
  const [warehouse, flexpedia] = await Promise.all([
    db.query<{ supabase_enabled: boolean; last_sync_at: Date | null; last_error: string | null }>(
      'SELECT supabase_enabled, last_sync_at, last_error FROM warehouse_sync_control WHERE singleton = TRUE',
    ),
    db.query<{ last_sync_at: Date | null; last_error: string | null }>(
      'SELECT last_sync_at, last_error FROM flexpedia_sync_control WHERE singleton = TRUE',
    ),
  ])
  return [
    {
      source: 'supabase',
      configured: Boolean(process.env.SUPABASE_DATABASE_URL),
      enabled: warehouse.rows[0]?.supabase_enabled ?? false,
      lastSyncAt: warehouse.rows[0]?.last_sync_at?.toISOString() ?? null,
      lastError: warehouse.rows[0]?.last_error ?? null,
    },
    {
      source: 'flexpedia',
      configured: Boolean(process.env.FLEXPEDIA_API_TOKEN),
      enabled: true,
      lastSyncAt: flexpedia.rows[0]?.last_sync_at?.toISOString() ?? null,
      lastError: flexpedia.rows[0]?.last_error ?? null,
    },
  ]
}

async function loadShifts(db: PoolClient): Promise<ShiftRow[]> {
  const { rows } = await db.query<ShiftRow>(`
    SELECT sh.id, sh.date::text AS date, sh.worker_id, sh.site_slug, v.slug AS vacancy_slug,
      sh.section, sh.hours::text AS hours, sh.is_extra
    FROM shift sh JOIN vacancy v ON v.id = sh.vacancy_id
    WHERE sh.confirmation_status IS DISTINCT FROM 'cancelled'
    ORDER BY sh.date, sh.site_slug, sh.section NULLS FIRST, sh.schedule_position, sh.id
  `)
  return rows
}

async function loadSchedule(db: PoolClient, shifts: ShiftRow[]) {
  const [demandResult, standingResult, visibilityResult] = await Promise.all([
    db.query<{
      id: number
      vacancy_slug: string
      date: string
      place_id: string | null
      section: string | null
      headcount: number
      start: string | null
      end: string | null
      note: string | null
    }>(`
      SELECT d.id, v.slug AS vacancy_slug, d.date::text AS date, d.site_slug AS place_id,
        d.section, d.headcount, to_char(d.start_time, 'HH24:MI') AS start,
        to_char(d.end_time, 'HH24:MI') AS end, d.note
      FROM vacancy_demand d JOIN vacancy v ON v.id = d.vacancy_id
      ORDER BY d.date, d.id
    `),
    db.query<{ standing: StandingAssignment[] }>('SELECT standing FROM vacancy_schedule_state'),
    db.query<{
      vacancy_slug: string
      details: { worker_id?: string; date?: string | null; hidden?: boolean; reset?: boolean }
    }>(`
      SELECT v.slug AS vacancy_slug, vc.details
      FROM vacancy_change vc JOIN vacancy v ON v.id = vc.vacancy_id
      WHERE vc.event_type = 'candidate_visibility'
      ORDER BY vc.id
    `),
  ])

  const roster: RosterEntry[] = shifts.map(shift => ({
    id: String(shift.id),
    vacancyId: shift.vacancy_slug,
    date: shift.date,
    placeId: shift.site_slug,
    section: shift.section,
    workerId: shift.worker_id === null ? null : String(shift.worker_id),
    extra: shift.is_extra,
    extraReason: null,
    standingId: null,
    start: null,
    end: null,
    outcome: 'planned',
    actualEnd: null,
    coversShiftId: null,
    note: null,
  }))

  const demand: Demand[] = demandResult.rows.map(slot => ({
    id: String(slot.id),
    vacancyId: slot.vacancy_slug,
    date: slot.date,
    placeId: slot.place_id,
    section: slot.section,
    headcount: slot.headcount,
    start: slot.start,
    end: slot.end,
    note: slot.note,
  }))
  /* Days the client ordered nothing explicit for are inferred from who was
     scheduled, one slot per site and section. */
  const explicitByDay = new Map<string, Demand[]>()
  for (const slot of demand) {
    const key = `${slot.vacancyId}\u0000${slot.date}`
    explicitByDay.set(key, [...(explicitByDay.get(key) ?? []), slot])
  }
  const inferred = new Map<string, Omit<Demand, 'id' | 'start' | 'end' | 'note'>>()
  for (const shift of shifts) {
    const covered = (explicitByDay.get(`${shift.vacancy_slug}\u0000${shift.date}`) ?? []).some(
      slot =>
        (slot.placeId === null || slot.placeId === shift.site_slug) &&
        (slot.section === null || slot.section === shift.section),
    )
    if (covered) continue
    const key = [shift.vacancy_slug, shift.date, shift.site_slug, shift.section ?? ''].join('\u0000')
    const slot = inferred.get(key)
    if (slot) slot.headcount += 1
    else
      inferred.set(key, {
        vacancyId: shift.vacancy_slug,
        date: shift.date,
        placeId: shift.site_slug,
        section: shift.section,
        headcount: 1,
      })
  }
  ;[...inferred.values()].forEach((slot, index) =>
    demand.push({
      ...slot,
      id: `derived-${slot.vacancyId}-${slot.date}-${index}`,
      start: null,
      end: null,
      note: null,
    }),
  )

  const visibility = new Map<string, CandidateVisibility>()
  for (const event of visibilityResult.rows) {
    const workerId = event.details.worker_id
    if (!workerId || typeof event.details.hidden !== 'boolean') continue
    const scope = `${event.vacancy_slug}\u0000${workerId}\u0000`
    if (event.details.reset) {
      for (const key of visibility.keys()) if (key.startsWith(scope)) visibility.delete(key)
      visibility.set(`${scope}*`, { vacancyId: event.vacancy_slug, workerId, date: null, hidden: false })
      continue
    }
    const date = event.details.date ?? null
    visibility.set(`${scope}${date ?? '*'}`, {
      vacancyId: event.vacancy_slug,
      workerId,
      date,
      hidden: event.details.hidden,
    })
  }

  return {
    roster,
    demand,
    standing: standingResult.rows.flatMap(row => (Array.isArray(row.standing) ? row.standing : [])),
    candidateVisibility: [...visibility.values()],
  }
}

async function loadLeaves(db: PoolClient): Promise<Leave[]> {
  const { rows } = await db.query<{
    id: number
    worker_id: number
    start_date: string
    end_date: string
    reason: string | null
  }>(`
    SELECT id, worker_id, start_date::text AS start_date, end_date::text AS end_date, reason
    FROM absence ORDER BY start_date, id
  `)
  const leaves: Leave[] = []
  for (const absence of rows) {
    for (let date = absence.start_date; date <= absence.end_date; date = addDays(date, 1)) {
      leaves.push({
        id: `absence-${absence.id}-${date}`,
        workerId: String(absence.worker_id),
        date,
        reason: absence.reason?.replace(/^(?:Paid|Unpaid) leave: /, '') || 'Unavailable',
        paidLeave:
          /^Paid leave: /.test(absence.reason ?? '') || /vacation|holiday/i.test(absence.reason ?? ''),
      })
    }
  }
  return leaves
}

async function loadHours(db: PoolClient, shifts: ShiftRow[]): Promise<HoursEntry[]> {
  const { rows } = await db.query<{
    id: string
    worker_id: number
    vacancy_slug: string
    date: string
    hours: string
  }>(`
    SELECT mh.id::text, mh.worker_id, v.slug AS vacancy_slug, mh.date::text AS date, mh.hours::text AS hours
    FROM manual_hours mh JOIN vacancy v ON v.id = mh.vacancy_id
    ORDER BY mh.date, mh.id
  `)
  return shifts
    .flatMap(shift =>
      shift.worker_id === null
        ? []
        : [
            {
              id: String(shift.id),
              workerId: String(shift.worker_id),
              vacancyId: shift.vacancy_slug,
              date: shift.date,
              hours: Number(shift.hours),
            },
          ],
    )
    .concat(
      rows.map(entry => ({
        id: `manual-${entry.id}`,
        workerId: String(entry.worker_id),
        vacancyId: entry.vacancy_slug,
        date: entry.date,
        hours: Number(entry.hours),
        manual: true,
      })),
    )
}

async function loadTravel(db: PoolClient): Promise<{ travel: TravelDistance[]; homeAreas: HomeArea[] }> {
  const [distanceResult, homeResult] = await Promise.all([
    db.query<{
      worker_id: number
      vacancy_slug: string
      km: string
      minutes: number
      computed_at: Date
      profile: string
    }>(`
      SELECT t.worker_id, v.slug AS vacancy_slug, t.km::text AS km, t.minutes, t.computed_at, t.profile
      FROM travel_distances t JOIN vacancy v ON v.id = t.vacancy_id
      WHERE t.valid_to IS NULL
    `),
    db.query<{ id: number; home_address: string }>(`
      SELECT id, home_address FROM worker
      WHERE home_address IS NOT NULL AND is_active AND NOT is_fired
    `),
  ])
  const geocoded = homeResult.rows.length
    ? await db.query<{ address_norm: string; lat: number; lon: number }>(
        'SELECT address_norm, lat, lon FROM geocode_cache WHERE resolved AND address_norm = ANY($1::text[])',
        [homeResult.rows.map(row => normalizeAddress(row.home_address))],
      )
    : { rows: [] }
  const byAddress = new Map(geocoded.rows.map(row => [row.address_norm, row]))
  return {
    travel: distanceResult.rows.map(row => ({
      workerId: String(row.worker_id),
      vacancyId: row.vacancy_slug,
      km: Number(row.km),
      minutes: row.minutes,
      computedAt: row.computed_at.toISOString(),
      profile: row.profile,
    })),
    homeAreas: homeResult.rows.flatMap(row => {
      const point = byAddress.get(normalizeAddress(row.home_address))
      return point
        ? [{ workerId: String(row.id), lat: roundToArea(point.lat), lon: roundToArea(point.lon) }]
        : []
    }),
  }
}

async function loadPersonalDetails(db: PoolClient, workerId: string): Promise<PersonalDetails | null> {
  const { rows } = await db.query<{
    gender: 'm' | 'f' | null
    birth_date: string | null
    street: string | null
    street_number: string | null
    street_number_addition: string | null
    post_code: string | null
    residence_country: string | null
    nationality: string | null
    phone: string | null
    phone_country: string | null
    mobile: string | null
    email: string | null
    notes: string | null
  }>(
    `
    SELECT flexpedia_gender AS gender, flexpedia_birth_date::text AS birth_date,
      flexpedia_street AS street, flexpedia_street_number AS street_number,
      flexpedia_street_number_addition AS street_number_addition, flexpedia_post_code AS post_code,
      flexpedia_residence_country AS residence_country, flexpedia_nationality AS nationality,
      flexpedia_phone AS phone, flexpedia_phone_country AS phone_country, flexpedia_mobile AS mobile,
      flexpedia_email AS email, notes
    FROM worker WHERE id = $1
  `,
    [Number(workerId)],
  )
  const row = rows[0]
  if (!row) return null
  return {
    workerId,
    gender: row.gender,
    birthDate: row.birth_date,
    street: row.street,
    streetNumber: row.street_number,
    streetNumberAddition: row.street_number_addition,
    postCode: row.post_code,
    residenceCountry: row.residence_country,
    nationality: row.nationality,
    phone: row.phone,
    phoneCountry: row.phone_country,
    mobile: row.mobile,
    email: row.email,
    notes: row.notes ?? '',
  }
}

/** The data one page needs: always people, companies, vacancies and sync
 *  status; schedule history, leave, hours, travel and one person's contact
 *  details only when the scope asks for them. */
export async function loadWorkforceData(scope: WorkforceScope = {}): Promise<WorkforceData> {
  await assertSession()
  const include = new Set(scope.include ?? [])
  return withDb(async db => {
    const workers = await loadWorkers(db)
    const { companies, vacancies } = await loadCompaniesAndVacancies(db)
    const sync = await loadSyncStatus(db)
    const shifts = include.has('schedule') || include.has('hours') ? await loadShifts(db) : []
    const schedule = include.has('schedule')
      ? await loadSchedule(db, shifts)
      : { roster: [], demand: [], standing: [], candidateVisibility: [] }
    const leaves = include.has('leaves') ? await loadLeaves(db) : []
    const hours = include.has('hours') ? await loadHours(db, shifts) : []
    const { travel, homeAreas } = include.has('travel') ? await loadTravel(db) : { travel: [], homeAreas: [] }
    const personalDetails =
      scope.personalDetailsFor && /^[1-9]\d{0,9}$/.test(scope.personalDetailsFor)
        ? await loadPersonalDetails(db, scope.personalDetailsFor)
        : null
    return {
      workers,
      companies,
      vacancies,
      sync,
      ...schedule,
      offers: [],
      leaves,
      hours,
      travel,
      homeAreas,
      personalDetails,
    }
  })
}

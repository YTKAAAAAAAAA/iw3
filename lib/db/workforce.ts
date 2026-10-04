import 'server-only'
import { assertSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { addDays, initialsFor, WEEKDAYS, type AppData, type Company, type Demand, type HoursEntry, type Leave, type Offer, type RequirementKind, type RosterEntry, type StandingAssignment, type Vacancy, type Worker } from '@/lib/types'
import type { CandidateVisibility, WorkforceData } from '@/components/workforce-data-context'
import type {
  WarehouseAbsence,
  WarehouseOverviewData,
  WarehousePerson,
  WarehousePersonProfile,
  WarehouseShift,
  WarehouseSite,
  WarehouseVacancy,
} from './workforce-types'

type WorkerRow = {
  id: number
  full_name: string
  preferred_site: string | null
  preferred_site_name: string | null
  rating: WarehousePerson['rating']
  cc: string | null
  fixed_course_days: string | null
  is_active: boolean
  is_fired: boolean
  recommend: boolean
}

type ShiftRow = {
  id: number
  date: string
  worker_id: number | null
  worker_name: string | null
  site_slug: string
  site_name: string
  section: string | null
  hours: string
  is_extra: boolean
}

type AbsenceRow = {
  id: number
  worker_id: number
  worker_name: string
  start_date: string
  end_date: string
  reason: string | null
}

const toPerson = (row: WorkerRow): WarehousePerson => ({
  id: row.id,
  fullName: row.full_name,
  preferredSite: row.preferred_site,
  preferredSiteName: row.preferred_site_name,
  rating: row.rating,
  language: row.cc,
  fixedCourseDays: row.fixed_course_days,
  isActive: row.is_active,
  isFired: row.is_fired,
  recommended: row.recommend,
})

const toShift = (row: ShiftRow): WarehouseShift => ({
  id: row.id,
  date: row.date,
  workerId: row.worker_id,
  workerName: row.worker_name,
  siteSlug: row.site_slug,
  siteName: row.site_name,
  section: row.section,
  hours: Number(row.hours),
  isExtra: row.is_extra,
})

const toAbsence = (row: AbsenceRow): WarehouseAbsence => ({
  id: row.id,
  workerId: row.worker_id,
  workerName: row.worker_name,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason,
})

async function requireDispatcher() {
  await assertSession()
}

export async function getWarehouseOverview(): Promise<WarehouseOverviewData> {
  await requireDispatcher()
  return withDb(async db => {
    const summary = await db.query<{
      today: string
      active_people: number
      total_people: number
      total_shifts: number
    }>(`
      SELECT
        current_date::text AS today,
        (SELECT count(*)::int FROM worker WHERE is_active AND NOT is_fired) AS active_people,
        (SELECT count(*)::int FROM worker) AS total_people,
        (SELECT count(*)::int FROM shift sh JOIN vacancy v ON v.id = sh.vacancy_id WHERE v.slug = 'warehouse') AS total_shifts
    `)
    const { today, active_people, total_people, total_shifts } = summary.rows[0]
    const shifts = await db.query<ShiftRow>(`
      SELECT sh.id, sh.date::text AS date, sh.worker_id,
        w.full_name AS worker_name, sh.site_slug, s.name AS site_name,
        sh.section, sh.hours::text AS hours, sh.is_extra
      FROM shift sh
      JOIN site s ON s.slug = sh.site_slug
      LEFT JOIN worker w ON w.id = sh.worker_id
      JOIN vacancy v ON v.id = sh.vacancy_id
      WHERE v.slug = 'warehouse' AND sh.date = $1::date
      ORDER BY s.name, sh.section NULLS FIRST, w.full_name NULLS LAST
    `, [today])
    const absences = await db.query<AbsenceRow>(`
      SELECT a.id, a.worker_id, w.full_name AS worker_name,
        a.start_date::text AS start_date, a.end_date::text AS end_date, a.reason
      FROM absence a
      JOIN worker w ON w.id = a.worker_id
      WHERE $1::date BETWEEN a.start_date AND a.end_date
      ORDER BY w.full_name
    `, [today])
    return {
      today,
      activePeople: active_people,
      totalPeople: total_people,
      totalShifts: total_shifts,
      shiftsToday: shifts.rows.map(toShift),
      absencesToday: absences.rows.map(toAbsence),
    }
  })
}

export async function getWarehousePeople(): Promise<WarehousePerson[]> {
  await requireDispatcher()
  return withDb(async db => {
    const { rows } = await db.query<WorkerRow>(`
      SELECT w.id, w.full_name, w.preferred_site, s.name AS preferred_site_name,
        w.rating, w.cc, w.fixed_course_days, w.is_active, w.is_fired, w.recommend
      FROM worker w
      LEFT JOIN site s ON s.slug = w.preferred_site
      ORDER BY w.is_active DESC, w.is_fired, w.full_name
    `)
    return rows.map(toPerson)
  })
}

export async function getWarehousePerson(id: number): Promise<WarehousePersonProfile | null> {
  await requireDispatcher()
  return withDb(async db => {
    const result = await db.query<WorkerRow & { phone: string | null; notes: string | null }>(`
      SELECT w.id, w.full_name, w.preferred_site, s.name AS preferred_site_name,
        w.rating, w.cc, w.fixed_course_days, w.is_active, w.is_fired, w.recommend,
        COALESCE(w.flexpedia_mobile, w.flexpedia_phone) AS phone, w.notes
      FROM worker w
      LEFT JOIN site s ON s.slug = w.preferred_site
      WHERE w.id = $1
    `, [id])
    const row = result.rows[0]
    if (!row) return null
    const [shifts, absences] = await Promise.all([
      db.query<ShiftRow>(`
        SELECT sh.id, sh.date::text AS date, sh.worker_id,
          w.full_name AS worker_name, sh.site_slug, s.name AS site_name,
          sh.section, sh.hours::text AS hours, sh.is_extra
        FROM shift sh
        JOIN site s ON s.slug = sh.site_slug
        LEFT JOIN worker w ON w.id = sh.worker_id
        WHERE sh.worker_id = $1
        ORDER BY sh.date DESC, s.name, sh.id DESC
      `, [id]),
      db.query<AbsenceRow>(`
        SELECT a.id, a.worker_id, w.full_name AS worker_name,
          a.start_date::text AS start_date, a.end_date::text AS end_date, a.reason
        FROM absence a
        JOIN worker w ON w.id = a.worker_id
        WHERE a.worker_id = $1
        ORDER BY a.start_date DESC, a.id DESC
      `, [id]),
    ])
    return {
      ...toPerson(row),
      phone: row.phone,
      notes: row.notes,
      shifts: shifts.rows.map(toShift),
      absences: absences.rows.map(toAbsence),
    }
  })
}

export async function getWarehouseShifts(): Promise<WarehouseShift[]> {
  await requireDispatcher()
  return withDb(async db => {
    const { rows } = await db.query<ShiftRow>(`
      SELECT sh.id, sh.date::text AS date, sh.worker_id,
        w.full_name AS worker_name, sh.site_slug, s.name AS site_name,
        sh.section, sh.hours::text AS hours, sh.is_extra
      FROM shift sh
      JOIN site s ON s.slug = sh.site_slug
      LEFT JOIN worker w ON w.id = sh.worker_id
      JOIN vacancy v ON v.id = sh.vacancy_id
      WHERE v.slug = 'warehouse'
      ORDER BY sh.date DESC, s.name, sh.section NULLS FIRST, w.full_name NULLS LAST
    `)
    return rows.map(toShift)
  })
}

export async function getWarehouseAbsences(): Promise<WarehouseAbsence[]> {
  await requireDispatcher()
  return withDb(async db => {
    const { rows } = await db.query<AbsenceRow>(`
      SELECT a.id, a.worker_id, w.full_name AS worker_name,
        a.start_date::text AS start_date, a.end_date::text AS end_date, a.reason
      FROM absence a
      JOIN worker w ON w.id = a.worker_id
      ORDER BY a.start_date DESC, w.full_name
    `)
    return rows.map(toAbsence)
  })
}

export async function getWarehouseVacancy(): Promise<WarehouseVacancy | null> {
  await requireDispatcher()
  return withDb(async db => {
    const result = await db.query<{
      id: number
      slug: string
      title: string
      company_name: string
      description: string
      address: string | null
      start_date: string | null
      end_date: string | null
      track_hours_manually: boolean
      default_hours: string | null
    }>(`
      SELECT v.id, v.slug, v.title, c.name AS company_name, v.description,
        v.worksite_address AS address, v.start_date::text AS start_date,
        v.end_date::text AS end_date, v.track_hours_manually,
        v.default_hours::text AS default_hours
      FROM vacancy v
      JOIN company c ON c.id = v.company_id
      WHERE v.slug = 'warehouse'
    `)
    const row = result.rows[0]
    if (!row) return null
    const [sites, requirements] = await Promise.all([
      db.query<WarehouseSite>(`
        SELECT s.slug, s.name, s.address
        FROM vacancy_site vs JOIN site s ON s.slug = vs.site_slug
        WHERE vs.vacancy_id = $1
        ORDER BY s.name
      `, [row.id]),
      db.query<WarehouseVacancy['requirements'][number]>(`
        SELECT id, kind, label, is_required AS required
        FROM vacancy_requirement
        WHERE vacancy_id = $1
        ORDER BY is_required DESC, kind, label
      `, [row.id]),
    ])
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      companyName: row.company_name,
      description: row.description,
      address: row.address,
      startDate: row.start_date,
      endDate: row.end_date,
      trackHoursManually: row.track_hours_manually,
      defaultHours: row.default_hours === null ? null : Number(row.default_hours),
      sites: sites.rows,
      requirements: requirements.rows,
    }
  })
}

export async function getWarehouseSites(): Promise<WarehouseSite[]> {
  await requireDispatcher()
  return withDb(async db => {
    const { rows } = await db.query<WarehouseSite>(`
      SELECT s.slug, s.name, s.address
      FROM vacancy_site vs JOIN site s ON s.slug = vs.site_slug
      JOIN vacancy v ON v.id = vs.vacancy_id
      WHERE v.slug = 'warehouse'
      ORDER BY s.name
    `)
    return rows
  })
}

export async function searchWarehouse(q: string) {
  await requireDispatcher()
  const query = `%${q.replace(/[\\%_]/g, '\\$&')}%`
  return withDb(async db => {
    const [people, vacancies, companies] = await Promise.all([
      db.query<{ id: number; full_name: string; preferred_site_name: string | null }>(`
        SELECT w.id, w.full_name, s.name AS preferred_site_name
        FROM worker w LEFT JOIN site s ON s.slug = w.preferred_site
        WHERE w.full_name ILIKE $1 ESCAPE '\\'
        ORDER BY w.full_name LIMIT 6
      `, [query]),
      db.query<{ slug: string; title: string; address: string | null }>(`
        SELECT slug, title, worksite_address AS address FROM vacancy
        WHERE title ILIKE $1 ESCAPE '\\' OR COALESCE(worksite_address, '') ILIKE $1 ESCAPE '\\'
        ORDER BY title LIMIT 6
      `, [query]),
      db.query<{ id: number; name: string }>(`
        SELECT id, name FROM company WHERE name ILIKE $1 ESCAPE '\\'
        ORDER BY name LIMIT 6
      `, [query]),
    ])
    return [
      ...people.rows.map(row => ({
        id: String(row.id),
        kind: 'person' as const,
        title: row.full_name,
        subtitle: row.preferred_site_name ?? 'Warehouse worker',
        href: `/people/${row.id}`,
      })),
      ...companies.rows.map(row => ({
        id: String(row.id),
        kind: 'company' as const,
        title: row.name,
        subtitle: 'Company',
        href: '/companies',
      })),
      ...vacancies.rows.map(row => ({
        id: row.slug,
        kind: 'vacancy' as const,
        title: row.title,
        subtitle: row.address ?? 'Warehouse vacancy',
        href: `/vacancies/${row.slug}`,
      })),
    ]
  })
}

export async function getWarehouseAppData(): Promise<WorkforceData> {
  await assertSession()
  return withDb(async db => {
    const [workerResult, siteResult, shiftResult, absenceResult, companyResult, vacancyResult, requirementResult, visibilityResult, workerCompanyResult, workerCourseResult, workerQualificationResult, manualHoursResult, scheduleStateResult, vacancyDemandResult] = await Promise.all([
      db.query<{
        id: number; full_name: string; preferred_site: string | null
        cc: string | null; notes: string | null
        fixed_course_days: string | null; recommend: boolean; is_active: boolean; is_fired: boolean
        flexpedia_id: number | null
        flexpedia_initials: string | null; flexpedia_first_name: string | null
        flexpedia_insertion: string | null; flexpedia_last_name: string | null
        flexpedia_gender: 'm' | 'f' | null; flexpedia_birth_date: string | null
        flexpedia_street: string | null; flexpedia_street_number: string | null
        flexpedia_street_number_addition: string | null; flexpedia_post_code: string | null
        flexpedia_city: string | null; flexpedia_phone: string | null
        flexpedia_phone_country: string | null; flexpedia_mobile: string | null
        flexpedia_email: string | null; flexpedia_residence_country: string | null
        flexpedia_nationality: string | null
        dismissed_at: string | null
      }>(`SELECT id, full_name, preferred_site, rating, cc, notes,
        fixed_course_days, recommend, is_active, is_fired, flexpedia_id,
        flexpedia_initials, flexpedia_first_name, flexpedia_insertion, flexpedia_last_name,
        flexpedia_gender, flexpedia_birth_date::text, flexpedia_street, flexpedia_street_number,
        flexpedia_street_number_addition, flexpedia_post_code, flexpedia_city, flexpedia_phone,
        flexpedia_phone_country, flexpedia_mobile, flexpedia_email, flexpedia_residence_country,
        flexpedia_nationality, dismissed_at::text FROM worker ORDER BY id`),
      db.query<{ vacancy_id: number; slug: string; name: string; address: string }>(`
        SELECT vs.vacancy_id, s.slug, s.name, s.address FROM vacancy_site vs
        JOIN site s ON s.slug = vs.site_slug JOIN vacancy v ON v.id = vs.vacancy_id
        ORDER BY v.id, s.name`),
      db.query<{
        id: number; date: string; worker_id: number | null; site_slug: string; vacancy_slug: string
        section: string | null; hours: string; is_extra: boolean
      }>(`SELECT sh.id, sh.date::text AS date, sh.worker_id, sh.site_slug,
        v.slug AS vacancy_slug, sh.section, sh.hours::text AS hours, sh.is_extra
        FROM shift sh JOIN vacancy v ON v.id = sh.vacancy_id
        WHERE sh.vacancy_id IS NOT NULL
          AND sh.confirmation_status IS DISTINCT FROM 'cancelled'
        ORDER BY sh.date, sh.site_slug, sh.section NULLS FIRST, sh.schedule_position, sh.id`),
      db.query<{ id: number; worker_id: number; start_date: string; end_date: string; reason: string | null }>(`
        SELECT a.id, a.worker_id, a.start_date::text AS start_date,
          a.end_date::text AS end_date, a.reason
        FROM absence a JOIN worker w ON w.id = a.worker_id
        ORDER BY a.start_date, a.id`),
      db.query<{
        id: number; name: string; contact_person: string | null; phone: string | null
        notes: string | null; logo_url: string | null
      }>(`
        SELECT id, name, contact_person, phone, notes, logo_url FROM company ORDER BY name, id`),
      db.query<{
        id: number; slug: string; title: string; company_id: number; description: string
        worksite_address: string | null; latitude: number | null; longitude: number | null
        start_date: string | null; end_date: string | null; track_hours_manually: boolean
          archived_at: string | null; car_only: boolean; default_hours: string | null; project_code: string | null
        schedule_pattern: (Vacancy['schedule'] & { requiresAvailableList?: boolean }) | null
      }>(`SELECT id, slug, title, company_id, description, worksite_address,
        latitude, longitude, start_date::text AS start_date, end_date::text AS end_date,
          track_hours_manually, archived_at::text AS archived_at, car_only,
          default_hours::text AS default_hours, project_code, schedule_pattern
          FROM vacancy
          ORDER BY (slug = 'warehouse') DESC, id`),
      db.query<{ id: number; vacancy_id: number; vacancy_slug: string; kind: RequirementKind; label: string; is_required: boolean }>(`
        SELECT r.id, r.vacancy_id, v.slug AS vacancy_slug, r.kind, r.label, r.is_required
        FROM vacancy_requirement r JOIN vacancy v ON v.id = r.vacancy_id
        ORDER BY r.id`),
      db.query<{ vacancy_slug: string; id: string; details: {
        worker_id?: string; date?: string | null; hidden?: boolean; reset?: boolean
      } }>(`
        SELECT v.slug AS vacancy_slug, vc.id::text AS id, vc.details
        FROM vacancy_change vc JOIN vacancy v ON v.id = vc.vacancy_id
        WHERE vc.event_type = 'candidate_visibility'
        ORDER BY vc.id`),
      db.query<{ worker_id: number; company_id: number }>(`
        SELECT worker_id, company_id FROM worker_company_access ORDER BY worker_id, company_id`),
      db.query<{ worker_id: number; weekday: Worker['courseDays'][number] }>(`
        SELECT worker_id, weekday FROM worker_course_day ORDER BY worker_id, weekday`),
      db.query<{ worker_id: number; kind: string; label: string; status: string }>(`
        SELECT worker_id, kind, label, status FROM worker_qualification
        WHERE (kind = 'transport' AND label = 'Own car')
           OR (kind = 'document' AND label = 'VOG on file')
        ORDER BY worker_id, kind, label`),
      db.query<{ id: string; worker_id: number; vacancy_slug: string; date: string; hours: string }>(`
        SELECT mh.id::text, mh.worker_id, v.slug AS vacancy_slug,
          mh.date::text AS date, mh.hours::text AS hours
        FROM manual_hours mh JOIN vacancy v ON v.id = mh.vacancy_id
        ORDER BY mh.date, mh.id`),
      db.query<{ standing: StandingAssignment[] }>(`
        SELECT state.standing
        FROM vacancy_schedule_state state
        JOIN vacancy v ON v.id = state.vacancy_id
        WHERE v.slug = 'warehouse'`),
      db.query<{
        id: number; vacancy_slug: string; date: string; place_id: string | null; section: string | null
        headcount: number; start: string | null; end: string | null; note: string | null
      }>(`
        SELECT d.id, v.slug AS vacancy_slug, d.date::text AS date, d.site_slug AS place_id,
          d.section, d.headcount, to_char(d.start_time, 'HH24:MI') AS start,
          to_char(d.end_time, 'HH24:MI') AS end, d.note
        FROM vacancy_demand d JOIN vacancy v ON v.id = d.vacancy_id
        ORDER BY d.date, d.id`),
    ])
    const companyRows = companyResult.rows
    const companies: Company[] = companyRows.map(company => ({
      id: `c-${company.id}`,
      name: company.name,
      contactPerson: company.contact_person,
      phone: company.phone,
      notes: company.notes,
      logoUrl: company.logo_url,
    }))
    const workerCompanyAccess = new Map<number, string[]>()
    for (const access of workerCompanyResult.rows) {
      const current = workerCompanyAccess.get(access.worker_id) ?? []
      current.push(`c-${access.company_id}`)
      workerCompanyAccess.set(access.worker_id, current)
    }
    const workerCourseDays = new Map<number, Worker['courseDays']>()
    for (const course of workerCourseResult.rows) {
      const current = workerCourseDays.get(course.worker_id) ?? []
      current.push(course.weekday)
      workerCourseDays.set(course.worker_id, current)
    }
    const workerQualifications = new Map<number, Map<string, boolean>>()
    for (const qualification of workerQualificationResult.rows) {
      const current = workerQualifications.get(qualification.worker_id) ?? new Map<string, boolean>()
      current.set(`${qualification.kind}:${qualification.label}`, qualification.status === 'verified')
      workerQualifications.set(qualification.worker_id, current)
    }
    const workers: Worker[] = workerResult.rows.map(worker => {
      const parts = worker.full_name.trim().split(/\s+/)
      const firstName = worker.flexpedia_first_name ?? parts[0] ?? ''
      const lastName = worker.flexpedia_last_name ?? (parts.length > 1 ? parts[parts.length - 1] : '')
      const insertion = worker.flexpedia_insertion ?? (worker.flexpedia_id !== null
        ? null : parts.length > 2 ? parts.slice(1, -1).join(' ') : null)
      const legacyCourseDays = (worker.fixed_course_days ?? '').split(',')
        .map(day => day.trim().slice(0, 3).toLowerCase())
        .filter((day): day is Worker['courseDays'][number] => WEEKDAYS.includes(day as Worker['courseDays'][number]))
      const courseDays = workerCourseDays.get(worker.id) ?? legacyCourseDays
      const qualifications = workerQualifications.get(worker.id)
      return {
        id: String(worker.id),
        flexpediaId: worker.flexpedia_id,
        manatalCandidateId: null,
        initials: worker.flexpedia_initials ?? initialsFor(worker.full_name),
        firstName,
        insertion,
        lastName,
        fullName: worker.full_name,
        gender: worker.flexpedia_gender,
        birthDate: worker.flexpedia_birth_date,
        street: worker.flexpedia_street,
        streetNumber: worker.flexpedia_street_number,
        streetNumberAddition: worker.flexpedia_street_number_addition,
        postCode: worker.flexpedia_post_code,
        city: worker.flexpedia_city,
        residenceCountry: worker.flexpedia_residence_country,
        nationality: worker.flexpedia_nationality,
        phone: worker.flexpedia_phone,
        phoneCountry: worker.flexpedia_phone_country,
        mobile: worker.flexpedia_mobile,
        email: worker.flexpedia_email ?? '',
        lat: null,
        lon: null,
        geocodedAt: null,
        notes: worker.notes ?? '',
        hasCar: qualifications?.get('transport:Own car') ?? null,
        hasVog: qualifications?.get('document:VOG on file') ?? null,
        courseDays,
        status: worker.is_active && !worker.is_fired ? 'active' : 'dismissed',
        dismissedAt: worker.dismissed_at,
        companyAccess: workerCompanyAccess.get(worker.id) ?? [],
        manatalLink: 'not_found',
        cvUrl: null,
      }
    })
    const vacancy: Vacancy[] = vacancyResult.rows.map(row => {
      const pattern = row.schedule_pattern
      return {
      id: row.slug,
      title: row.title,
      companyId: `c-${row.company_id}`,
      address: row.worksite_address ?? siteResult.rows.find(site => site.vacancy_id === row.id)?.address ?? '',
      lat: row.latitude,
      lon: row.longitude,
      description: row.description,
      startDate: row.start_date ?? shiftResult.rows.find(shift => shift.vacancy_slug === row.slug)?.date ?? new Date().toISOString().slice(0, 10),
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
      places: siteResult.rows.filter(site => site.vacancy_id === row.id).map(site => ({ id: site.slug, name: site.name })),
      carOnly: row.car_only,
      requiresAvailableList: pattern?.requiresAvailableList === true,
      defaultHours: row.default_hours === null ? null : Number(row.default_hours),
      projectCode: row.project_code,
      requirements: requirementResult.rows.filter(requirement => requirement.vacancy_id === row.id).map(requirement => ({
        id: String(requirement.id), kind: requirement.kind, label: requirement.label, required: requirement.is_required,
      })),
    }})
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
      visibility.set(`${scope}${date ?? '*'}`, { vacancyId: event.vacancy_slug, workerId, date, hidden: event.details.hidden })
    }
    const roster: RosterEntry[] = shiftResult.rows.map(shift => ({
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
    const demand: Demand[] = vacancyDemandResult.rows.map(slot => ({
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
    const slotCounts = new Map<string, { vacancyId: string; date: string; placeId: string; section: string | null; headcount: number }>()
    for (const shift of shiftResult.rows) {
      const key = [shift.vacancy_slug, shift.date, shift.site_slug, shift.section ?? ''].join('\u0000')
      const hasExplicitDemand = demand.some(slot => slot.vacancyId === shift.vacancy_slug
        && slot.date === shift.date
        && (slot.placeId === null || slot.placeId === shift.site_slug)
        && (slot.section === null || slot.section === shift.section))
      if (hasExplicitDemand) continue
      const slot = slotCounts.get(key)
      if (slot) slot.headcount += 1
      else slotCounts.set(key, { vacancyId: shift.vacancy_slug, date: shift.date, placeId: shift.site_slug, section: shift.section, headcount: 1 })
    }
    demand.push(...[...slotCounts.values()].map((slot, index) => ({
      id: `derived-${slot.vacancyId}-${slot.date}-${index}`,
      vacancyId: slot.vacancyId,
      date: slot.date,
      placeId: slot.placeId,
      section: slot.section,
      headcount: slot.headcount,
      start: null,
      end: null,
      note: null,
    })))
    const leaves: Leave[] = []
    for (const absence of absenceResult.rows) {
      for (let date = absence.start_date; date <= absence.end_date; date = addDays(date, 1)) {
        leaves.push({
          id: `absence-${absence.id}-${date}`,
          workerId: String(absence.worker_id),
          date,
          reason: absence.reason?.replace(/^(?:Paid|Unpaid) leave: /, '') || 'Unavailable',
          paidLeave: /^Paid leave: /.test(absence.reason ?? '') || /vacation|holiday/i.test(absence.reason ?? ''),
        })
      }
    }
    const hours: HoursEntry[] = shiftResult.rows.flatMap(shift => shift.worker_id === null ? [] : [{
      id: String(shift.id),
      workerId: String(shift.worker_id),
      vacancyId: shift.vacancy_slug,
      date: shift.date,
      hours: Number(shift.hours),
    }]).concat(manualHoursResult.rows.map(entry => ({
      id: `manual-${entry.id}`,
      workerId: String(entry.worker_id),
      vacancyId: entry.vacancy_slug,
      date: entry.date,
      hours: Number(entry.hours),
      manual: true,
    })))
    const appData: AppData = {
      workers,
      companies,
      vacancies: vacancy,
      standing: scheduleStateResult.rows[0]?.standing ?? [],
      roster,
      leaves,
      hours,
      sync: [],
    }
    const offers: Offer[] = []
    return { ...appData, demand, offers, manatalCandidates: [], candidateVisibility: [...visibility.values()] }
  })
}

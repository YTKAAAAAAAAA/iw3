import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { companyLogoUrl } from '@/lib/company-logo'

/* Archiving stands in for deleting: the company's vacancies keep shifts,
   hours and photos that payroll still reads, so the row stays and only
   disappears from the pickers. Every worker loses access to it and its open
   vacancies are archived; the ids of both are kept for /restore. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  const match = id.match(/^c-([1-9]\d*)$/)
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    return NextResponse.json({ error: 'Invalid company id.' }, { status: 400 })
  }

  try {
    const result = await withDb(async db => {
      await db.query('BEGIN')
      try {
        const current = await db.query<{ archived: boolean }>(
          'SELECT archived_at IS NOT NULL AS archived FROM company WHERE id = $1 FOR UPDATE',
          [Number(match[1])],
        )
        if (!current.rows[0]) {
          await db.query('ROLLBACK')
          return { status: 404 as const, error: 'Company not found.' }
        }
        if (current.rows[0].archived) {
          await db.query('ROLLBACK')
          return { status: 409 as const, error: 'This company is already archived.' }
        }
        const { rows } = await db.query<{
          id: number; name: string; contact_person: string | null; phone: string | null
          notes: string | null; logo_url: string | null; logo_key: string | null; archived_at: string
          workers: number; vacancies: number
        }>(`
          WITH detached AS (
            DELETE FROM worker_company_access WHERE company_id = $1 RETURNING worker_id
          ),
          closed AS (
            UPDATE vacancy SET is_active = FALSE, archived_at = now(), updated_at = now()
            WHERE company_id = $1 AND archived_at IS NULL
            RETURNING id
          )
          UPDATE company SET archived_at = now(),
            archived_worker_ids = ARRAY(SELECT worker_id FROM detached ORDER BY worker_id),
            archived_vacancy_ids = ARRAY(SELECT id FROM closed ORDER BY id)
          WHERE id = $1
          RETURNING id, name, contact_person, phone, notes, logo_url, logo_key, archived_at::text AS archived_at,
            cardinality(archived_worker_ids) AS workers, cardinality(archived_vacancy_ids) AS vacancies
        `, [Number(match[1])])
        await db.query('COMMIT')
        return { status: 200 as const, row: rows[0] }
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    const company = result.row
    return NextResponse.json({
      company: {
        id: `c-${company.id}`, name: company.name,
        contactPerson: company.contact_person, phone: company.phone, notes: company.notes,
        logoUrl: companyLogoUrl(company.id, company.logo_key, company.logo_url), archivedAt: company.archived_at,
      },
      detachedWorkers: company.workers,
      archivedVacancies: company.vacancies,
    })
  } catch (error) {
    console.error('Failed to archive company.', error)
    return NextResponse.json({ error: 'Could not archive the company. Please try again.' }, { status: 500 })
  }
}

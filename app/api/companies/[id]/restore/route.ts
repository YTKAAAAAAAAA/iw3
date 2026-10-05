import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { companyLogoUrl } from '@/lib/company-logo'

/* Undoes /archive and nothing more: gives access back to the workers who had
   it and reopens the vacancies the archive closed. Vacancies that were already
   archived before stay archived; a worker removed since is skipped. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  const match = id.match(/^c-([1-9]\d*)$/)
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    return NextResponse.json({ error: 'Invalid company id.' }, { status: 400 })
  }
  const companyId = Number(match[1])

  try {
    const result = await withDb(async db => {
      await db.query('BEGIN')
      try {
        const current = await db.query<{ archived: boolean; worker_ids: number[]; vacancy_ids: number[] }>(`
          SELECT archived_at IS NOT NULL AS archived,
            archived_worker_ids AS worker_ids, archived_vacancy_ids AS vacancy_ids
          FROM company WHERE id = $1 FOR UPDATE
        `, [companyId])
        if (!current.rows[0]) {
          await db.query('ROLLBACK')
          return { status: 404 as const, error: 'Company not found.' }
        }
        if (!current.rows[0].archived) {
          await db.query('ROLLBACK')
          return { status: 409 as const, error: 'This company is not archived.' }
        }
        await db.query(`
          INSERT INTO worker_company_access (worker_id, company_id)
          SELECT w.id, $1 FROM worker w WHERE w.id = ANY($2::int[])
          ON CONFLICT DO NOTHING
        `, [companyId, current.rows[0].worker_ids])
        await db.query(`
          UPDATE vacancy SET is_active = TRUE, archived_at = NULL, updated_at = now()
          WHERE company_id = $1 AND id = ANY($2::int[]) AND archived_at IS NOT NULL
        `, [companyId, current.rows[0].vacancy_ids])
        const { rows } = await db.query<{
          id: number; name: string; contact_person: string | null; phone: string | null
          notes: string | null; logo_url: string | null; logo_key: string | null
        }>(`
          UPDATE company SET archived_at = NULL, archived_worker_ids = '{}', archived_vacancy_ids = '{}'
          WHERE id = $1
          RETURNING id, name, contact_person, phone, notes, logo_url, logo_key
        `, [companyId])
        await db.query('COMMIT')
        return { status: 200 as const, row: rows[0] }
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    const company = result.row
    return NextResponse.json({ company: {
      id: `c-${company.id}`, name: company.name,
      contactPerson: company.contact_person, phone: company.phone, notes: company.notes,
      logoUrl: companyLogoUrl(company.id, company.logo_key, company.logo_url), archivedAt: null,
    } })
  } catch (error) {
    console.error('Failed to restore company.', error)
    return NextResponse.json({ error: 'Could not restore the company. Please try again.' }, { status: 500 })
  }
}

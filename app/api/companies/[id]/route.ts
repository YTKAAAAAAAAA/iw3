import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  const match = id.match(/^c-([1-9]\d*)$/)
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    return NextResponse.json({ error: 'Invalid company id.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid company details.' }, { status: 400 })
  }
  const data = body as Record<string, unknown>
  const allowed = new Set(['name', 'contactPerson', 'phone', 'notes'])
  if (Object.keys(data).some(key => !allowed.has(key))
    || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 200
    || ['contactPerson', 'phone', 'notes'].some(key => key in data
      && data[key] !== null
      && (typeof data[key] !== 'string' || data[key].length > (key === 'notes' ? 5000 : 200)))) {
    return NextResponse.json({ error: 'Enter a valid company name, contact, phone, and notes.' }, { status: 400 })
  }

  const fields = {
    name: data.name.trim(),
    contactPerson: typeof data.contactPerson === 'string' ? data.contactPerson.trim() || null : null,
    phone: typeof data.phone === 'string' ? data.phone.trim() || null : null,
    notes: typeof data.notes === 'string' ? data.notes.trim() || null : null,
  }
  try {
    const { rows } = await withDb(db => db.query<{
      id: number; name: string; contact_person: string | null; phone: string | null; notes: string | null
    }>(`
      UPDATE company
      SET name = $2, contact_person = $3, phone = $4, notes = $5
      WHERE id = $1
      RETURNING id, name, contact_person, phone, notes
    `, [Number(match[1]), fields.name, fields.contactPerson, fields.phone, fields.notes]))
    if (!rows[0]) return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    const company = rows[0]
    return NextResponse.json({ company: {
      id: `c-${company.id}`, name: company.name,
      contactPerson: company.contact_person, phone: company.phone, notes: company.notes,
    } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: `A company called "${fields.name}" already exists.` }, { status: 409 })
    }
    console.error('Failed to update company.', error)
    return NextResponse.json({ error: 'Could not save the company. Please try again.' }, { status: 500 })
  }
}

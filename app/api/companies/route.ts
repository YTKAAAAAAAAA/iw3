import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

export async function POST(request: Request) {
  if (!await getSession()) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
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
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name || name.length > 200
    || ['contactPerson', 'phone', 'notes'].some(key => key in data
      && (data[key] !== null && typeof data[key] !== 'string'
        || typeof data[key] === 'string' && data[key].length > (key === 'notes' ? 5000 : 200)))) {
    return NextResponse.json({ error: 'Enter a valid company name, contact, phone, and notes.' }, { status: 400 })
  }
  const contactPerson = typeof data.contactPerson === 'string' ? data.contactPerson.trim() || null : null
  const phone = typeof data.phone === 'string' ? data.phone.trim() || null : null
  const notes = typeof data.notes === 'string' ? data.notes.trim() || null : null
  try {
    const { rows } = await withDb(db => db.query<{
      id: number; name: string; contact_person: string | null; phone: string | null; notes: string | null
    }>(`
      INSERT INTO company (name, contact_person, phone, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, contact_person, phone, notes
    `, [name, contactPerson, phone, notes]))
    return NextResponse.json({ company: {
      id: `c-${rows[0].id}`, name: rows[0].name,
      contactPerson: rows[0].contact_person, phone: rows[0].phone, notes: rows[0].notes,
      logoUrl: null, archivedAt: null,
    } }, { status: 201 })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: `A company called "${name}" already exists.` }, { status: 409 })
    }
    console.error('Failed to create company.', error)
    return NextResponse.json({ error: 'Could not save the company. Please try again.' }, { status: 500 })
  }
}

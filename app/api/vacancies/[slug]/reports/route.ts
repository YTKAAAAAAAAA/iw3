import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { detectWorkdayPhotoType, WORKDAY_PHOTO_MAX_BYTES } from '@/lib/workday-photo'

type RouteContext = { params: Promise<{ slug: string }> }
const multipartOverheadLimit = 64 * 1024

const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status })
const isISODate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const { slug } = await params
  const date = new URL(request.url).searchParams.get('date')
  if (!date || !isISODate(date)) return jsonError(400, 'A valid work date is required.')

  try {
    const result = await withDb(async db => {
      const vacancy = await db.query<{ id: number }>('SELECT id FROM vacancy WHERE slug = $1', [slug])
      if (!vacancy.rows[0]) return null
      const photos = await db.query<{
        id: string
        content_type: string
        byte_size: number
        created_at: string
      }>(`
        SELECT id::text, content_type, byte_size, created_at::text
        FROM vacancy_workday_photo
        WHERE vacancy_id = $1 AND work_date = $2::date
        ORDER BY created_at, id
      `, [vacancy.rows[0].id, date])
      return photos.rows
    })
    if (!result) return jsonError(404, 'Vacancy not found.')
    return NextResponse.json({ photos: result }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Failed to load workday photos.', error)
    return jsonError(500, 'Could not load workday photos.')
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')

  const contentLength = Number(request.headers.get('content-length'))
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return jsonError(411, 'Upload size is required.')
  }
  if (contentLength > WORKDAY_PHOTO_MAX_BYTES + multipartOverheadLimit) {
    return jsonError(413, 'Each photo must be 10 MiB or smaller.')
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
    return jsonError(415, 'Upload a photo using multipart form data.')
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError(400, 'Could not read the photo upload.')
  }

  const date = form.get('date')
  const file = form.get('photo')
  if (typeof date !== 'string' || !isISODate(date) || !(file instanceof File)) {
    return jsonError(400, 'A valid work date and photo are required.')
  }
  if (file.size < 1 || file.size > WORKDAY_PHOTO_MAX_BYTES) {
    return jsonError(413, 'Each photo must be between 1 byte and 10 MiB.')
  }

  const image = Buffer.from(await file.arrayBuffer())
  const contentType = detectWorkdayPhotoType(image)
  if (!contentType) return jsonError(415, 'Use a JPEG, PNG, or WebP photo.')

  const { slug } = await params
  try {
    const created = await withDb(async db => {
      const vacancy = await db.query<{ id: number }>('SELECT id FROM vacancy WHERE slug = $1', [slug])
      if (!vacancy.rows[0]) return null
      const photo = await db.query<{ id: string }>(`
        INSERT INTO vacancy_workday_photo (vacancy_id, work_date, content_type, image, byte_size)
        VALUES ($1, $2::date, $3, $4, $5)
        RETURNING id::text
      `, [vacancy.rows[0].id, date, contentType, image, image.byteLength])
      return photo.rows[0].id
    })
    if (!created) return jsonError(404, 'Vacancy not found.')
    return NextResponse.json({ id: created }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Failed to save workday photo.', error)
    return jsonError(500, 'Could not save the photo.')
  }
}

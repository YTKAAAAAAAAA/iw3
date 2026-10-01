import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'

type RouteContext = { params: Promise<{ slug: string; photoId: string }> }
const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status })
const validId = (value: string) => /^[1-9]\d{0,14}$/.test(value)

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const { slug, photoId } = await params
  if (!validId(photoId)) return jsonError(404, 'Photo not found.')

  try {
    const photo = await withDb(async db => {
      const result = await db.query<{ content_type: string; image: Buffer }>(`
        SELECT photo.content_type, photo.image
        FROM vacancy_workday_photo photo
        JOIN vacancy v ON v.id = photo.vacancy_id
        WHERE v.slug = $1 AND photo.id = $2
      `, [slug, photoId])
      return result.rows[0] ?? null
    })
    if (!photo) return jsonError(404, 'Photo not found.')
    return new NextResponse(new Uint8Array(photo.image), {
      headers: {
        'Content-Type': photo.content_type,
        'Content-Length': String(photo.image.byteLength),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Failed to load workday photo.', error)
    return jsonError(500, 'Could not load the photo.')
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const { slug, photoId } = await params
  if (!validId(photoId)) return jsonError(404, 'Photo not found.')

  try {
    const deleted = await withDb(async db => {
      const result = await db.query(`
        DELETE FROM vacancy_workday_photo photo
        USING vacancy v
        WHERE photo.vacancy_id = v.id AND v.slug = $1 AND photo.id = $2
        RETURNING photo.id
      `, [slug, photoId])
      return result.rowCount === 1
    })
    return deleted ? new NextResponse(null, { status: 204 }) : jsonError(404, 'Photo not found.')
  } catch (error) {
    console.error('Failed to delete workday photo.', error)
    return jsonError(500, 'Could not delete the photo.')
  }
}

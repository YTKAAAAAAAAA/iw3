import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { withDb } from '@/lib/db'
import { companyLogoUrl } from '@/lib/company-logo'
import { deletePhoto, readPhoto, savePhoto } from '@/lib/photo-storage'
import { detectWorkdayPhotoType } from '@/lib/workday-photo'

type RouteContext = { params: Promise<{ id: string }> }
const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status })
const LOGO_MAX_BYTES = 2 * 1024 * 1024
const multipartOverheadLimit = 64 * 1024

function companyId(id: string): number | null {
  const match = id.match(/^c-([1-9]\d{0,9})$/)
  return match ? Number(match[1]) : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const id = companyId((await params).id)
  if (id === null) return jsonError(404, 'Logo not found.')
  try {
    const logo = await withDb(async db => {
      const { rows } = await db.query<{ logo_key: string | null; logo_type: string | null }>(
        'SELECT logo_key, logo_type FROM company WHERE id = $1', [id],
      )
      return rows[0] ?? null
    })
    if (!logo?.logo_key || !logo.logo_type) return jsonError(404, 'Logo not found.')
    const bytes = await readPhoto(logo.logo_key)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': logo.logo_type,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': 'inline',
        // The URL carries the file's key, so a cached copy is never stale.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      console.error('A company logo file is missing from storage.', { id })
      return jsonError(404, 'Logo not found.')
    }
    console.error('Failed to load company logo.', error)
    return jsonError(500, 'Could not load the logo.')
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const id = companyId((await params).id)
  if (id === null) return jsonError(400, 'Invalid company id.')

  const contentLength = Number(request.headers.get('content-length'))
  if (!Number.isFinite(contentLength) || contentLength <= 0) return jsonError(411, 'Upload size is required.')
  if (contentLength > LOGO_MAX_BYTES + multipartOverheadLimit) return jsonError(413, 'The logo must be 2 MiB or smaller.')
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
    return jsonError(415, 'Upload the logo using multipart form data.')
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError(400, 'Could not read the logo upload.')
  }
  const file = form.get('logo')
  if (!(file instanceof File)) return jsonError(400, 'Choose an image for the logo.')
  if (file.size < 1 || file.size > LOGO_MAX_BYTES) return jsonError(413, 'The logo must be 2 MiB or smaller.')
  const image = Buffer.from(await file.arrayBuffer())
  const contentType = detectWorkdayPhotoType(image)
  if (!contentType) return jsonError(415, 'Use a JPEG, PNG, or WebP image.')

  let storageKey: string | null = null
  try {
    storageKey = await savePhoto(image, contentType)
    const key = storageKey
    const previous = await withDb(async db => {
      // The old key is read under the same lock, so it is the file this upload replaces.
      await db.query('BEGIN')
      try {
        const { rows } = await db.query<{ logo_key: string | null }>(
          'SELECT logo_key FROM company WHERE id = $1 FOR UPDATE', [id],
        )
        if (!rows[0]) {
          await db.query('ROLLBACK')
          return undefined
        }
        await db.query('UPDATE company SET logo_key = $2, logo_type = $3 WHERE id = $1', [id, key, contentType])
        await db.query('COMMIT')
        return rows[0].logo_key
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    })
    if (previous === undefined) {
      await deletePhoto(key)
      return jsonError(404, 'Company not found.')
    }
    if (previous) await deletePhoto(previous).catch(error => console.error('Could not delete the old logo file.', error))
    return NextResponse.json({ logoUrl: companyLogoUrl(id, key) })
  } catch (error) {
    if (storageKey) await deletePhoto(storageKey).catch(() => undefined)
    console.error('Failed to save company logo.', error)
    return jsonError(500, 'Could not save the logo. Please try again.')
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!await getSession()) return jsonError(401, 'Authentication required.')
  const id = companyId((await params).id)
  if (id === null) return jsonError(400, 'Invalid company id.')
  try {
    const previous = await withDb(async db => {
      const { rows } = await db.query<{ logo_key: string | null }>(`
        UPDATE company c SET logo_key = NULL, logo_type = NULL
        FROM (SELECT id, logo_key FROM company WHERE id = $1 FOR UPDATE) old
        WHERE c.id = old.id
        RETURNING old.logo_key
      `, [id])
      return rows[0]
    })
    if (!previous) return jsonError(404, 'Company not found.')
    if (previous.logo_key) await deletePhoto(previous.logo_key).catch(error => console.error('Could not delete the logo file.', error))
    return NextResponse.json({ logoUrl: null })
  } catch (error) {
    console.error('Failed to remove company logo.', error)
    return jsonError(500, 'Could not remove the logo. Please try again.')
  }
}

import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { WorkdayPhotoType } from './workday-photo'

/* Workday photos live on disk, not in PostgreSQL: a database full of 10 MB
   images makes every backup, restore and replica slow and expensive, while a
   directory of files is cheap to store and to copy. The database keeps only
   the metadata and the file's key. In Docker the directory is a named volume
   (see compose.yaml), and the backup service archives it next to the dump. */
/* The directory is only known at run time. Without `turbopackIgnore` the
   build cannot tell which files these paths may reach and copies the whole
   project into the standalone image to be safe. */
const ROOT = resolve(/*turbopackIgnore: true*/ process.env.PHOTO_STORAGE_DIR ?? join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'photos'))
const EXTENSION: Record<WorkdayPhotoType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/

/** Keys are generated here and checked on every read, so a stored value can
 *  never point outside the photo directory. */
function pathFor(key: string): string {
  if (!KEY.test(key)) throw new Error('Invalid photo storage key.')
  return join(/*turbopackIgnore: true*/ ROOT, key)
}

export async function savePhoto(bytes: Uint8Array, type: WorkdayPhotoType): Promise<string> {
  await mkdir(ROOT, { recursive: true })
  const key = `${randomUUID()}.${EXTENSION[type]}`
  const temporary = join(/*turbopackIgnore: true*/ ROOT, `.${key}.tmp`)
  // Written beside the target and renamed, so a crash never leaves half a file under a real key.
  await writeFile(temporary, bytes, { flag: 'wx' })
  await rename(temporary, pathFor(key))
  return key
}

export const readPhoto = (key: string): Promise<Buffer> => readFile(pathFor(key))

export async function deletePhoto(key: string): Promise<void> {
  await rm(pathFor(key), { force: true })
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectWorkdayPhotoType, WORKDAY_PHOTO_MAX_BYTES } from './workday-photo.ts'

test('accepts supported workday photo signatures', () => {
  assert.equal(detectWorkdayPhotoType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg')
  assert.equal(detectWorkdayPhotoType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(detectWorkdayPhotoType(Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ])), 'image/webp')
})

test('rejects unknown or incomplete image signatures', () => {
  assert.equal(detectWorkdayPhotoType(new Uint8Array()), null)
  assert.equal(detectWorkdayPhotoType(Uint8Array.from([0xff, 0xd8, 0x00])), null)
  assert.equal(detectWorkdayPhotoType(new TextEncoder().encode('<svg></svg>')), null)
})

test('limits uploaded photos to 10 MiB', () => {
  assert.equal(WORKDAY_PHOTO_MAX_BYTES, 10 * 1024 * 1024)
})

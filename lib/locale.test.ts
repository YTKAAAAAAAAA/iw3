import test from 'node:test'
import assert from 'node:assert/strict'
import { preferredLocale } from './locale.ts'

test('browser preference recognizes Dutch regional language tags', () => {
  assert.equal(preferredLocale(['en-US', 'nl-NL']), 'nl')
  assert.equal(preferredLocale(['NL-be']), 'nl')
})

test('browser preference falls back to English for non-Dutch languages', () => {
  assert.equal(preferredLocale(['en-GB']), 'en')
  assert.equal(preferredLocale([]), 'en')
})

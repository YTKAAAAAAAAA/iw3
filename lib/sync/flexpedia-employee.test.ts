import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  FLEXPEDIA_EMPLOYEE_FIELDS,
  flexpediaProfile,
  mergeFlexpediaProfile,
  parseFlexpediaEmployee,
  resolveFlexpediaWorkerMatch,
  UnsupportedFlexpediaEmployeeError,
  type FlexpediaEmployee,
} from './flexpedia-employee.ts'
import { previewFlexpediaFixture } from './flexpedia-fixture.ts'
import type { FlexpediaWorkerProfile } from './flexpedia-employee.ts'

const incoming: FlexpediaEmployee = {
  id: 2_000_000_000,
  initials: 'A.B.',
  firstname: 'New',
  insertion: null,
  lastname: 'Details',
  gender: 'f',
  birthdate: '1990-01-02T00:00:00Z',
  street: 'Example Street',
  streetNumber: '2',
  streetNumberAddition: null,
  postCode: '0000 AA',
  city: 'Fixture City',
  phone: '0000000000',
  phoneCountryISOCode: 'NL',
  mobile: '0000000000',
  email: 'test@example.invalid',
  residenceCountryISOCode: 'NL',
  nationalityISOCode: 'NotAvailable',
}

function existingProfile(): FlexpediaWorkerProfile {
  return {
    flexpediaId: null,
    initials: 'L.W.',
    firstName: 'Local',
    insertion: null,
    lastName: 'Worker',
    gender: null,
    birthDate: null,
    street: null,
    streetNumber: null,
    streetNumberAddition: null,
    postCode: null,
    city: null,
    phone: 'local-phone',
    phoneCountry: null,
    mobile: 'local-mobile',
    email: '',
    residenceCountry: null,
    nationality: null,
  }
}

test('Flexpedia is authoritative for profile values, including explicit empty fields', () => {
  const result = mergeFlexpediaProfile(existingProfile(), incoming)
  assert.equal(result.profile.flexpediaId, incoming.id)
  assert.equal(result.profile.firstName, incoming.firstname)
  assert.equal(result.profile.initials, incoming.initials)
  assert.equal(result.profile.phone, incoming.phone)
  assert.equal(result.profile.mobile, incoming.mobile)
  assert.equal(result.profile.gender, 'f')
  assert.equal(result.profile.email, incoming.email)
  assert.deepEqual(result.changedFields.includes('gender'), true)
  assert.equal(mergeFlexpediaProfile(
    { ...existingProfile(), phone: 'local-only-value' },
    { ...incoming, phone: null },
  ).profile.phone, null)
})

test('Flexpedia refuses to relink a worker already linked to another employee', () => {
  assert.throws(
    () => mergeFlexpediaProfile({ ...existingProfile(), flexpediaId: incoming.id + 1 }, incoming),
    /already linked/,
  )
})

test('the isolated fixture covers every documented EmployeeModel field', () => {
  assert.deepEqual(FLEXPEDIA_EMPLOYEE_FIELDS, [
    'id', 'initials', 'firstname', 'insertion', 'lastname', 'gender', 'birthdate',
    'street', 'streetNumber', 'streetNumberAddition', 'postCode', 'city', 'phone',
    'phoneCountryISOCode', 'mobile', 'email', 'residenceCountryISOCode', 'nationalityISOCode',
  ])

  const result = previewFlexpediaFixture({
    id: 'existing',
    fullName: 'Local Worker',
    profile: existingProfile(),
    assignedShifts: 12,
    courseDays: ['mon', 'wed'],
    absences: 3,
  }, [])

  assert.equal(result.existingMatched, 1)
  assert.equal(result.existingWouldEnrich, 1)
  assert.equal(result.newWouldAdd, 1)
  assert.equal(result.apiFieldsCovered, FLEXPEDIA_EMPLOYEE_FIELDS.length)
  assert.ok(result.existingFieldsChanged > 0)
  assert.deepEqual(Object.keys(flexpediaProfile(incoming)), [
    'flexpediaId', 'initials', 'firstName', 'insertion', 'lastName', 'gender', 'birthDate',
    'street', 'streetNumber', 'streetNumberAddition', 'postCode', 'city', 'phone',
    'phoneCountry', 'mobile', 'email', 'residenceCountry', 'nationality',
  ])
  assert.equal(result.assignedShiftsPreserved, 12)
  assert.equal(result.courseDaysPreserved, 2)
  assert.equal(result.absencesPreserved, 3)
  assert.equal(result.writesPerformed, false)
})

test('the EmployeeModel parser retains all documented fields and normalizes absent optional data', () => {
  const parsed = parseFlexpediaEmployee(incoming)
  assert.deepEqual(parsed, { ...incoming, birthdate: '1990-01-02' })
  const sparse = parseFlexpediaEmployee({
    id: 1,
    initials: 'T.D.',
    firstname: 'Test',
    lastname: 'Demo',
    email: 'test@example.invalid',
  })
  assert.equal(sparse.insertion, null)
  assert.equal(sparse.street, null)
  assert.equal(sparse.nationalityISOCode, null)
})

test('the EmployeeModel parser rejects unsupported values instead of guessing', () => {
  assert.throws(
    () => parseFlexpediaEmployee({ ...incoming, gender: 'unknown' }),
    UnsupportedFlexpediaEmployeeError,
  )
  assert.throws(
    () => parseFlexpediaEmployee({ ...incoming, phoneCountryISOCode: 'Netherlands' }),
    UnsupportedFlexpediaEmployeeError,
  )
  assert.throws(
    () => parseFlexpediaEmployee({ ...incoming, birthdate: '1990-02-30' }),
    UnsupportedFlexpediaEmployeeError,
  )
})

test('Flexpedia matching prefers the stable ID and links only unique unlinked names', () => {
  assert.deepEqual(resolveFlexpediaWorkerMatch(incoming, [
    { id: 1, fullName: 'Different Name', flexpediaId: incoming.id },
    { id: 2, fullName: 'New Details', flexpediaId: null },
  ]), { kind: 'matched', workerId: 1 })
  assert.deepEqual(resolveFlexpediaWorkerMatch(incoming, [
    { id: 2, fullName: 'New Details', flexpediaId: null },
  ]), { kind: 'matched', workerId: 2 })
  assert.deepEqual(resolveFlexpediaWorkerMatch(incoming, []), { kind: 'new' })
})

test('Flexpedia matching refuses ambiguous or already-linked same-name workers', () => {
  assert.deepEqual(resolveFlexpediaWorkerMatch(incoming, [
    { id: 2, fullName: 'New Details', flexpediaId: null },
    { id: 3, fullName: ' New   Details ', flexpediaId: null },
  ]), { kind: 'ambiguous' })
  assert.deepEqual(resolveFlexpediaWorkerMatch(incoming, [
    { id: 2, fullName: 'New Details', flexpediaId: incoming.id + 1 },
  ]), { kind: 'identity-conflict' })
})

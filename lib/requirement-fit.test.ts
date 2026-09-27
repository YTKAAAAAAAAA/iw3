import test from 'node:test'
import assert from 'node:assert/strict'
import { assessRequirements } from './requirement-fit.ts'
import type { Requirement, Worker } from './types.ts'

const worker: Worker = {
  id: 'w-1', flexpediaId: null, manatalCandidateId: null, initials: 'AB', firstName: 'A',
  insertion: null, lastName: 'B', fullName: 'A B', gender: null, birthDate: null,
  street: null, streetNumber: null, streetNumberAddition: null, postCode: null, city: null,
  residenceCountry: null, nationality: null, phone: null, phoneCountry: null, mobile: null,
  email: '', lat: null, lon: null, geocodedAt: null, notes: '', hasCar: false, hasVog: true,
  courseDays: [], status: 'active', dismissedAt: null, companyAccess: [], manatalLink: 'linked', cvUrl: null,
}

const requirement = (kind: Requirement['kind'], label: string, required = true): Requirement =>
  ({ id: label, kind, label, required })

test('a known unmet mandatory requirement blocks a candidate', () => {
  assert.deepEqual(assessRequirements([requirement('transport', 'Own car')], worker), {
    blocked: ['Own car is required'],
    warnings: [],
  })
})

test('preferred mismatches and unrecorded qualifications remain explainable warnings', () => {
  assert.deepEqual(assessRequirements([
    requirement('transport', 'Own car', false),
    requirement('skill', 'Warehouse experience'),
  ], worker), {
    blocked: [],
    warnings: ['Own car preferred', 'Verify Warehouse experience'],
  })
})

test('a recorded document requirement is not blocked when present', () => {
  assert.deepEqual(assessRequirements([requirement('document', 'VOG on file')], worker), {
    blocked: [],
    warnings: [],
  })
})

test('unknown transport and documents are warnings, not confirmed failures', () => {
  const unverified = { ...worker, hasCar: null, hasVog: null }
  assert.deepEqual(assessRequirements([
    requirement('transport', 'Own car'),
    requirement('document', 'VOG on file'),
  ], unverified), {
    blocked: [],
    warnings: ['Verify Own car', 'Verify VOG on file'],
  })
})

import {
  FLEXPEDIA_EMPLOYEE_FIELDS,
  flexpediaProfile,
  mergeFlexpediaProfile,
  type FlexpediaEmployee,
  type FlexpediaWorkerProfile,
} from './flexpedia-employee.ts'
import { summarizeFlexpediaMatches } from './warehouse-mapping.ts'

export type FlexpediaFixtureWorker = {
  id: string
  fullName: string
  profile: FlexpediaWorkerProfile
  assignedShifts: number
  courseDays: string[]
  absences: number
}

export type FlexpediaFixturePreview = {
  existingMatched: number
  existingWouldEnrich: number
  newWouldAdd: number
  existingFieldsChanged: number
  apiFieldsCovered: number
  assignedShiftsPreserved: number
  courseDaysPreserved: number
  absencesPreserved: number
  writesPerformed: false
}

export function localWorkerFixtureProfile(
  fullName: string,
  flexpediaId: number | null,
): FlexpediaWorkerProfile {
  const name = splitName(fullName)
  return {
    flexpediaId,
    initials: initials(name.firstName, name.lastName),
    firstName: name.firstName,
    insertion: name.insertion,
    lastName: name.lastName,
    gender: null,
    birthDate: null,
    street: null,
    streetNumber: null,
    streetNumberAddition: null,
    postCode: null,
    city: null,
    phone: null,
    phoneCountry: null,
    mobile: null,
    email: '',
    residenceCountry: null,
    nationality: null,
  }
}

function nextFixtureId(usedIds: number[]): number {
  const used = new Set(usedIds)
  let candidate = 2_000_000_000
  while (used.has(candidate) && candidate > 1) candidate--
  if (candidate <= 1) throw new Error('Could not allocate an isolated Flexpedia fixture ID.')
  return candidate
}

function splitName(fullName: string): { firstName: string; insertion: string | null; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) throw new Error('A local worker name is required for the Flexpedia fixture.')
  return {
    firstName: parts[0],
    insertion: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
    lastName: parts.at(-1)!,
  }
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0]}.${lastName[0]}.`.toLocaleUpperCase('en')
}

function fixtureEmployee(
  id: number,
  name: { firstName: string; insertion: string | null; lastName: string },
  suffix: 'existing' | 'new',
): FlexpediaEmployee {
  const isNew = suffix === 'new'
  const firstName = isNew ? 'Mila' : name.firstName
  const lastName = isNew ? 'Flexpedia Demo' : name.lastName
  const insertion = isNew ? null : name.insertion
  return {
    id,
    initials: initials(firstName, lastName),
    firstname: firstName,
    insertion,
    lastname: lastName,
    gender: isNew ? 'f' : 'm',
    birthdate: '1990-01-02T00:00:00Z',
    street: 'Example Street',
    streetNumber: isNew ? '2' : '1',
    streetNumberAddition: null,
    postCode: '0000 AA',
    city: 'Fixture City',
    phone: '0000000000',
    phoneCountryISOCode: 'NL',
    mobile: '0000000000',
    email: `flexpedia-${suffix}@example.invalid`,
    residenceCountryISOCode: 'NL',
    nationalityISOCode: 'NotAvailable',
  }
}

export function previewFlexpediaFixture(
  existing: FlexpediaFixtureWorker,
  existingIds: number[],
): FlexpediaFixturePreview {
  const fixtureId = nextFixtureId(existingIds)
  const employee = fixtureEmployee(fixtureId, splitName(existing.fullName), 'existing')
  const newEmployeeId = nextFixtureId([...existingIds, fixtureId])
  const newEmployee = fixtureEmployee(newEmployeeId, { firstName: '', insertion: null, lastName: '' }, 'new')
  const merged = mergeFlexpediaProfile(existing.profile, employee)
  const matching = summarizeFlexpediaMatches([employee, newEmployee], [{
    fullName: existing.fullName,
    flexpediaId: existing.profile.flexpediaId,
  }])
  const newProfile = flexpediaProfile(newEmployee)
  if (Object.values(newProfile).every(value => value === null || value === '')) {
    throw new Error('The new-employee fixture is empty.')
  }
  if (matching.matched !== 1 || matching.unmatched !== 1 || matching.ambiguous !== 0) {
    throw new Error('The isolated Flexpedia fixture did not produce one match and one new worker.')
  }
  return {
    existingMatched: matching.matched,
    existingWouldEnrich: merged.changedFields.length > 0 ? matching.matched : 0,
    newWouldAdd: matching.unmatched,
    existingFieldsChanged: merged.changedFields.length,
    apiFieldsCovered: FLEXPEDIA_EMPLOYEE_FIELDS.length,
    assignedShiftsPreserved: existing.assignedShifts,
    courseDaysPreserved: existing.courseDays.length,
    absencesPreserved: existing.absences,
    writesPerformed: false,
  }
}

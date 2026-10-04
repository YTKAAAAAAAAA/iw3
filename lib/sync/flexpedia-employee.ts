export type FlexpediaEmployee = {
  id: number
  initials: string
  firstname: string
  insertion: string | null
  lastname: string
  gender: 'm' | 'f' | null
  birthdate: string | null
  street: string | null
  streetNumber: string | null
  streetNumberAddition: string | null
  postCode: string | null
  city: string | null
  phone: string | null
  phoneCountryISOCode: string | null
  mobile: string | null
  email: string
  residenceCountryISOCode: string | null
  nationalityISOCode: string | null
}

export class UnsupportedFlexpediaEmployeeError extends Error {}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function field(record: Record<string, unknown>, name: string): unknown {
  const key = Object.keys(record).find(existing => existing.toLowerCase() === name.toLowerCase())
  return key ? record[key] : undefined
}

function requiredString(record: Record<string, unknown>, name: string): string {
  const value = field(record, name)
  if (typeof value !== 'string') throw new UnsupportedFlexpediaEmployeeError()
  return value
}

function nullableString(record: Record<string, unknown>, name: string): string | null {
  const value = field(record, name)
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new UnsupportedFlexpediaEmployeeError()
  return value
}

function countryCode(record: Record<string, unknown>, name: string): string | null {
  const value = nullableString(record, name)
  if (value === null) return null
  if (!/^[A-Z]{2}$/.test(value) && value !== 'NotAvailable') {
    throw new UnsupportedFlexpediaEmployeeError()
  }
  return value
}

function birthDate(record: Record<string, unknown>): string | null {
  const value = nullableString(record, 'birthdate')
  if (value === null) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new UnsupportedFlexpediaEmployeeError()
  const normalized = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)
    || new Date(`${normalized}T00:00:00Z`).toISOString().slice(0, 10) !== normalized) {
    throw new UnsupportedFlexpediaEmployeeError()
  }
  return normalized
}

export function parseFlexpediaEmployee(value: unknown): FlexpediaEmployee {
  const employee = asRecord(value)
  if (!employee) throw new UnsupportedFlexpediaEmployeeError()
  const id = field(employee, 'id')
  const gender = field(employee, 'gender')
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1
    || (gender !== undefined && gender !== null && gender !== 'm' && gender !== 'f')) {
    throw new UnsupportedFlexpediaEmployeeError()
  }
  return {
    id,
    initials: requiredString(employee, 'initials'),
    firstname: requiredString(employee, 'firstname'),
    insertion: nullableString(employee, 'insertion'),
    lastname: requiredString(employee, 'lastname'),
    gender: gender === 'm' || gender === 'f' ? gender : null,
    birthdate: birthDate(employee),
    street: nullableString(employee, 'street'),
    streetNumber: nullableString(employee, 'streetNumber'),
    streetNumberAddition: nullableString(employee, 'streetNumberAddition'),
    postCode: nullableString(employee, 'postCode'),
    city: nullableString(employee, 'city'),
    phone: nullableString(employee, 'phone'),
    phoneCountryISOCode: countryCode(employee, 'phoneCountryISOCode'),
    mobile: nullableString(employee, 'mobile'),
    email: requiredString(employee, 'email'),
    residenceCountryISOCode: countryCode(employee, 'residenceCountryISOCode'),
    nationalityISOCode: countryCode(employee, 'nationalityISOCode'),
  }
}

export const FLEXPEDIA_EMPLOYEE_FIELDS = [
  'id',
  'initials',
  'firstname',
  'insertion',
  'lastname',
  'gender',
  'birthdate',
  'street',
  'streetNumber',
  'streetNumberAddition',
  'postCode',
  'city',
  'phone',
  'phoneCountryISOCode',
  'mobile',
  'email',
  'residenceCountryISOCode',
  'nationalityISOCode',
] as const

export type FlexpediaWorkerProfile = {
  flexpediaId: number | null
  initials: string
  firstName: string
  insertion: string | null
  lastName: string
  gender: 'm' | 'f' | null
  birthDate: string | null
  street: string | null
  streetNumber: string | null
  streetNumberAddition: string | null
  postCode: string | null
  city: string | null
  phone: string | null
  phoneCountry: string | null
  mobile: string | null
  email: string
  residenceCountry: string | null
  nationality: string | null
}

export type FlexpediaProfileMerge = {
  profile: FlexpediaWorkerProfile
  changedFields: Array<keyof Omit<FlexpediaWorkerProfile, 'flexpediaId'>>
}

export function flexpediaProfile(employee: FlexpediaEmployee): FlexpediaWorkerProfile {
  return {
    flexpediaId: employee.id,
    initials: employee.initials,
    firstName: employee.firstname,
    insertion: employee.insertion,
    lastName: employee.lastname,
    gender: employee.gender,
    birthDate: employee.birthdate,
    street: employee.street,
    streetNumber: employee.streetNumber,
    streetNumberAddition: employee.streetNumberAddition,
    postCode: employee.postCode,
    city: employee.city,
    phone: employee.phone,
    phoneCountry: employee.phoneCountryISOCode,
    mobile: employee.mobile,
    email: employee.email,
    residenceCountry: employee.residenceCountryISOCode,
    nationality: employee.nationalityISOCode,
  }
}

export function mergeFlexpediaProfile(
  existing: FlexpediaWorkerProfile,
  incoming: FlexpediaEmployee,
): FlexpediaProfileMerge {
  if (existing.flexpediaId !== null && existing.flexpediaId !== incoming.id) {
    throw new Error('The worker is already linked to a different Flexpedia employee.')
  }

  const profile = { ...existing, flexpediaId: incoming.id }
  const incomingFields = {
    initials: incoming.initials,
    firstName: incoming.firstname,
    insertion: incoming.insertion,
    lastName: incoming.lastname,
    gender: incoming.gender,
    birthDate: incoming.birthdate,
    street: incoming.street,
    streetNumber: incoming.streetNumber,
    streetNumberAddition: incoming.streetNumberAddition,
    postCode: incoming.postCode,
    city: incoming.city,
    phone: incoming.phone,
    phoneCountry: incoming.phoneCountryISOCode,
    mobile: incoming.mobile,
    email: incoming.email,
    residenceCountry: incoming.residenceCountryISOCode,
    nationality: incoming.nationalityISOCode,
  } satisfies Omit<FlexpediaWorkerProfile, 'flexpediaId'>
  const changedFields: FlexpediaProfileMerge['changedFields'] = []

  for (const [key, value] of Object.entries(incomingFields) as Array<
    [keyof typeof incomingFields, typeof incomingFields[keyof typeof incomingFields]]
  >) {
    const current = profile[key]
    if (current === value) continue
    Object.assign(profile, { [key]: value })
    changedFields.push(key)
  }

  return { profile, changedFields }
}

export type FlexpediaWorkerMatch = {
  id: number
  fullName: string
  flexpediaId: number | null
}

export type FlexpediaWorkerMatchResult =
  | { kind: 'matched'; workerId: number }
  | { kind: 'new' }
  | { kind: 'ambiguous' }
  | { kind: 'identity-conflict' }

export function flexpediaEmployeeName(employee: FlexpediaEmployee): string {
  return [employee.firstname, employee.insertion, employee.lastname]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim()
}

export function resolveFlexpediaWorkerMatch(
  employee: FlexpediaEmployee,
  workers: FlexpediaWorkerMatch[],
): FlexpediaWorkerMatchResult {
  const linked = workers.find(worker => worker.flexpediaId === employee.id)
  if (linked) return { kind: 'matched', workerId: linked.id }

  const key = flexpediaEmployeeName(employee).replace(/\s+/g, ' ').toLocaleLowerCase('en')
  const matches = workers.filter(worker =>
    worker.fullName.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en') === key)
  if (matches.length > 1) return { kind: 'ambiguous' }
  if (!matches.length) return { kind: 'new' }
  if (matches[0].flexpediaId !== null) return { kind: 'identity-conflict' }
  return { kind: 'matched', workerId: matches[0].id }
}

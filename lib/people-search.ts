export type SearchablePerson = {
  id: string
  fullName: string
  city: string | null
  status: 'active' | 'dismissed'
}

export function searchPeople(people: SearchablePerson[], query: string): SearchablePerson[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return people
    .filter(person =>
      person.fullName.toLowerCase().includes(normalized)
      || person.city?.toLowerCase().includes(normalized))
    .sort((a, b) =>
      Number(b.fullName.toLowerCase() === normalized) - Number(a.fullName.toLowerCase() === normalized)
      || Number(b.status === 'dismissed') - Number(a.status === 'dismissed')
      || a.fullName.localeCompare(b.fullName))
}

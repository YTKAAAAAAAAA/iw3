export type SearchablePerson = {
  id: string
  fullName: string
  postCode: string | null
  status: 'active' | 'dismissed'
}

export function searchPeople(people: SearchablePerson[], query: string): SearchablePerson[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return people
    .filter(person =>
      person.fullName.toLowerCase().includes(normalized)
      // "1046bm" finds "1046 BM": postcodes are typed with and without the space.
      || (person.postCode?.toLowerCase().replace(/\s+/g, '') ?? '').includes(normalized.replace(/\s+/g, '')))
    .sort((a, b) =>
      Number(b.fullName.toLowerCase() === normalized) - Number(a.fullName.toLowerCase() === normalized)
      || Number(b.status === 'dismissed') - Number(a.status === 'dismissed')
      || a.fullName.localeCompare(b.fullName))
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { searchPeople } from './people-search.ts'

test('site search includes dismissed workers and clearly preserves their status', () => {
  const people = [
    { id: '1', fullName: 'Alex Worker', city: null, email: '', status: 'active' as const },
    { id: '2', fullName: 'Alex Worker', city: null, email: '', status: 'dismissed' as const },
  ]
  assert.deepEqual(searchPeople(people, 'alex').map(person => [person.id, person.status]), [
    ['2', 'dismissed'],
    ['1', 'active'],
  ])
})

test('site search returns every matching person instead of truncating large result sets', () => {
  const people = Array.from({ length: 25 }, (_, index) => ({
    id: String(index + 1),
    fullName: `Alex Worker ${index + 1}`,
    city: null,
    email: '',
    status: index % 2 === 0 ? 'dismissed' as const : 'active' as const,
  }))
  assert.equal(searchPeople(people, 'alex').length, 25)
})

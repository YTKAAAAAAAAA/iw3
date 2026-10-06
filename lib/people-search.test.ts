import test from 'node:test'
import assert from 'node:assert/strict'
import { searchPeople } from './people-search.ts'

test('site search includes dismissed workers and clearly preserves their status', () => {
  const people = [
    { id: '1', fullName: 'Alex Worker', postCode: null, status: 'active' as const },
    { id: '2', fullName: 'Alex Worker', postCode: null, status: 'dismissed' as const },
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
    postCode: null,
    status: index % 2 === 0 ? 'dismissed' as const : 'active' as const,
  }))
  assert.equal(searchPeople(people, 'alex').length, 25)
})

test('site search finds a postcode typed with or without its space', () => {
  const people = [
    { id: '1', fullName: 'Alex Worker', postCode: '1046 BM', status: 'active' as const },
    { id: '2', fullName: 'Sam Worker', postCode: '2011 AB', status: 'active' as const },
  ]
  assert.deepEqual(searchPeople(people, '1046bm').map(person => person.id), ['1'])
  assert.deepEqual(searchPeople(people, '1046 b').map(person => person.id), ['1'])
})

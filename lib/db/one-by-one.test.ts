import test from 'node:test'
import assert from 'node:assert/strict'
import { oneByOne } from './one-by-one.ts'

test('one by one: the next query starts only after the previous one finished, results in order', async () => {
  const log: string[] = []
  const step = (name: string, ms: number) => async () => {
    log.push(`start ${name}`)
    await new Promise(resolve => setTimeout(resolve, ms))
    log.push(`end ${name}`)
    return name
  }
  const results = await oneByOne(step('a', 20), step('b', 1), step('c', 5))
  assert.deepEqual(results, ['a', 'b', 'c'])
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c'])
})

test('one by one: a failure stops the rest', async () => {
  let ran = false
  await assert.rejects(
    oneByOne(
      async () => { throw new Error('boom') },
      async () => { ran = true },
    ),
    /boom/,
  )
  assert.equal(ran, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { withTransactionRetry } from './retry.ts'

const noWait = { wait: async () => {} }
const pgError = (code: string) => Object.assign(new Error(code), { code })

test('a serialization failure is retried until the transaction commits', async () => {
  let calls = 0
  const result = await withTransactionRetry(async () => {
    calls++
    if (calls < 3) throw pgError('40001')
    return 'saved'
  }, noWait)
  assert.equal(result, 'saved')
  assert.equal(calls, 3)
})

test('other errors are not retried', async () => {
  let calls = 0
  await assert.rejects(withTransactionRetry(async () => {
    calls++
    throw pgError('23505')
  }, noWait), /23505/)
  assert.equal(calls, 1)
})

test('it gives up after the last attempt', async () => {
  let calls = 0
  await assert.rejects(withTransactionRetry(async () => {
    calls++
    throw pgError('40P01')
  }, { ...noWait, attempts: 2 }), /40P01/)
  assert.equal(calls, 2)
})

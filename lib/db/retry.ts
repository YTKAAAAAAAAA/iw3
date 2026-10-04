/** PostgreSQL aborts a SERIALIZABLE transaction when it cannot prove the
 *  result is equivalent to some serial order (40001), and picks a victim
 *  when two transactions deadlock (40P01). Both are safe to run again from
 *  the start; anything else is a real error and is rethrown at once. */
const RETRYABLE = new Set(['40001', '40P01'])

export const isRetryableTransactionError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && RETRYABLE.has(String(error.code))

export async function withTransactionRetry<T>(
  run: () => Promise<T>,
  { attempts = 3, wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= attempts || !isRetryableTransactionError(error)) throw error
      await wait(40 * 2 ** attempt + Math.floor(Math.random() * 40))
    }
  }
}

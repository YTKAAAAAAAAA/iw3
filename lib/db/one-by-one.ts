/** Runs the given queries one after another and returns their results in
 *  order, like Promise.all over a list.
 *
 *  A pg client runs one query at a time; handing it several at once only
 *  queues them, and pg prints "Calling client.query() when the client is
 *  already executing a query is deprecated" — pg@9 will refuse it. This keeps
 *  the same shape at the call site without starting a query early. */
export async function oneByOne<T extends readonly (() => Promise<unknown>)[]>(
  ...steps: T
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = []
  for (const step of steps) results.push(await step())
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }
}

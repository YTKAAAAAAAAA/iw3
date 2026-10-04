export function sourceRecordsMissingLocally<TSourceId extends string | number>(
  localSourceIds: readonly (TSourceId | null)[],
  currentSourceIds: readonly TSourceId[],
): TSourceId[] {
  const current = new Set(currentSourceIds)
  return localSourceIds.filter((id): id is TSourceId => id !== null && !current.has(id))
}

/** True when a snapshot would delete so much imported history at once that
 *  it is more likely a broken source than real corrections: everything (once
 *  there is something to lose), or more than half and more than 25 rows. */
export function isImplausibleRemoval(removing: number, linked: number): boolean {
  if (!removing) return false
  return (linked >= 10 && removing === linked) || removing > Math.max(25, Math.ceil(linked / 2))
}

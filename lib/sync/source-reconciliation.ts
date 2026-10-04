export function sourceRecordsMissingLocally<TSourceId extends string | number>(
  localSourceIds: readonly (TSourceId | null)[],
  currentSourceIds: readonly TSourceId[],
): TSourceId[] {
  const current = new Set(currentSourceIds)
  return localSourceIds.filter((id): id is TSourceId => id !== null && !current.has(id))
}

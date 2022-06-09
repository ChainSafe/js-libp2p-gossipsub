/**
 * Exclude up to `ineed` items from a set if item meets condition `cond`
 */
export function excludeItemsFromSet<T>(
  superSet: Set<T>,
  ineed: number,
  cond: (peer: T) => boolean = () => true
): Set<T> {
  let count = 0
  const subset = new Set<T>()
  if (ineed <= 0) return subset

  for (const id of superSet) {
    if (count >= ineed) break
    if (cond(id)) {
      subset.add(id)
      superSet.delete(id)
      count++
    }
  }

  return subset
}

/**
 * Exclude up to `ineed` items from a set
 */
export function excludeFirstNItemsFromSet<T>(superSet: Set<T>, ineed: number): Set<T> {
  return excludeItemsFromSet(superSet, ineed, () => true)
}

/**
 * Pseudo-randomly shuffles an array
 *
 * If k is specified, only the first k elements of the array are shuffled and returned
 *
 * Mutates the input array
 */
export function shuffle<T> (arr: T[], k?: number): T[] {
  // short circuit for trivial array
  if (arr.length <= 1) {
    return arr
  }

  const n = arr.length
  const K = Math.min(k ?? Infinity, n)
  for (let i = 0; i < K; i++) {
    const j = i + Math.floor(Math.random() * (n - i))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }

  if (k !== undefined) {
    return arr.slice(0, k)
  }
  return arr
}

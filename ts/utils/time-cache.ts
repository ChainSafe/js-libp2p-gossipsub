type SimpleTimeCacheOpts = {
  validityMs: number
}

/**
 * This is similar to https://github.com/daviddias/time-cache/blob/master/src/index.js
 * for our own need, we don't use lodash throttle to improve performance.
 * This gives 4x - 5x performance gain compared to npm TimeCache
 */
export class SimpleTimeCache {
  private entries: Map<string, number>;
  private validityMs: number;
  private lastPruneTime = 0;

  constructor (options: SimpleTimeCacheOpts) {
    this.entries = new Map()
    this.validityMs = options.validityMs

    if (this.validityMs <= 0) {
      throw Error(`Invalid validityMs ${this.validityMs}`)
    }
  }

  put (key: string): void {
    this.entries.set(key, Date.now())
    this.prune()
  }

  prune (): void {
    const now = Date.now()
    if (now - this.lastPruneTime < 200) {
      return
    }
    this.lastPruneTime = now

    for (const [k, v] of this.entries.entries()) {
      if (v + this.validityMs < now) {
        this.entries.delete(k)
      } else {
        // sort by insertion order
        break
      }
    }
  }

  has (key: string): boolean {
    return this.entries.has(key)
  }
}

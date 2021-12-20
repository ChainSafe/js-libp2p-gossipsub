type SimpleTimeCacheOpts = {
  validityMs: number
}

type CacheValue<T> = {
  value: T
  validUntilMs: number
}

/**
 * This is similar to https://github.com/daviddias/time-cache/blob/master/src/index.js
 * for our own need, we don't use lodash throttle to improve performance.
 * This gives 4x - 5x performance gain compared to npm TimeCache
 */
export class SimpleTimeCache<T> {
  private entries: Map<string, CacheValue<T>>;
  private validityMs: number;
  private lastPruneTime = 0;

  constructor (options: SimpleTimeCacheOpts) {
    this.entries = new Map()
    this.validityMs = options.validityMs

    if (this.validityMs <= 0) {
      throw Error(`Invalid validityMs ${this.validityMs}`)
    }
  }

  put (key: string, value: T): void {
    this.entries.set(key, { value, validUntilMs: Date.now() + this.validityMs })
    this.prune()
  }

  prune (): void {
    const now = Date.now()
    if (now - this.lastPruneTime < 200) {
      return
    }
    this.lastPruneTime = now

    for (const [k, v] of this.entries.entries()) {
      if (v.validUntilMs < now) {
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

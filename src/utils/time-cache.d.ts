declare type SimpleTimeCacheOpts = {
    validityMs: number;
};
/**
 * This is similar to https://github.com/daviddias/time-cache/blob/master/src/index.js
 * for our own need, we don't use lodash throttle to improve performance.
 * This gives 4x - 5x performance gain compared to npm TimeCache
 */
export declare class SimpleTimeCache<T> {
    private readonly entries;
    private readonly validityMs;
    constructor(opts: SimpleTimeCacheOpts);
    get size(): number;
    put(key: string, value: T): void;
    prune(): void;
    has(key: string): boolean;
    get(key: string): T | undefined;
    clear(): void;
}
export {};

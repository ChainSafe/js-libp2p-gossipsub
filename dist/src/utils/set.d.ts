/**
 * Exclude up to `ineed` items from a set if item meets condition `cond`
 */
export declare function removeItemsFromSet<T>(superSet: Set<T>, ineed: number, cond?: (peer: T) => boolean): Set<T>;
/**
 * Exclude up to `ineed` items from a set
 */
export declare function removeFirstNItemsFromSet<T>(superSet: Set<T>, ineed: number): Set<T>;
export declare class MapDef<K, V> extends Map<K, V> {
    private readonly getDefault;
    constructor(getDefault: () => V);
    getOrDefault(key: K): V;
}
//# sourceMappingURL=set.d.ts.map
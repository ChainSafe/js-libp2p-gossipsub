/**
 * Exclude up to `ineed` items from a set if item meets condition `cond`
 */
export function removeItemsFromSet(superSet, ineed, cond = () => true) {
    const subset = new Set();
    if (ineed <= 0)
        return subset;
    for (const id of superSet) {
        if (subset.size >= ineed)
            break;
        if (cond(id)) {
            subset.add(id);
            superSet.delete(id);
        }
    }
    return subset;
}
/**
 * Exclude up to `ineed` items from a set
 */
export function removeFirstNItemsFromSet(superSet, ineed) {
    return removeItemsFromSet(superSet, ineed, () => true);
}
export class MapDef extends Map {
    constructor(getDefault) {
        super();
        this.getDefault = getDefault;
    }
    getOrDefault(key) {
        let value = super.get(key);
        if (value === undefined) {
            value = this.getDefault();
            this.set(key, value);
        }
        return value;
    }
}
//# sourceMappingURL=set.js.map
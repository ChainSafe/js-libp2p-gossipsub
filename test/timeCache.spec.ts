import { expect } from 'aegir/chai'

describe.only('utils / TimeCache', function () {
  it('Map insertion order', () => {
    const key1 = 'key1'
    const key2 = 'key2'
    const key3 = 'key3'

    const map = new Map<string, number>()
    map.set(key1, Date.now())
    map.set(key2, Date.now())
    map.set(key3, Date.now())

    expect(Array.from(map.keys())).deep.equals([key1, key2, key3], 'Map iterator order')

    // Does not change key position
    map.set(key2, Date.now())

    expect(Array.from(map.keys())).deep.equals([key1, key2, key3], 'Map iterator order after re-set')

    // Changes key position
    map.delete(key2)
    map.set(key2, Date.now())

    expect(Array.from(map.keys())).deep.equals([key1, key3, key2], 'Map iterator order after delete set')
  })
})

import { expect } from 'chai'
import { excludeFirstNItemsFromSet, excludeItemsFromSet } from '../../src/utils/set.js'

describe('Set util', function () {
  describe('excludeItemsFromSet', function () {
    let s: Set<number>
    this.beforeEach(() => {
      s = new Set([1, 2, 3, 4, 5])
    })

    const testCases: { id: string; ineed: number; fn: (item: number) => boolean; result: Set<number> }[] = [
      { id: 'exclude even numbers - need 0', ineed: 0, fn: (item) => item % 2 === 0, result: new Set([]) },
      { id: 'exclude even numbers - need 1', ineed: 1, fn: (item) => item % 2 === 0, result: new Set([2]) },
      { id: 'exclude even numbers - need 2', ineed: 2, fn: (item) => item % 2 === 0, result: new Set([2, 4]) },
      { id: 'exclude even numbers - need 10', ineed: 2, fn: (item) => item % 2 === 0, result: new Set([2, 4]) },
    ]

    for (const { id, ineed, fn, result } of testCases) {
      it(id, () => {
        expect(excludeItemsFromSet(s, ineed, fn)).to.deep.equal(result)
      })
    }
  })

  describe('excludeFirstNItemsFromSet', function () {
    let s: Set<number>
    this.beforeEach(() => {
      s = new Set([1, 2, 3, 4, 5])
    })

    const testCases: { id: string; ineed: number; result: Set<number> }[] = [
      { id: 'exclude first 0 item', ineed: 0, result: new Set([]) },
      { id: 'exclude first 1 item', ineed: 1, result: new Set([1]) },
      { id: 'exclude first 2 item', ineed: 2, result: new Set([1, 2]) },
      { id: 'exclude first 10 item', ineed: 10, result: new Set([1, 2, 3, 4, 5]) },
    ]

    for (const { id, ineed, result } of testCases) {
      it(id, () => {
        expect(excludeFirstNItemsFromSet(s, ineed)).to.deep.equal(result)
      })
    }
  })
})

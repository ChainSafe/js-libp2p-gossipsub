import { expect } from 'chai'
import { createLinkedList, LinkedList } from '../../src/utils/array.js'

describe('LinkedList', () => {
  let list: LinkedList<number>

  beforeEach(() => {
    list = new LinkedList<number>()
  })

  it('pop', () => {
    expect(list.pop() === null)
    expect(list.length).to.be.equal(0)
    let count = 100
    for (let i = 0; i < count; i++) list.push(i + 1)

    while (count > 0) {
      expect(list.length).to.be.equal(count)
      expect(list.pop()).to.be.equal(count)
      count--
    }

    expect(list.pop() === null)
    expect(list.length).to.be.equal(0)
  })

  it('shift', () => {
    expect(list.shift() === null)
    expect(list.length).to.be.equal(0)
    const count = 100
    for (let i = 0; i < count; i++) list.push(i)

    for (let i = 0; i < count; i++) {
      expect(list.length).to.be.equal(count - i)
      expect(list.shift()).to.be.equal(i)
    }

    expect(list.shift() === null)
    expect(list.length).to.be.equal(0)
  })

  it('toArray', () => {
    expect(list.toArray()).to.be.deep.equal([])

    const count = 100
    for (let i = 0; i < count; i++) list.push(i)

    expect(list.length).to.be.equal(count)
    expect(list.toArray()).to.be.deep.equal(Array.from({ length: count }, (_, i) => i))
  })

  it('prune', () => {
    const count = 100
    for (let i = 0; i < count; i++) list.push(i)

    list.clear()

    expect(list.toArray()).to.be.deep.equal([])
    expect(list.length).to.be.equal(0)
  })

  describe('removeMultiple', () => {
    const arr = [1, 2, 3]
    const testCases: {
      id: string
      max: number
      cond: (t: number) => boolean
      result: number[]
      expected: number[]
      length: number
    }[] = [
      { id: 'delete 0', max: 1, cond: (t) => t === 1, result: [1], expected: [2, 3], length: 2 },
      { id: 'delete 1', max: 1, cond: (t) => t === 2, result: [2], expected: [1, 3], length: 2 },
      { id: 'delete 2', max: 1, cond: (t) => t === 3, result: [3], expected: [1, 2], length: 2 },
      { id: 'delete 0, 1', max: 2, cond: (t) => t === 1 || t === 2, result: [1, 2], expected: [3], length: 1 },
      { id: 'delete 0, 2', max: 2, cond: (t) => t === 1 || t === 3, result: [1, 3], expected: [2], length: 1 },
      { id: 'delete 1, 2', max: 2, cond: (t) => t === 2 || t === 3, result: [2, 3], expected: [1], length: 1 },
      { id: 'delete 1, 2, 3', max: 3, cond: (t) => true, result: [1, 2, 3], expected: [], length: 0 },
    ]
    for (const { id, max, cond, result, expected, length } of testCases) {
      it(id, () => {
        const list = createLinkedList(arr)
        const removedArr = list.findAndRemove(max, cond)
        expect(removedArr).to.be.deep.equal(result, 'wrong result')
        expect(list.toArray()).to.be.deep.equal(expected, 'wrong list')
        expect(list.length).to.be.deep.equal(length, 'wrong length')
      })
    }
  })
})

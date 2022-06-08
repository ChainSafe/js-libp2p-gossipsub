/**
 * The node for LinkedList below
 */
class Node<T> {
  data: T
  next: Node<T> | null = null
  prev: Node<T> | null = null

  constructor(data: T) {
    this.data = data
  }
}

/**
 * We want to use this if we only need push/pop/shift method
 * without random access.
 * The shift() method should be cheaper than regular array.
 */
export class LinkedList<T> {
  private _length: number
  private head: Node<T> | null
  private tail: Node<T> | null

  constructor() {
    this._length = 0
    this.head = null
    this.tail = null
  }

  get length(): number {
    return this._length
  }

  push(data: T): void {
    if (this._length === 0) {
      this.tail = this.head = new Node(data)
      this._length++
      return
    }

    if (!this.head || !this.tail) {
      // should not happen
      throw Error('No head or tail')
    }

    const newTail = new Node(data)
    this.tail.next = newTail
    newTail.prev = this.tail
    this.tail = newTail
    this._length++
  }

  pop(): T | null {
    const oldTail = this.tail
    if (!oldTail) return null
    this._length = Math.max(0, this._length - 1)

    if (this._length === 0) {
      this.head = this.tail = null
    } else {
      this.tail = oldTail.prev
      if (this.tail) this.tail.next = null
      oldTail.prev = oldTail.next = null
    }

    return oldTail.data
  }

  shift(): T | null {
    const oldHead = this.head
    if (!oldHead) return null
    this._length = Math.max(0, this._length - 1)

    if (this._length === 0) {
      this.head = this.tail = null
    } else {
      this.head = oldHead.next
      if (this.head) this.head.prev = null
      oldHead.prev = oldHead.next = null
    }

    return oldHead.data
  }

  clear(): void {
    this.head = this.tail = null
    this._length = 0
  }

  toArray(): T[] {
    let node = this.head
    if (!node) return []

    const arr: T[] = []
    while (node) {
      arr.push(node.data)
      node = node.next
    }

    return arr
  }

  map<U>(fn: (t: T) => U): U[] {
    let node = this.head
    if (!node) return []

    const arr: U[] = []
    while (node) {
      arr.push(fn(node.data))
      node = node.next
    }

    return arr
  }

  /**
   * Remove up to `max` items if condition `cond` is met.
   */
  removeMultiple(max: number, cond: (t: T, i: number) => boolean): T[] {
    let node = this.head
    if (!node) return []
    let count = 0
    let index = 0
    const arr: T[] = []

    while (count < max && node) {
      if (cond(node.data, index)) {
        count++
        arr.push(node.data)

        // remove
        if (node.prev) {
          node.prev.next = node.next
        } else {
          // no prev, this is head
          this.head = node.next
        }
        if (node.next) {
          node.next.prev = node.prev
        } else {
          // no next, this is tail
          this.tail = node.prev
        }

        // remove link
        const removedNode = node
        node = node.next
        removedNode.next = null
        removedNode.prev = null

        // update length
        this._length--
      } else {
        // not meet cond, only move to next node
        node = node.next
      }

      index++
    }
    return arr
  }
}

export function createLinkedList<T>(arr: T[]): LinkedList<T> {
  const list = new LinkedList<T>()

  for (const item of arr) {
    list.push(item)
  }

  return list
}

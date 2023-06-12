import { LinkedList } from './linkedList.js'

export class PushableAbortable {
  private readonly items = new LinkedList<Uint8Array>()
  private error: Error | null = null
  private done = false
  private onNext: () => void | null = null
  private _bufferSize = 0

  get bufferSize(): number {
    return this._bufferSize
  }

  push(item: Uint8Array): void {
    this.items.push(item)
    this._bufferSize += item.length
    this.onNext?.()
  }

  abort(err?: Error): void {
    if (err) {
      this.error = err
    } else {
      this.done = true
    }
    this.onNext?.()
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    return {
      async next() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const item = self.items.shift()
          if (item !== null) {
            self._bufferSize -= item.length
            return { value: item, done: false }
          }

          if (self.error) {
            throw self.error
          }

          if (self.done) {
            // Is it correct to return undefined on done: true?
            return { value: undefined as unknown as Uint8Array, done: true }
          }

          await new Promise<void>((resolve) => {
            self.onNext = resolve
          })
          self.onNext = null
        }
      },

      async return() {
        // This will be reached if the consumer called 'break' or 'return' early in the loop.
        return { value: undefined, done: true }
      }
    }
  }
}

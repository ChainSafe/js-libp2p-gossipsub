import { abortableSource } from 'abortable-iterator'

async function test() {
  class SourceTest implements AsyncGenerator<number, number, unknown> {
    value = 0
    returned = false
    thrown: null | Error = null

    isDone() {
      return this.value > 10
    }

    async next() {
      await new Promise((r) => setTimeout(r, 1000000))
      return { done: this.isDone(), value: this.value++ }
    }

    async return() {
      this.returned = true
      return { done: true, value: this.value }
    }

    async throw(e: Error) {
      this.thrown = e
      return { done: true, value: this.value }
    }

    [Symbol.asyncIterator]() {
      return this
    }
  }

  const source = new SourceTest()

  const controller = new AbortController()
  const sourceAbortable = abortableSource(source, controller.signal)

  setTimeout(() => controller.abort(), 2000)

  try {
    for await (const item of sourceAbortable) {
      console.log(item)
    }
  } catch (e) {
    console.log('for await thrown error', e)
  }

  console.log(source)
}

test()

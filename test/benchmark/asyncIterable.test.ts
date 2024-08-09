import { itBench } from '@dapplion/benchmark'
import { abortableSource } from 'abortable-iterator'
import { pipe, Transform } from 'it-pipe'
import all from 'it-all'

/* eslint-disable generator-star-spacing */

describe('abortableSource cost', function () {
  const n = 10000
  const bytes = new Uint8Array(200)
  const controller = new AbortController()

  async function* bytesSource() {
    let i = 0
    while (i++ < n) {
      yield bytes
    }
  }

  for (let k = 0; k < 5; k++) {
    itBench({
      id: `async iterate abortable x${k} bytesSource ${n}`,
      beforeEach: () => {
        let source = bytesSource()
        for (let i = 0; i < k; i++) {
          source = abortableSource(source, controller.signal)
        }
        return source
      },
      fn: async (source) => {
        for await (const chunk of source) {
          // eslint-disable-next-line no-unused-expressions
          chunk
        }
      }
    })
  }
})

describe('pipe extra iterables cost', function () {
  const n = 10000

  async function* numberSource() {
    let i = 0
    while (i < n) {
      yield i++
    }
  }

  async function* numberTransform(source: AsyncIterable<number>): AsyncIterable<number> {
    for await (const num of source) {
      yield num + 1
    }
  }

  itBench({
    id: `async iterate pipe x0 transforms ${n}`,
    fn: async () => {
      await pipe(numberSource, all)
    }
  })

  itBench({
    id: `async iterate pipe x1 transforms ${n}`,
    fn: async () => {
      await pipe(numberSource, numberTransform as Transform<number, number>, all)
    }
  })

  itBench({
    id: `async iterate pipe x2 transforms ${n}`,
    fn: async () => {
      await pipe(
        numberSource,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        all
      )
    }
  })

  itBench({
    id: `async iterate pipe x4 transforms ${n}`,
    fn: async () => {
      await pipe(
        numberSource,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        all
      )
    }
  })

  itBench({
    id: `async iterate pipe x8 transforms ${n}`,
    fn: async () => {
      await pipe(
        numberSource,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        numberTransform as Transform<number, number>,
        all
      )
    }
  })
})
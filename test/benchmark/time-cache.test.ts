import { itBench, setBenchOpts } from '@dapplion/benchmark'
import TimeCache from 'time-cache'
import { SimpleTimeCache } from '../../ts/utils/time-cache'

describe('npm TimeCache vs SimpleTimeCache', () => {
  setBenchOpts({
    maxMs: 100 * 1000,
    minMs: 60 * 1000,
    runs: 512
  })

  const iterations = [1_000_000, 4_000_000, 8_000_000, 16_000_000]
  const timeCache = new TimeCache({ validity: 1 })
  const simpleTimeCache = new SimpleTimeCache({ validityMs: 1000 })

  for (const iteration of iterations) {
    itBench(`npm TimeCache.put x${iteration}`, () => {
      for (let j = 0; j < iteration; j++) timeCache.put(String(j))
    })

    itBench(`SimpleTimeCache.put x${iteration}`, () => {
      for (let j = 0; j < iteration; j++) simpleTimeCache.put(String(j))
    })
  }
})

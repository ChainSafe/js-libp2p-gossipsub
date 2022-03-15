const { expect } = require('chai')
const { SimpleTimeCache } = require('../src/utils/time-cache')
const sinon = require('sinon')

describe('SimpleTimeCache', () => {
  const validityMs = 1000
  const timeCache = new SimpleTimeCache({ validityMs })
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    sandbox.useFakeTimers()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should delete items after 1sec', () => {
    timeCache.put('aFirst')
    timeCache.put('bFirst')
    timeCache.put('cFirst')

    expect(timeCache.has('aFirst')).to.be.true
    expect(timeCache.has('bFirst')).to.be.true
    expect(timeCache.has('cFirst')).to.be.true

    sandbox.clock.tick(validityMs + 1)

    timeCache.put('aSecond')
    timeCache.put('bSecond')
    timeCache.put('cSecond')

    expect(timeCache.has('aSecond')).to.be.true
    expect(timeCache.has('bSecond')).to.be.true
    expect(timeCache.has('cSecond')).to.be.true
    expect(timeCache.has('aFirst')).to.be.false
    expect(timeCache.has('bFirst')).to.be.false
    expect(timeCache.has('cFirst')).to.be.false
  })
})

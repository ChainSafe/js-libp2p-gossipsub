'use strict'
/* eslint-env mocha */

const { expect } = require('chai')

const Gossipsub = require('../src')
const { GossipSubHeartbeatInterval } = require('../src/constants')
const { createPeerId, mockRegistrar } = require('./utils')

describe('heartbeat', () => {
  let gossipsub

  before(async () => {
    const peerId = await createPeerId()
    gossipsub = new Gossipsub(peerId, mockRegistrar, { emitSelf: true })
    await gossipsub.start()
  })

  after(() => gossipsub.stop())

  it('should occur with regularity defined by a constant', async function () {
    this.timeout(3000)
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t1 = Date.now()
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t2 = Date.now()
    const safeDelta = 100 // ms
    expect(t2 - t1).to.be.lt(GossipSubHeartbeatInterval + safeDelta)
  })
})

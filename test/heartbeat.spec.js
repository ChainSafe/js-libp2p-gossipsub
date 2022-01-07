'use strict'
/* eslint-env mocha */

const { expect } = require('chai')

const Gossipsub = require('../src')
const { GossipsubHeartbeatInterval } = require('../src/constants')
const {
  createPeer,
  startNode,
  stopNode,
  fastMsgIdFn,
} = require('./utils')

describe('heartbeat', () => {
  let gossipsub

  before(async () => {
    gossipsub = new Gossipsub(await createPeer({ started: false }), { emitSelf: true, fastMsgIdFn })
    await startNode(gossipsub)
  })

  after(() => stopNode(gossipsub))

  it('should occur with regularity defined by a constant', async function () {
    this.timeout(3000)
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t1 = Date.now()
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t2 = Date.now()
    const safeDelta = 100 // ms
    expect(t2 - t1).to.be.lt(GossipsubHeartbeatInterval + safeDelta)
  })
})

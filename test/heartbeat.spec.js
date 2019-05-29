'use strict'
/* eslint-env mocha */

const { expect } = require('chai')

const { GossipSubHeartbeatInterval } = require('../src/constants')
const {
  createNode,
  startNode,
  stopNode
} = require('./utils')

describe('heartbeat', () => {
  let nodeA
  before(async () => {
    nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
    await startNode(nodeA)
    await startNode(nodeA.gs)
  })
  after(async () => {
    await stopNode(nodeA.gs)
    await stopNode(nodeA)
  })

  it('should occur with regularity defined by a constant', async function () {
    this.timeout(3000)
    await new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve))
    const t1 = Date.now()
    await new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve))
    const t2 = Date.now()
    const safeDelta = 100 // ms
    expect(t2 - t1).to.be.lt(GossipSubHeartbeatInterval + safeDelta)
  })
})

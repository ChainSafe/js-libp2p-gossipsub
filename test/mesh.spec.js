'use strict'
/* eslint-env mocha */

const { expect } = require('chai')
const delay = require('delay')

const { GossipsubDhi, GossipsubIDv11: multicodec } = require('../src/constants')
const { createGossipsubs, connectGossipsubs, stopNode } = require('./utils')

describe('mesh overlay', () => {
  let nodes

  // Create pubsub nodes
  beforeEach(async () => {
    nodes = await createGossipsubs({
      number: GossipsubDhi + 2,
      options: { scoreParams: { IPColocationFactorThreshold: GossipsubDhi + 3 } }
    })
  })

  afterEach(() => Promise.all(nodes.map(stopNode)))

  it('should add mesh peers below threshold', async function () {
    this.timeout(10e3)

    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((node) => node.subscribe(topic))

    // connect N (< GossipsubD) nodes to node0
    const N = 4
    await connectGossipsubs(nodes.slice(0, N + 1))

    await delay(50)
    // await mesh rebalancing
    await new Promise((resolve) => node0.once('gossipsub:heartbeat', resolve))

    expect(node0.mesh.get(topic).size).to.equal(N)
  })

  it('should remove mesh peers once above threshold', async function () {
    this.timeout(10e4)
    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((node) => node.subscribe(topic))

    await connectGossipsubs(nodes)

    await delay(500)
    // await mesh rebalancing
    await new Promise((resolve) => node0.once('gossipsub:heartbeat', resolve))
    expect(node0.mesh.get(topic).size).to.be.lte(GossipsubDhi)
  })
})

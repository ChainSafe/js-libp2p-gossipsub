'use strict'
/* eslint-env mocha */

const { expect } = require('chai')

const { GossipSubDhi, GossipSubID: multicodec } = require('../src/constants')
const {
  createGossipsubNodes,
  ConnectionPair
} = require('./utils')

describe('mesh overlay', () => {
  let nodes, registrarRecords

  // Create pubsub nodes
  beforeEach(async () => {
    ({
      nodes,
      registrarRecords
    } = await createGossipsubNodes(GossipSubDhi + 2, true))
  })

  afterEach(() => Promise.all(nodes.map((n) => n.stop())))

  it('should add mesh peers below threshold', async function () {
    this.timeout(10e3)

    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((node) => node.subscribe(topic))

    // connect N (< GossipsubD) nodes to node0
    const N = 4
    const onConnect0 = registrarRecords[0][multicodec].onConnect

    for (let i = nodes.length; i > nodes.length - N; i--) {
      const n = i - 1
      const onConnectN = registrarRecords[n][multicodec].onConnect

      // Notice peers of connection
      const [d0, d1] = ConnectionPair()
      onConnect0(nodes[n].peerInfo, d0)
      onConnectN(nodes[0].peerInfo, d1)
    }

    // await mesh rebalancing
    await new Promise((resolve) => node0.once('gossipsub:heartbeat', resolve))

    expect(node0.mesh.get(topic).size).to.equal(N)
  })

  it('should remove mesh peers once above threshold', async function () {
    this.timeout(10e3)
    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((node) => node.subscribe(topic))

    const onConnect0 = registrarRecords[0][multicodec].onConnect

    // connect all nodes to node0
    for (let i = 1; i < nodes.length; i++) {
      const onConnectN = registrarRecords[i][multicodec].onConnect

      // Notice peers of connection
      const [d0, d1] = ConnectionPair()
      onConnect0(nodes[i].peerInfo, d0)
      onConnectN(nodes[0].peerInfo, d1)
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await new Promise((resolve) => node0.once('gossipsub:heartbeat', resolve))
    expect(node0.mesh.get(topic).size).to.be.lte(GossipSubDhi)
  })
})

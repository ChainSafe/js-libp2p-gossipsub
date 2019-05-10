'use strict'
/* eslint-env mocha */

const { expect } = require('chai')

const { GossipSubDhi } = require('../src/constants')
const {
  createNode,
  dialNode,
  startNode,
  stopNode
} = require('./utils')

describe('mesh overlay', () => {
  let nodes = Array.from({ length: GossipSubDhi + 2 }) // enough nodes to trigger high threshold

  beforeEach(async () => {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i] = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodes[i])
      await startNode(nodes[i].gs)
    }
  })
  afterEach(async function () {
    this.timeout(10000)
    await Promise.all(nodes.map((n) => stopNode(n.gs)))
    await Promise.all(nodes.map((n) => stopNode(n)))
  })

  it('should add mesh peers below threshold', async function () {
    this.timeout(3000)
    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.gs.subscribe(topic))
    // connect N (< GossipsubD) nodes to node0
    const N = 4
    await Promise.all(nodes.slice(nodes.length - N).map((n) => dialNode(n, node0.peerInfo)))
    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await new Promise((resolve) => node0.gs.once('gossipsub:heartbeat', resolve))
    expect(node0.gs.mesh.get(topic).size).to.equal(N)
  })
  it('should remove mesh peers once above threshold', async function () {
    this.timeout(0)
    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.gs.subscribe(topic))
    // connect all nodes to node0
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        await dialNode(nodes[i], nodes[j].peerInfo)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await new Promise((resolve) => node0.gs.once('gossipsub:heartbeat', resolve))
    expect(node0.gs.mesh.get(topic).size).to.be.lt(GossipSubDhi)
  })
})

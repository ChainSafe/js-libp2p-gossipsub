'use strict'
/* eslint-env mocha */

const { Buffer } = require('buffer')
const { expect } = require('chai')
const sinon = require('sinon')

const { GossipsubDhi } = require('../src/constants')
const {
  first,
  createGossipsubs,
  connectGossipsubs,
  stopNode
} = require('./utils')

describe('gossip', () => {
  let nodes

  // Create pubsub nodes
  beforeEach(async () => {
    nodes = await createGossipsubs({ number: GossipsubDhi + 2, options: { scoreParams: { IPColocationFactorThreshold: GossipsubDhi + 3 } } })
  })

  afterEach(() => Promise.all(nodes.map(stopNode)))

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10000)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    await connectGossipsubs(nodes)
    // await subscription propagation
    await new Promise((resolve) => setTimeout(resolve, 50))

    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await new Promise((resolve) => setTimeout(resolve, 500))
    // set spy
    sinon.spy(nodeA, '_pushGossip')

    await nodeA.publish(topic, Buffer.from('hey'))

    await new Promise((resolve) => nodeA.once('gossipsub:heartbeat', resolve))

    nodeA._pushGossip.getCalls()
      .map((call) => call.args[0])
      .forEach((peer) => {
        const peerId = peer.id.toB58String()
        nodeA.mesh.get(topic).forEach((meshPeer) => {
          expect(meshPeer.id.toB58String()).to.not.equal(peerId)
        })
      })

    // unset spy
    nodeA._pushGossip.restore()
  })

  it('should send piggyback control into other sent messages', async function () {
    this.timeout(10000)
    const nodeA = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    // every node connected to every other
    await connectGossipsubs(nodes)
    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await new Promise((resolve) => setTimeout(resolve, 500))

    const peerB = first(nodeA.mesh.get(topic))
    const nodeB = nodes.find((n) => n.peerId.toB58String() === peerB.id.toB58String())

    // set spy
    sinon.spy(nodeA, '_piggybackControl')

    // manually add control message to be sent to peerB
    const graft = { graft: [{ topicID: topic }] }
    nodeA.control.set(peerB, graft)

    await nodeA.publish(topic, Buffer.from('hey'))

    expect(nodeA._piggybackControl.callCount).to.be.equal(1)
    // expect control message to be sent alongside published message
    const call = nodeA._piggybackControl.getCalls()[0]
    expect(call.args[2].graft).to.deep.equal(graft.graft)

    // unset spy
    nodeA._piggybackControl.restore()
  })
})

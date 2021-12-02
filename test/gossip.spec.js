'use strict'
/* eslint-env mocha */

const { expect } = require('chai')
const sinon = require('sinon')
const delay = require('delay')
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string')

const { GossipsubDhi } = require('../src/constants')
const {
  first,
  createGossipsubs,
  connectGossipsubs,
  stopNode,
  waitForAllNodesToBePeered
} = require('./utils')

describe('gossip', () => {
  let nodes

  // Create pubsub nodes
  beforeEach(async () => {
    nodes = await createGossipsubs({ number: GossipsubDhi + 2, options: { scoreParams: { IPColocationFactorThreshold: GossipsubDhi + 3 } } })
  })

  afterEach(() => Promise.all(nodes.map(stopNode)))

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    // every node connected to every other
    await connectGossipsubs(nodes)
    await waitForAllNodesToBePeered(nodes)

    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await delay(500)
    // set spy
    sinon.spy(nodeA, '_pushGossip')

    await nodeA.publish(topic, uint8ArrayFromString('hey'))

    await new Promise((resolve) => nodeA.once('gossipsub:heartbeat', resolve))

    nodeA._pushGossip.getCalls()
      .map((call) => call.args[0])
      .forEach((peerId) => {
        nodeA.mesh.get(topic).forEach((meshPeerId) => {
          expect(meshPeerId).to.not.equal(peerId)
        })
      })

    // unset spy
    nodeA._pushGossip.restore()
  })

  it('should send piggyback control into other sent messages', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    // every node connected to every other
    await connectGossipsubs(nodes)
    await waitForAllNodesToBePeered(nodes)

    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await delay(500)

    const peerB = first(nodeA.mesh.get(topic))
    const nodeB = nodes.find((n) => n.peerId.toB58String() === peerB)

    // set spy
    sinon.spy(nodeA, '_piggybackControl')

    // manually add control message to be sent to peerB
    const graft = { graft: [{ topicID: topic }] }
    nodeA.control.set(peerB, graft)

    await nodeA.publish(topic, uint8ArrayFromString('hey'))

    expect(nodeA._piggybackControl.callCount).to.be.equal(1)
    // expect control message to be sent alongside published message
    const call = nodeA._piggybackControl.getCalls()[0]
    expect(call.args[2].graft).to.deep.equal(graft.graft)

    // unset spy
    nodeA._piggybackControl.restore()
  })
})

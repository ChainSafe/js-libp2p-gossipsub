'use strict'
/* eslint-env mocha */

const { expect } = require('chai')
const sinon = require('sinon')
const uint8ArrayFromString = require('uint8arrays/from-string')

const { GossipsubID: multicodec, GossipsubDhi } = require('../src/constants')
const {
  first,
  createGossipsubNodes,
  connectGossipsubNodes
} = require('./utils')

describe('gossip', () => {
  let nodes, registrarRecords

  // Create pubsub nodes
  beforeEach(async () => {
    ({
      nodes,
      registrarRecords
    } = await createGossipsubNodes(GossipsubDhi + 2, true))
  })

  afterEach(() => Promise.all(nodes.map((n) => n.stop())))

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10000)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    await connectGossipsubNodes(nodes, registrarRecords, multicodec)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await new Promise((resolve) => setTimeout(resolve, 500))
    // set spy
    sinon.spy(nodeA, 'log')

    await nodeA.publish(topic, uint8ArrayFromString('hey'))

    await new Promise((resolve) => nodeA.once('gossipsub:heartbeat', resolve))

    expect(nodeA.log.callCount).to.be.gt(1)
    nodeA.log.getCalls()
      .filter((call) => call.args[0] === 'Add gossip to %s')
      .map((call) => call.args[1])
      .forEach((peerId) => {
        nodeA.mesh.get(topic).forEach((meshPeer) => {
          expect(meshPeer.id.toB58String()).to.not.equal(peerId)
        })
      })

    // unset spy
    nodeA.log.restore()
  })

  it('should send piggyback gossip into other sent messages', async function () {
    this.timeout(10000)
    const nodeA = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    // every node connected to every other
    await connectGossipsubNodes(nodes, registrarRecords, multicodec)
    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await new Promise((resolve) => setTimeout(resolve, 500))

    const peerB = first(nodeA.mesh.get(topic))
    const nodeB = nodes.find((n) => n.peerId.toB58String() === peerB.id.toB58String())

    // set spy
    sinon.spy(nodeB, 'log')

    // manually add control message to be sent to peerB
    nodeA.control.set(peerB, { graft: [{ topicID: topic }] })

    await nodeA.publish(topic, uint8ArrayFromString('hey'))

    await new Promise((resolve) => nodeA.once('gossipsub:heartbeat', resolve))
    expect(nodeB.log.callCount).to.be.gt(1)
    // expect control message to be sent alongside published message
    const call = nodeB.log.getCalls().find((call) => call.args[0] === 'GRAFT: Add mesh link from %s in %s')
    expect(call).to.not.equal(undefined)
    expect(call.args[1]).to.equal(nodeA.peerId.toB58String())

    // unset spy
    nodeB.log.restore()
  })
})

'use strict'
/* eslint-env mocha */

const { expect } = require('chai')
const sinon = require('sinon')

const { GossipSubDhi } = require('../src/constants')
const {
  first,
  createNode,
  dialNode,
  startNode,
  stopNode
} = require('./utils')

describe('gossip', () => {
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

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10000)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.gs.subscribe(topic))
    // every node connected to every other
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        await dialNode(nodes[i], nodes[j].peerInfo)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.gs.once('gossipsub:heartbeat', resolve))))
    await new Promise((resolve) => setTimeout(resolve, 500))
    // set spy
    sinon.spy(nodeA.gs, 'log')

    nodeA.gs.publish(topic, Buffer.from('hey'))
    await new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve))
    expect(nodeA.gs.log.callCount).to.be.gt(1)
    nodeA.gs.log.getCalls()
      .filter((call) => call.args[0] === 'Add gossip to %s')
      .map((call) => call.args[1])
      .forEach((peerId) => {
        nodeA.gs.mesh.get(topic).forEach((meshPeer) => {
          expect(meshPeer.info.id.toB58String()).to.not.equal(peerId)
        })
      })

    // unset spy
    nodeA.gs.log.restore()
  })

  it('should send piggyback gossip into other sent messages', async function () {
    this.timeout(10000)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.gs.subscribe(topic))
    // every node connected to every other
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        await dialNode(nodes[i], nodes[j].peerInfo)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.gs.once('gossipsub:heartbeat', resolve))))
    await new Promise((resolve) => setTimeout(resolve, 500))

    const peerB = first(nodeA.gs.mesh.get(topic))
    const nodeB = nodes.find((n) => n.peerInfo.id.toB58String() === peerB.info.id.toB58String())
    // set spy
    sinon.spy(nodeB.gs, 'log')

    // manually add control message to be sent to peerB
    nodeA.gs.control.set(peerB, { graft: [{ topicID: topic }] })
    nodeA.gs.publish(topic, Buffer.from('hey'))
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(nodeB.gs.log.callCount).to.be.gt(1)
    // expect control message to be sent alongside published message
    const call = nodeB.gs.log.getCalls().find((call) => call.args[0] === 'GRAFT: Add mesh link from %s in %s')
    expect(call).to.not.equal(undefined)
    expect(call.args[1]).to.equal(nodeA.peerInfo.id.toB58String())

    // unset spy
    nodeB.gs.log.restore()
  })
})

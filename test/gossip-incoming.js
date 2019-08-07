/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect

const {
  createNode,
  dialNode,
  startNode,
  stopNode
} = require('./utils')

const shouldNotHappen = (msg) => expect.fail()

describe('gossip incoming', () => {
  const topic = 'Z'
  let nodeA
  let nodeB
  let nodeC

  describe('gossipIncoming == true', () => {
    beforeEach(async function () {
      this.timeout(4000)
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeC = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)
      await startNode(nodeC)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs),
        startNode(nodeC.gs)
      ])
      await dialNode(nodeA, nodeB.peerInfo)
      await dialNode(nodeB, nodeC.peerInfo)

      nodeA.gs.subscribe(topic)
      nodeB.gs.subscribe(topic)
      nodeC.gs.subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodeA.gs.once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeC.gs.once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs),
        stopNode(nodeC.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB),
        stopNode(nodeC)
      ])
    })

    it('should gossip incoming messages', async () => {
      const promise = new Promise((resolve) => nodeC.gs.once(topic, resolve))
      nodeA.gs.once(topic, (m) => shouldNotHappen)

      nodeA.gs.publish(topic, Buffer.from('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodeA.gs.libp2p.peerInfo.id.toB58String())

      nodeA.gs.removeListener(topic, shouldNotHappen)
    })
  })

  describe('gossipIncoming == false', () => {
    beforeEach(async function () {
      this.timeout(4000)
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0', { gossipIncoming: false })
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0', { gossipIncoming: false })
      nodeC = await createNode('/ip4/127.0.0.1/tcp/0', { gossipIncoming: false })
      await startNode(nodeA)
      await startNode(nodeB)
      await startNode(nodeC)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs),
        startNode(nodeC.gs)
      ])
      await dialNode(nodeA, nodeB.peerInfo)
      await dialNode(nodeB, nodeC.peerInfo)

      nodeA.gs.subscribe(topic)
      nodeB.gs.subscribe(topic)
      nodeC.gs.subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodeA.gs.once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeC.gs.once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs),
        stopNode(nodeC.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB),
        stopNode(nodeC)
      ])
    })

    it('should not gossip incoming messages', async () => {
      nodeC.gs.once(topic, (m) => shouldNotHappen)

      nodeA.gs.publish(topic, Buffer.from('hey'))

      await new Promise((resolve) => setTimeout(resolve, 1000))

      nodeC.gs.removeListener(topic, shouldNotHappen)
    })
  })
})

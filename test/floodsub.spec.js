/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

const delay = require('delay')
const uint8ArrayFromString = require('uint8arrays/from-string')

const PeerId = require('peer-id')

const Gossipsub = require('../src')
const {
  createPeer,
  createFloodsubNode,
  expectSet,
  first,
  startNode,
  stopNode
} = require('./utils')

describe('gossipsub fallbacks to floodsub', () => {
  describe('basics', () => {
    let nodeGs
    let nodeFs

    beforeEach(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([
        startNode(nodeGs),
        startNode(nodeFs)
      ])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Dial event happened from nodeGs to nodeFs', async () => {
      await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)
      expect(nodeGs.peers.size).to.equal(1)
      expect(nodeFs.peers.size).to.equal(1)
    })
  })

  describe('should not be added if fallback disabled', () => {
    let nodeGs
    let nodeFs

    before(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: false })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([
        startNode(nodeGs),
        startNode(nodeFs)
      ])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Dial event happened from nodeGs to nodeFs, but NodeGs does not support floodsub', async () => {
      try {
        await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)
        expect.fail('Dial should not have succeed')
      } catch (err) {
        expect(err.code).to.be.equal('ERR_UNSUPPORTED_PROTOCOL')
      }
    })
  })

  describe('subscription functionality', () => {
    let nodeGs
    let nodeFs

    before(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([
        startNode(nodeGs),
        startNode(nodeFs)
      ])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
      await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Subscribe to a topic', async function () {
      this.timeout(10000)
      const topic = 'Z'
      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      const [changedPeerId, changedSubs] = await new Promise((resolve) => {
        nodeGs.once('pubsub:subscription-change', (...args) => resolve(args))
      })
      await delay(1000)

      expectSet(nodeGs.subscriptions, [topic])
      expectSet(nodeFs.subscriptions, [topic])
      expect(nodeGs.peers.size).to.equal(1)
      expect(nodeFs.peers.size).to.equal(1)
      expectSet(nodeGs.topics.get(topic), [nodeFs.peerId.toB58String()])
      expectSet(nodeFs.topics.get(topic), [nodeGs.peerId.toB58String()])

      expect(changedPeerId.toB58String()).to.equal(first(nodeGs.peers).id.toB58String())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topicID).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)
    })
  })

  describe('publish functionality', () => {
    let nodeGs
    let nodeFs
    const topic = 'Z'

    beforeEach(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([
        startNode(nodeGs),
        startNode(nodeFs)
      ])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
      await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)

      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      await Promise.all([
        new Promise((resolve) => nodeGs.once('pubsub:subscription-change', resolve)),
        new Promise((resolve) => nodeFs.once('pubsub:subscription-change', resolve))
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Publish to a topic - nodeGs', async () => {
      const shouldNotHappen = () => {
        done(new Error('Should not be here'))
      }

      const promise = new Promise((resolve) => nodeFs.once(topic, resolve))
      nodeGs.once(topic, (m) => shouldNotHappen)

      nodeGs.publish(topic, uint8ArrayFromString('hey'))

      const msg = await promise
      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodeGs.peerId.toB58String())

      nodeGs.removeListener(topic, shouldNotHappen)
    })

    it('Publish to a topic - nodeFs', async () => {
      const promise = new Promise((resolve) => nodeGs.once(topic, resolve))

      nodeFs.publish(topic, uint8ArrayFromString('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodeFs.peerId.toB58String())
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeGs
    let nodeFs
    const topic = 'Z'

    beforeEach(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([
        startNode(nodeGs),
        startNode(nodeFs)
      ])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
      await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)

      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      await Promise.all([
        new Promise((resolve) => nodeGs.once('pubsub:subscription-change', resolve)),
        new Promise((resolve) => nodeFs.once('pubsub:subscription-change', resolve))
      ])
      // allow subscriptions to propagate to the other peer
      await delay(10)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Unsubscribe from a topic', async () => {
      nodeGs.unsubscribe(topic)
      expect(nodeGs.subscriptions.size).to.equal(0)

      const [changedPeerId, changedSubs] = await new Promise((resolve) => {
        nodeFs.once('pubsub:subscription-change', (...args) => resolve(args))
      })

      expect(nodeFs.peers.size).to.equal(1)
      expectSet(nodeFs.topics.get(topic), [])
      expect(changedPeerId.toB58String()).to.equal(first(nodeFs.peers).id.toB58String())
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: false }])
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeGs.unsubscribe(topic)
      await new Promise((resolve) => nodeFs.once('pubsub:subscription-change', resolve))

      const promise = new Promise((resolve, reject) => {
        nodeGs.once(topic, reject)
        setTimeout(() => {
          nodeGs.removeListener(topic, reject)
          resolve()
        }, 100)
      })

      nodeFs.publish('Z', uint8ArrayFromString('banana'))
      nodeGs.publish('Z', uint8ArrayFromString('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })
})

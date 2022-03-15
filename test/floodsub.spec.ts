import chai from 'chai'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import PeerId from 'peer-id'
import FloodSub from 'libp2p-floodsub'
import Gossipsub from '../ts'
import { createPeer, createFloodsubNode, expectSet, first, startNode, stopNode } from './utils'
import { RPC } from '../ts/message/rpc'
import { GossipsubMessage } from '../ts/types'

const expect = chai.expect
chai.use(require('dirty-chai'))

describe('gossipsub fallbacks to floodsub', () => {
  describe('basics', () => {
    let nodeGs: Gossipsub
    let nodeFs: FloodSub

    beforeEach(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([startNode(nodeGs), startNode(nodeFs)])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([stopNode(nodeGs), stopNode(nodeFs)])
    })

    it('Dial event happened from nodeGs to nodeFs', async () => {
      await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)
      expect(nodeGs['peers'].size).to.equal(1)
      expect(nodeFs.peers.size).to.equal(1)
    })
  })

  describe('should not be added if fallback disabled', () => {
    let nodeGs: Gossipsub
    let nodeFs: FloodSub

    before(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: false })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([startNode(nodeGs), startNode(nodeFs)])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([stopNode(nodeGs), stopNode(nodeFs)])
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
    let nodeGs: Gossipsub
    let nodeFs: FloodSub

    before(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([startNode(nodeGs), startNode(nodeFs)])
      nodeGs._libp2p.peerStore.addressBook.set(nodeFs._libp2p.peerId, nodeFs._libp2p.multiaddrs)
      await nodeGs._libp2p.dialProtocol(nodeFs._libp2p.peerId, nodeGs.multicodecs)
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([stopNode(nodeGs), stopNode(nodeFs)])
    })

    it('Subscribe to a topic', async function () {
      this.timeout(10000)
      const topic = 'Z'
      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      const [changedPeerId, changedSubs] = await new Promise<[PeerId, RPC.ISubOpts[]]>((resolve) => {
        nodeGs.once('pubsub:subscription-change', (...args: [PeerId, RPC.ISubOpts[]]) => resolve(args))
      })
      await delay(1000)

      expectSet(nodeGs['subscriptions'], [topic])
      expectSet(nodeFs.subscriptions, [topic])
      expect(nodeGs['peers'].size).to.equal(1)
      expect(nodeFs.peers.size).to.equal(1)
      expectSet(nodeGs['topics'].get(topic), [nodeFs.peerId.toB58String()])
      expectSet(nodeFs.topics.get(topic), [nodeGs.peerId.toB58String()])

      expect(changedPeerId.toB58String()).to.equal(first(nodeGs['peers']).id.toB58String())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topicID).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)
    })
  })

  describe('publish functionality', () => {
    let nodeGs: Gossipsub
    let nodeFs: FloodSub
    const topic = 'Z'

    beforeEach(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([startNode(nodeGs), startNode(nodeFs)])
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
      await Promise.all([stopNode(nodeGs), stopNode(nodeFs)])
    })

    it('Publish to a topic - nodeGs', async () => {
      const promise = new Promise<GossipsubMessage>((resolve) => nodeFs.once(topic, resolve))

      nodeGs.publish(topic, uint8ArrayFromString('hey'))

      const msg = await promise
      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodeGs.peerId.toB58String())
    })

    it('Publish to a topic - nodeFs', async () => {
      const promise = new Promise<GossipsubMessage>((resolve) => nodeGs.once(topic, resolve))

      nodeFs.publish(topic, uint8ArrayFromString('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodeFs.peerId.toBytes())
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeGs: Gossipsub
    let nodeFs: FloodSub
    const topic = 'Z'

    beforeEach(async () => {
      nodeGs = new Gossipsub(await createPeer({ started: false }), { fallbackToFloodsub: true })
      nodeFs = await createFloodsubNode(await createPeer({ peerId: await PeerId.create(), started: false }))

      await Promise.all([startNode(nodeGs), startNode(nodeFs)])
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
      await Promise.all([stopNode(nodeGs), stopNode(nodeFs)])
    })

    it('Unsubscribe from a topic', async () => {
      nodeGs.unsubscribe(topic)
      expect(nodeGs['subscriptions'].size).to.equal(0)

      const [changedPeerId, changedSubs] = await new Promise<[PeerId, RPC.ISubOpts[]]>((resolve) => {
        nodeFs.once('pubsub:subscription-change', (...args: [PeerId, RPC.ISubOpts[]]) => resolve(args))
      })

      expect(nodeFs.peers.size).to.equal(1)
      expectSet(nodeFs.topics.get(topic), [])
      expect(changedPeerId.toB58String()).to.equal(first(nodeFs.peers).id.toB58String())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topicID).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(false)
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeGs.unsubscribe(topic)
      await new Promise((resolve) => nodeFs.once('pubsub:subscription-change', resolve))

      const promise = new Promise<void>((resolve, reject) => {
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

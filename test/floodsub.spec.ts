import { expect } from 'aegir/utils/chai.js'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { createGossipSub, createFloodSub } from './utils/index.js'
import type { Libp2p } from 'libp2p'
import { pEvent } from 'p-event'
import type { SubscriptionChangeData, Message } from '@libp2p/interfaces/pubsub'
import pRetry from 'p-retry'

describe('gossipsub fallbacks to floodsub', () => {
  describe('basics', () => {
    let nodeGs: Libp2p
    let nodeFs: Libp2p

    beforeEach(async () => {
      nodeGs = await createGossipSub({
        started: false,
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createFloodSub({
        started: false
      })

      await Promise.all([
        nodeGs.start(),
        nodeFs.start()
      ])

      await nodeGs.peerStore.addressBook.set(nodeFs.peerId, nodeFs.getMultiaddrs())
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Dial event happened from nodeGs to nodeFs', async () => {
      await nodeGs.dialProtocol(nodeFs.peerId, nodeFs.pubsub.multicodecs)

      pRetry(() => {
        expect(nodeGs.pubsub.getPeers()).to.have.lengthOf(1)
        expect(nodeFs.pubsub.getPeers()).to.have.lengthOf(1)
      })
    })
  })

  describe('should not be added if fallback disabled', () => {
    let nodeGs: Libp2p
    let nodeFs: Libp2p

    beforeEach(async () => {
      nodeGs = await createGossipSub({
        started: false,
        init: {
          fallbackToFloodsub: false
        }
      })
      nodeFs = await createFloodSub({
        started: false
      })

      await Promise.all([
        nodeGs.start(),
        nodeFs.start()
      ])

      await nodeGs.peerStore.addressBook.set(nodeFs.peerId, nodeFs.getMultiaddrs())
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Dial event happened from nodeGs to nodeFs, but nodeGs does not support floodsub', async () => {
      try {
        await nodeGs.dialProtocol(nodeFs.peerId, nodeGs.pubsub.multicodecs)
        expect.fail('Dial should not have succeed')
      } catch (err) {
        expect((err as { code: string }).code).to.be.equal('ERR_UNSUPPORTED_PROTOCOL')
      }
    })
  })

  describe('subscription functionality', () => {
    let nodeGs: Libp2p
    let nodeFs: Libp2p

    before(async () => {
      nodeGs = await createGossipSub({
        started: false,
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createFloodSub({
        started: false
      })

      await Promise.all([
        nodeGs.start(),
        nodeFs.start()
      ])

      await nodeGs.peerStore.addressBook.set(nodeFs.peerId, nodeFs.getMultiaddrs())
      await nodeGs.dialProtocol(nodeFs.peerId, nodeFs.pubsub.multicodecs)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Subscribe to a topic', async function () {
      this.timeout(10000)
      const topic = 'Z'
      nodeGs.pubsub.subscribe(topic)
      nodeFs.pubsub.subscribe(topic)

      // await subscription change
      const evt = await pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodeGs.pubsub, 'subscription-change')
      const { peerId: changedPeerId, subscriptions: changedSubs } = evt.detail

      await delay(1000)

      expect(nodeGs.pubsub.getTopics()).to.deep.equal([topic])
      expect(nodeFs.pubsub.getTopics()).to.deep.equal([topic])
      expect(nodeGs.pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodeFs.pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodeGs.pubsub.getSubscribers(topic).map(p => p.toString())).to.deep.equal([nodeFs.peerId.toString()])
      expect(nodeFs.pubsub.getSubscribers(topic).map(p => p.toString())).to.deep.equal([nodeGs.peerId.toString()])

      expect(nodeGs.pubsub.getPeers().map(p => p.toString())).to.deep.equal([changedPeerId.toString()])
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)
    })
  })

  describe('publish functionality', () => {
    let nodeGs: Libp2p
    let nodeFs: Libp2p
    const topic = 'Z'

    beforeEach(async () => {
      nodeGs = await createGossipSub({
        started: false,
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createFloodSub({
        started: false
      })

      await Promise.all([
        nodeGs.start(),
        nodeFs.start()
      ])

      await nodeGs.peerStore.addressBook.set(nodeFs.peerId, nodeFs.getMultiaddrs())
      await nodeGs.dialProtocol(nodeFs.peerId, nodeFs.pubsub.multicodecs)

      nodeGs.pubsub.subscribe(topic)
      nodeFs.pubsub.subscribe(topic)

      // await subscription change
      await Promise.all([
        pEvent(nodeGs.pubsub, 'subscription-change'),
        pEvent(nodeFs.pubsub, 'subscription-change')
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Publish to a topic - nodeGs', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodeFs.pubsub, 'message')
      const data = uint8ArrayFromString('hey')

      await nodeGs.pubsub.publish(topic, data)

      const evt = await promise
      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.be.eql(nodeGs.peerId.toString())
    })

    it('Publish to a topic - nodeFs', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodeGs.pubsub, 'message')
      const data = uint8ArrayFromString('banana')

      await nodeFs.pubsub.publish(topic, data)

      const evt = await promise
      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.be.eql(nodeFs.peerId.toString())
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeGs: Libp2p
    let nodeFs: Libp2p
    const topic = 'Z'

    beforeEach(async () => {
      nodeGs = await createGossipSub({
        started: false,
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createFloodSub({
        started: false
      })

      await Promise.all([
        nodeGs.start(),
        nodeFs.start()
      ])

      await nodeGs.peerStore.addressBook.set(nodeFs.peerId, nodeFs.getMultiaddrs())
      await nodeGs.dialProtocol(nodeFs.peerId, nodeFs.pubsub.multicodecs)

      nodeGs.pubsub.subscribe(topic)
      nodeFs.pubsub.subscribe(topic)

      // await subscription change
      await Promise.all([
        pEvent(nodeGs.pubsub, 'subscription-change'),
        pEvent(nodeFs.pubsub, 'subscription-change')
      ])
      // allow subscriptions to propagate to the other peer
      await delay(10)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Unsubscribe from a topic', async () => {
      const promise = pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodeFs.pubsub, 'subscription-change')

      nodeGs.pubsub.unsubscribe(topic)
      expect(nodeGs.pubsub.getTopics()).to.be.empty()

      const evt = await promise
      const { peerId: changedPeerId, subscriptions: changedSubs } = evt.detail

      expect(nodeFs.pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodeFs.pubsub.getSubscribers(topic)).to.be.empty()
      expect(nodeFs.getPeers().map(p => p.toString())).to.deep.equal([changedPeerId.toString()])
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(false)
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeGs.pubsub.unsubscribe(topic)
      await pEvent(nodeFs.pubsub, 'subscription-change')

      const promise = new Promise<void>((resolve, reject) => {
        nodeGs.pubsub.addEventListener('message', reject, {
          once: true
        })
        setTimeout(() => {
          nodeGs.pubsub.removeEventListener('message', reject)
          resolve()
        }, 100)
      })

      await nodeFs.pubsub.publish(topic, uint8ArrayFromString('banana'))
      await nodeGs.pubsub.publish(topic, uint8ArrayFromString('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })
})

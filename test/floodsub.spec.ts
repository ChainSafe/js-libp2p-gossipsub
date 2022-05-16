import { expect } from 'aegir/utils/chai.js'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { pEvent } from 'p-event'
import type { SubscriptionChangeData, Message } from '@libp2p/interfaces/pubsub'
import pRetry from 'p-retry'
import { connectPubsubNodes, createComponents } from './utils/create-pubsub.js'
import { Components } from '@libp2p/interfaces/components'
import { FloodSub } from '@libp2p/floodsub'
import { FloodsubID, GossipsubIDv11 } from '../src/constants.js'
import { stop } from '@libp2p/interfaces/startable'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'

describe('gossipsub fallbacks to floodsub', () => {
  describe('basics', () => {
    let nodeGs: Components
    let nodeFs: Components

    beforeEach(async () => {
      mockNetwork.reset()

      nodeGs = await createComponents({
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createComponents({
        pubsub: FloodSub
      })
    })

    afterEach(async () => {
      await stop(nodeGs, nodeFs)
      mockNetwork.reset()
    })

    it('Dial event happened from nodeGs to nodeFs', async () => {
      await connectPubsubNodes(nodeGs, nodeFs, FloodsubID)

      await pRetry(() => {
        expect(nodeGs.getPubSub().getPeers().map(s => s.toString())).to.include(nodeFs.getPeerId().toString())
        expect(nodeFs.getPubSub().getPeers().map(s => s.toString())).to.include(nodeGs.getPeerId().toString())
      })
    })
  })

  describe.skip('should not be added if fallback disabled', () => {
    let nodeGs: Components
    let nodeFs: Components

    beforeEach(async () => {
      mockNetwork.reset()
      nodeGs = await createComponents({
        init: {
          fallbackToFloodsub: false
        }
      })
      nodeFs = await createComponents({
        pubsub: FloodSub
      })
    })

    afterEach(async () => {
      await stop(nodeGs, nodeFs)
      mockNetwork.reset()
    })

    it('Dial event happened from nodeGs to nodeFs, but nodeGs does not support floodsub', async () => {
      try {
        await connectPubsubNodes(nodeGs, nodeFs, GossipsubIDv11)
        expect.fail('Dial should not have succeed')
      } catch (err) {
        expect((err as { code: string }).code).to.be.equal('ERR_UNSUPPORTED_PROTOCOL')
      }
    })
  })

  describe('subscription functionality', () => {
    let nodeGs: Components
    let nodeFs: Components

    before(async () => {
      mockNetwork.reset()
      nodeGs = await createComponents({
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createComponents({
        pubsub: FloodSub
      })

      await connectPubsubNodes(nodeGs, nodeFs, FloodsubID)
    })

    afterEach(async () => {
      await stop(nodeGs, nodeFs)
      mockNetwork.reset()
    })

    it('Subscribe to a topic', async function () {
      this.timeout(10000)
      const topic = 'Z'
      nodeGs.getPubSub().subscribe(topic)
      nodeFs.getPubSub().subscribe(topic)

      // await subscription change
      const [evt] = await Promise.all([
        pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodeGs.getPubSub(), 'subscription-change'),
        pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodeFs.getPubSub(), 'subscription-change')
      ])
      const { peerId: changedPeerId, subscriptions: changedSubs } = evt.detail

      expect(nodeGs.getPubSub().getTopics()).to.include(topic)
      expect(nodeFs.getPubSub().getTopics()).to.include(topic)
      expect(nodeGs.getPubSub().getPeers()).to.have.lengthOf(1)
      expect(nodeFs.getPubSub().getPeers()).to.have.lengthOf(1)
      expect(nodeGs.getPubSub().getSubscribers(topic).map(p => p.toString())).to.include(nodeFs.getPeerId().toString())
      expect(nodeFs.getPubSub().getSubscribers(topic).map(p => p.toString())).to.include(nodeGs.getPeerId().toString())

      expect(nodeGs.getPubSub().getPeers().map(p => p.toString())).to.include(changedPeerId.toString())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)
    })
  })

  describe('publish functionality', () => {
    let nodeGs: Components
    let nodeFs: Components
    const topic = 'Z'

    beforeEach(async () => {
      mockNetwork.reset()
      nodeGs = await createComponents({
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createComponents({
        pubsub: FloodSub
      })

      await connectPubsubNodes(nodeGs, nodeFs, FloodsubID)

      nodeGs.getPubSub().subscribe(topic)
      nodeFs.getPubSub().subscribe(topic)

      // await subscription change
      await Promise.all([
        pEvent(nodeGs.getPubSub(), 'subscription-change'),
        pEvent(nodeFs.getPubSub(), 'subscription-change')
      ])
    })

    afterEach(async () => {
      await stop(nodeGs, nodeFs)
      mockNetwork.reset()
    })

    it('Publish to a topic - nodeGs', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodeFs.getPubSub(), 'message')
      const data = uint8ArrayFromString('hey')

      await nodeGs.getPubSub().publish(topic, data)

      const evt = await promise
      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.be.eql(nodeGs.getPeerId().toString())
    })

    it('Publish to a topic - nodeFs', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodeGs.getPubSub(), 'message')
      const data = uint8ArrayFromString('banana')

      await nodeFs.getPubSub().publish(topic, data)

      const evt = await promise
      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.be.eql(nodeFs.getPeerId().toString())
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeGs: Components
    let nodeFs: Components
    const topic = 'Z'

    beforeEach(async () => {
      mockNetwork.reset()
      nodeGs = await createComponents({
        init: {
          fallbackToFloodsub: true
        }
      })
      nodeFs = await createComponents({
        pubsub: FloodSub
      })

      await connectPubsubNodes(nodeGs, nodeFs, FloodsubID)

      nodeGs.getPubSub().subscribe(topic)
      nodeFs.getPubSub().subscribe(topic)

      // await subscription change
      await Promise.all([
        pEvent(nodeGs.getPubSub(), 'subscription-change'),
        pEvent(nodeFs.getPubSub(), 'subscription-change')
      ])
      // allow subscriptions to propagate to the other peer
      await delay(10)
    })

    afterEach(async () => {
      await stop(nodeGs, nodeFs)
      mockNetwork.reset()
    })

    it('Unsubscribe from a topic', async () => {
      const promise = pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodeFs.getPubSub(), 'subscription-change')

      nodeGs.getPubSub().unsubscribe(topic)
      expect(nodeGs.getPubSub().getTopics()).to.be.empty()

      const evt = await promise
      const { peerId: changedPeerId, subscriptions: changedSubs } = evt.detail

      expect(nodeFs.getPubSub().getPeers()).to.have.lengthOf(1)
      expect(nodeFs.getPubSub().getSubscribers(topic)).to.be.empty()
      expect(nodeFs.getPubSub().getPeers().map(p => p.toString())).to.include(changedPeerId.toString())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(false)
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeGs.getPubSub().unsubscribe(topic)
      await pEvent(nodeFs.getPubSub(), 'subscription-change')

      const promise = new Promise<void>((resolve, reject) => {
        nodeGs.getPubSub().addEventListener('message', reject, {
          once: true
        })
        setTimeout(() => {
          nodeGs.getPubSub().removeEventListener('message', reject)
          resolve()
        }, 100)
      })

      await nodeFs.getPubSub().publish(topic, uint8ArrayFromString('banana'))
      await nodeGs.getPubSub().publish(topic, uint8ArrayFromString('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })
})

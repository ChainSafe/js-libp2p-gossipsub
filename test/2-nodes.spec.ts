import { expect } from 'aegir/utils/chai.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import type { GossipSub } from '../ts/index.js'
import type { Message, SubscriptionChangeData } from '@libp2p/interfaces/pubsub'
import { FloodsubID, GossipsubIDv11 } from '../ts/constants.js'
import { pEvent } from 'p-event'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import defer from 'p-defer'
import pWaitFor from 'p-wait-for'
import { Components } from '@libp2p/interfaces/components'
import { connectAllPubSubNodes, connectPubsubNodes, createComponentsArray } from './utils/create-pubsub.js'
import { stop } from '@libp2p/interfaces/startable'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'

const shouldNotHappen = () => expect.fail()

async function nodesArePubSubPeers (node0: Components, node1: Components, timeout: number = 60000) {
  await pWaitFor(() => {
    const node0SeesNode1 = node0.getPubSub().getPeers().map(p => p.toString()).includes(node1.getPeerId().toString())
    const node1SeesNode0 = node1.getPubSub().getPeers().map(p => p.toString()).includes(node0.getPeerId().toString())

    return node0SeesNode1 && node1SeesNode0
  }, {
    timeout
  })
}

describe('2 nodes', () => {
  describe('Pubsub dial', () => {
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({ number: 2 })
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('Dial from nodeA to nodeB happened with FloodsubID', async () => {
      await connectPubsubNodes(nodes[0], nodes[1], FloodsubID)
      await nodesArePubSubPeers(nodes[0], nodes[1])
    })
  })

  describe('basics', () => {
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({ number: 2 })
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('Dial from nodeA to nodeB happened with GossipsubIDv11', async () => {
      await connectPubsubNodes(nodes[0], nodes[1], GossipsubIDv11)
      await nodesArePubSubPeers(nodes[0], nodes[1])
    })
  })

  describe('subscription functionality', () => {
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({
        number: 2,
        connected: true
      })
      await nodesArePubSubPeers(nodes[0], nodes[1])
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('Subscribe to a topic', async () => {
      const topic = 'test_topic'

      nodes[0].getPubSub().subscribe(topic)
      nodes[1].getPubSub().subscribe(topic)

      // await subscription change
      const [evt0] = await Promise.all([
        pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodes[0].getPubSub(), 'subscription-change'),
        pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodes[1].getPubSub(), 'subscription-change')
      ])

      const { peerId: changedPeerId, subscriptions: changedSubs } = evt0.detail

      expect(nodes[0].getPubSub().getTopics()).to.include(topic)
      expect(nodes[1].getPubSub().getTopics()).to.include(topic)
      expect(nodes[0].getPubSub().getSubscribers(topic).map(p => p.toString())).to.include(nodes[1].getPeerId().toString())
      expect(nodes[1].getPubSub().getSubscribers(topic).map(p => p.toString())).to.include(nodes[0].getPeerId().toString())

      expect(changedPeerId.toString()).to.equal(nodes[1].getPeerId().toString())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)

      // await heartbeats
      await Promise.all([
        pEvent(nodes[0].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat')
      ])

      expect((nodes[0].getPubSub() as GossipSub).mesh.get(topic)?.has(nodes[1].getPeerId().toString())).to.be.true()
      expect((nodes[1].getPubSub() as GossipSub).mesh.get(topic)?.has(nodes[0].getPeerId().toString())).to.be.true()
    })
  })

  describe('publish functionality', () => {
    const topic = 'Z'
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({
        number: 2,
        connected: true
      })

      // Create subscriptions
      nodes[0].getPubSub().subscribe(topic)
      nodes[1].getPubSub().subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].getPubSub(), 'subscription-change'),
        pEvent(nodes[1].getPubSub(), 'subscription-change'),
        pEvent(nodes[0].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat')
      ])
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('Publish to a topic - nodeA', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodes[1].getPubSub(), 'message')
      nodes[0].getPubSub().addEventListener('message', shouldNotHappen)
      const data = uint8ArrayFromString('hey')

      await nodes[0].getPubSub().publish(topic, data)

      const evt = await promise

      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.equal(nodes[0].getPeerId().toString())

      nodes[0].getPubSub().removeEventListener('message', shouldNotHappen)
    })

    it('Publish to a topic - nodeB', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodes[0].getPubSub(), 'message')
      nodes[1].getPubSub().addEventListener('message', shouldNotHappen)
      const data = uint8ArrayFromString('banana')

      await nodes[1].getPubSub().publish(topic, data)

      const evt = await promise

      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.equal(nodes[1].getPeerId().toString())

      nodes[1].getPubSub().removeEventListener('message', shouldNotHappen)
    })

    it('Publish 10 msg to a topic', async () => {
      let counter = 0

      nodes[1].getPubSub().addEventListener('message', shouldNotHappen)
      nodes[0].getPubSub().addEventListener('message', receivedMsg)

      const done = defer()

      function receivedMsg (evt: CustomEvent<Message>) {
        const msg = evt.detail

        expect(uint8ArrayToString(msg.data)).to.startWith('banana')
        expect(msg.from.toString()).to.equal(nodes[1].getPeerId().toString())
        expect(msg.sequenceNumber).to.be.a('BigInt')
        expect(msg.topic).to.equal(topic)

        if (++counter === 10) {
          nodes[0].getPubSub().removeEventListener('message', receivedMsg)
          nodes[1].getPubSub().removeEventListener('message', shouldNotHappen)
          done.resolve()
        }
      }

      await Promise.all(Array.from({ length: 10 }).map(async (_, i) => {
        await nodes[1].getPubSub().publish(topic, uint8ArrayFromString(`banana${i}`))
      }))

      await done.promise
    })
  })

  describe('publish after unsubscribe', () => {
    const topic = 'Z'
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({ number: 2, init: {allowPublishToZeroPeers: true } })
      await connectAllPubSubNodes(nodes)

      // Create subscriptions
      nodes[0].getPubSub().subscribe(topic)
      nodes[1].getPubSub().subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].getPubSub(), 'subscription-change'),
        pEvent(nodes[1].getPubSub(), 'subscription-change')
      ])
      await Promise.all([
        pEvent(nodes[0].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat')
      ])
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('Unsubscribe from a topic', async () => {
      nodes[0].getPubSub().unsubscribe(topic)
      expect(nodes[0].getPubSub().getTopics()).to.be.empty()

      const evt = await pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodes[1].getPubSub(), 'subscription-change')
      const { peerId: changedPeerId, subscriptions: changedSubs } = evt.detail

      await pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat')

      expect(nodes[1].getPubSub().getPeers()).to.have.lengthOf(1)
      expect(nodes[1].getPubSub().getSubscribers(topic)).to.be.empty()

      expect(changedPeerId.toString()).to.equal(nodes[0].getPeerId().toString())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(false)
    })

    it('Publish to a topic after unsubscribe', async () => {
      const promises = [
        pEvent(nodes[1].getPubSub(), 'subscription-change'),
        pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat')
      ]

      nodes[0].getPubSub().unsubscribe(topic)

      await Promise.all(promises)

      const promise = new Promise<void>((resolve, reject) => {
        nodes[0].getPubSub().addEventListener('message', reject)

        setTimeout(() => {
          nodes[0].getPubSub().removeEventListener('message', reject)
          resolve()
        }, 100)
      })

      await nodes[1].getPubSub().publish('Z', uint8ArrayFromString('banana'))
      await nodes[0].getPubSub().publish('Z', uint8ArrayFromString('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })

  describe('nodes send state on connection', () => {
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({
        number: 2
      })

      // Make subscriptions prior to new nodes
      nodes[0].getPubSub().subscribe('Za')
      nodes[1].getPubSub().subscribe('Zb')

      expect(nodes[0].getPubSub().getPeers()).to.be.empty()
      expect(nodes[0].getPubSub().getTopics()).to.include('Za')
      expect(nodes[1].getPubSub().getPeers()).to.be.empty()
      expect(nodes[1].getPubSub().getTopics()).to.include('Zb')
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('existing subscriptions are sent upon peer connection', async function () {
      this.timeout(5000)

      await Promise.all([
        connectPubsubNodes(nodes[0], nodes[1], GossipsubIDv11),
        pEvent(nodes[0].getPubSub(), 'subscription-change'),
        pEvent(nodes[1].getPubSub(), 'subscription-change')
      ])

      expect(nodes[0].getPubSub().getTopics()).to.include('Za')
      expect(nodes[1].getPubSub().getPeers()).to.have.lengthOf(1)
      expect(nodes[1].getPubSub().getSubscribers('Za').map(p => p.toString())).to.include(nodes[0].getPeerId().toString())

      expect(nodes[1].getPubSub().getTopics()).to.include('Zb')
      expect(nodes[0].getPubSub().getPeers()).to.have.lengthOf(1)
      expect(nodes[0].getPubSub().getSubscribers('Zb').map(p => p.toString())).to.include(nodes[1].getPeerId().toString())
    })
  })

  describe('nodes handle stopping', () => {
    let nodes: Components[]

    // Create pubsub nodes
    beforeEach(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({
        number: 2,
        connected: true
      })
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it("nodes don't have peers after stopped", async () => {
      stop(nodes)
      expect(nodes[0].getPubSub().getPeers()).to.be.empty()
      expect(nodes[1].getPubSub().getPeers()).to.be.empty()
    })
  })
})

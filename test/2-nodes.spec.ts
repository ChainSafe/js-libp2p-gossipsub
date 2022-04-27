import { expect } from 'aegir/utils/chai.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import delay from 'delay'
import type { GossipSub } from '../ts/index.js'
import { createGossipSubs, createConnectedGossipsubs } from './utils/index.js'
import type { Message, SubscriptionChangeData } from '@libp2p/interfaces/pubsub'
import { FloodsubID, GossipsubIDv11 } from '../ts/constants.js'
import type { Libp2p } from 'libp2p'
import { pEvent } from 'p-event'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import defer from 'p-defer'

const shouldNotHappen = () => expect.fail()

describe('2 nodes', () => {
  describe('Pubsub dial', () => {
    let nodes: Libp2p[]

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createGossipSubs({ number: 2 })
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it('Dial from nodeA to nodeB happened with FloodsubID', async () => {
      await nodes[0].dialProtocol(nodes[1].peerId, FloodsubID)

      while (nodes[0].pubsub.getPeers().length === 0 || nodes[1].pubsub.getPeers().length === 0) {
        await delay(10)
      }

      expect(nodes[0].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[1].pubsub.getPeers()).to.have.lengthOf(1)
    })
  })

  describe('basics', () => {
    let nodes: Libp2p[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createGossipSubs({ number: 2 })
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it('Dial from nodeA to nodeB happened with GossipsubIDv11', async () => {
      await nodes[0].dialProtocol(nodes[1].peerId, GossipsubIDv11)

      while (nodes[0].pubsub.getPeers().length === 0 || nodes[1].pubsub.getPeers().length === 0) {
        await delay(10)
      }

      expect(nodes[0].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[1].pubsub.getPeers()).to.have.lengthOf(1)
    })
  })

  describe('subscription functionality', () => {
    let nodes: Libp2p[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it('Subscribe to a topic', async () => {
      const topic = 'test_topic'

      nodes[0].pubsub.subscribe(topic)
      nodes[1].pubsub.subscribe(topic)

      // await subscription change
      const [evt0] = await Promise.all([
        pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodes[0].pubsub, 'subscription-change'),
        pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodes[1].pubsub, 'subscription-change')
      ])

      const { peerId: changedPeerId, subscriptions: changedSubs } = evt0.detail

      expect(nodes[0].pubsub.getTopics()).to.deep.equal([topic])
      expect(nodes[1].pubsub.getTopics()).to.deep.equal([topic])
      expect(nodes[0].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[1].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[0].pubsub.getSubscribers(topic).map(p => p.toString())).to.deep.equal([nodes[1].peerId.toString()])
      expect(nodes[1].pubsub.getSubscribers(topic).map(p => p.toString())).to.deep.equal([nodes[0].peerId.toString()])

      expect(changedPeerId.toString()).to.equal(nodes[1].peerId.toString())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)

      // await heartbeats
      await Promise.all([
        pEvent(nodes[0].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[1].pubsub, 'gossipsub:heartbeat')
      ])

      expect((nodes[0].pubsub as GossipSub).mesh.get(topic)?.has(nodes[1].peerId.toString())).to.be.true()
      expect((nodes[1].pubsub as GossipSub).mesh.get(topic)?.has(nodes[0].peerId.toString())).to.be.true()
    })
  })

  describe('publish functionality', () => {
    const topic = 'Z'
    let nodes: Libp2p[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    // Create subscriptions
    beforeEach(async () => {
      nodes[0].pubsub.subscribe(topic)
      nodes[1].pubsub.subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].pubsub, 'subscription-change'),
        pEvent(nodes[1].pubsub, 'subscription-change'),
        pEvent(nodes[0].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[1].pubsub, 'gossipsub:heartbeat')
      ])
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it('Publish to a topic - nodeA', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodes[1].pubsub, 'message')
      nodes[0].pubsub.addEventListener('message', shouldNotHappen)
      const data = uint8ArrayFromString('hey')

      await nodes[0].pubsub.publish(topic, data)

      const evt = await promise

      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.equal(nodes[0].peerId.toString())

      nodes[0].pubsub.removeEventListener('message', shouldNotHappen)
    })

    it('Publish to a topic - nodeB', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodes[0].pubsub, 'message')
      nodes[1].pubsub.addEventListener('message', shouldNotHappen)
      const data = uint8ArrayFromString('banana')

      await nodes[1].pubsub.publish(topic, data)

      const evt = await promise

      expect(evt.detail.data).to.equalBytes(data)
      expect(evt.detail.from.toString()).to.equal(nodes[1].peerId.toString())

      nodes[1].pubsub.removeEventListener('message', shouldNotHappen)
    })

    it('Publish 10 msg to a topic', async () => {
      let counter = 0

      nodes[1].pubsub.addEventListener('message', shouldNotHappen)
      nodes[0].pubsub.addEventListener('message', receivedMsg)

      const done = defer()

      function receivedMsg (evt: CustomEvent<Message>) {
        const msg = evt.detail

        expect(uint8ArrayToString(msg.data)).to.startWith('banana')
        expect(msg.from.toString()).to.equal(nodes[1].peerId.toString())
        expect(msg.sequenceNumber).to.be.a('BigInt')
        expect(msg.topic).to.equal(topic)

        if (++counter === 10) {
          nodes[0].pubsub.removeEventListener('message', receivedMsg)
          nodes[1].pubsub.removeEventListener('message', shouldNotHappen)
          done.resolve()
        }
      }

      await Promise.all(Array.from({ length: 10 }).map(async (_, i) => {
        await nodes[1].pubsub.publish(topic, uint8ArrayFromString(`banana${i}`))
      }))

      await done.promise
    })
  })

  describe('publish after unsubscribe', () => {
    const topic = 'Z'
    let nodes: Libp2p[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2, init: { allowPublishToZeroPeers: true } })
    })

    // Create subscriptions
    beforeEach(async () => {
      nodes[0].pubsub.subscribe(topic)
      nodes[1].pubsub.subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].pubsub, 'subscription-change'),
        pEvent(nodes[1].pubsub, 'subscription-change')
      ])
      await Promise.all([
        pEvent(nodes[0].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[1].pubsub, 'gossipsub:heartbeat')
      ])
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it('Unsubscribe from a topic', async () => {
      nodes[0].pubsub.unsubscribe(topic)
      expect(nodes[0].pubsub.getTopics()).to.be.empty()

      const evt = await pEvent<'subscription-change', CustomEvent<SubscriptionChangeData>>(nodes[1].pubsub, 'subscription-change')
      const { peerId: changedPeerId, subscriptions: changedSubs } = evt.detail

      await pEvent(nodes[1].pubsub, 'gossipsub:heartbeat')

      expect(nodes[1].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[1].pubsub.getSubscribers(topic)).to.be.empty()

      expect(changedPeerId.toString()).to.equal(nodes[0].peerId.toString())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topic).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(false)
    })

    it('Publish to a topic after unsubscribe', async () => {
      const promises = [
        pEvent(nodes[1].pubsub, 'subscription-change'),
        pEvent(nodes[1].pubsub, 'gossipsub:heartbeat')
      ]

      nodes[0].pubsub.unsubscribe(topic)

      await Promise.all(promises)

      const promise = new Promise<void>((resolve, reject) => {
        nodes[0].pubsub.addEventListener('message', reject)

        setTimeout(() => {
          nodes[0].pubsub.removeEventListener('message', reject)
          resolve()
        }, 100)
      })

      await nodes[1].pubsub.publish('Z', uint8ArrayFromString('banana'))
      await nodes[0].pubsub.publish('Z', uint8ArrayFromString('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })

  describe('nodes send state on connection', () => {
    let nodes: Libp2p[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createGossipSubs({ number: 2 })
    })

    // Make subscriptions prior to new nodes
    beforeEach(() => {
      nodes[0].pubsub.subscribe('Za')
      nodes[1].pubsub.subscribe('Zb')

      expect(nodes[0].pubsub.getPeers()).to.be.empty()
      expect(nodes[0].pubsub.getTopics()).to.deep.equal(['Za'])
      expect(nodes[1].pubsub.getPeers()).to.be.empty()
      expect(nodes[1].pubsub.getTopics()).to.deep.equal(['Zb'])
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it('existing subscriptions are sent upon peer connection', async function () {
      this.timeout(5000)

      await Promise.all([
        nodes[0].dialProtocol(nodes[1].peerId, GossipsubIDv11),
        pEvent(nodes[0].pubsub, 'subscription-change'),
        pEvent(nodes[1].pubsub, 'subscription-change')
      ])

      expect(nodes[0].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[1].pubsub.getPeers()).to.have.lengthOf(1)

      expect(nodes[0].pubsub.getTopics()).to.deep.equal(['Za'])
      expect(nodes[1].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[1].pubsub.getSubscribers('Za').map(p => p.toString())).to.include(nodes[0].peerId.toString())

      expect(nodes[1].pubsub.getTopics()).to.deep.equal(['Zb'])
      expect(nodes[0].pubsub.getPeers()).to.have.lengthOf(1)
      expect(nodes[0].pubsub.getSubscribers('Zb').map(p => p.toString())).to.include(nodes[1].peerId.toString())
    })
  })

  describe('nodes handle stopping', () => {
    let nodes: Libp2p[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    afterEach(async () => await Promise.all(nodes.map(node => node.stop())))

    it("nodes don't have peers after stopped", async () => {
      await Promise.all(nodes.map(n => n.stop()))
      expect(nodes[0].pubsub.getPeers()).to.be.empty()
      expect(nodes[1].pubsub.getPeers()).to.be.empty()
    })
  })
})

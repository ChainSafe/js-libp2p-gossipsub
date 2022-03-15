import chai from 'chai'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import delay from 'delay'
import Gossipsub, { multicodec } from '../ts'
import { createGossipsubs, createConnectedGossipsubs, expectSet, stopNode, first } from './utils'
import { RPC } from '../ts/message/rpc'
import { InMessage, PeerId } from 'libp2p-interfaces/src/pubsub'

chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect

const shouldNotHappen = () => expect.fail()

describe('2 nodes', () => {
  describe('basics', () => {
    let nodes: Gossipsub[] = []

    // Create pubsub nodes
    before(async () => {
      nodes = await createGossipsubs({ number: 2 })
    })

    after(() => Promise.all(nodes.map(stopNode)))

    it('Dial from nodeA to nodeB happened with pubsub', async () => {
      await nodes[0]._libp2p.dialProtocol(nodes[1]._libp2p.peerId, multicodec)
      await delay(10)
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ])

      expect(nodes[0].peers.size).to.be.eql(1)
      expect(nodes[1].peers.size).to.be.eql(1)
    })
  })

  describe('subscription functionality', () => {
    let nodes: Gossipsub[] = []

    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    after(() => Promise.all(nodes.map(stopNode)))

    it('Subscribe to a topic', async () => {
      const topic = 'Z'
      nodes[0].subscribe(topic)
      nodes[1].subscribe(topic)

      // await subscription change
      const [evt0] = await Promise.all([
        new Promise<[PeerId, RPC.ISubOpts[]]>((resolve) =>
          nodes[0].once('pubsub:subscription-change', (...args: [PeerId, RPC.ISubOpts[]]) => resolve(args))
        ),
        new Promise((resolve) => nodes[1].once('pubsub:subscription-change', resolve))
      ])

      const [changedPeerId, changedSubs] = evt0 as [PeerId, RPC.ISubOpts[]]

      expectSet(nodes[0].subscriptions, [topic])
      expectSet(nodes[1].subscriptions, [topic])
      expect(nodes[0].peers.size).to.equal(1)
      expect(nodes[1].peers.size).to.equal(1)
      expectSet(nodes[0].topics.get(topic), [nodes[1].peerId.toB58String()])
      expectSet(nodes[1].topics.get(topic), [nodes[0].peerId.toB58String()])

      expect(changedPeerId.toB58String()).to.equal(first(nodes[0].peers).id.toB58String())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topicID).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(true)

      // await heartbeats
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ])

      expect(first(nodes[0].mesh.get(topic))).to.equal(first(nodes[0].peers).id.toB58String())
      expect(first(nodes[1].mesh.get(topic))).to.equal(first(nodes[1].peers).id.toB58String())
    })
  })

  describe('publish functionality', () => {
    const topic = 'Z'
    let nodes: Gossipsub[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    // Create subscriptions
    beforeEach(async () => {
      nodes[0].subscribe(topic)
      nodes[1].subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('pubsub:subscription-change', resolve))))
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(() => Promise.all(nodes.map(stopNode)))

    it('Publish to a topic - nodeA', async () => {
      const promise = new Promise<InMessage>((resolve) => nodes[1].once(topic, resolve))
      nodes[0].once(topic, (m) => shouldNotHappen)

      nodes[0].publish(topic, uint8ArrayFromString('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodes[0].peerId.toB58String())

      nodes[0].removeListener(topic, shouldNotHappen)
    })

    it('Publish to a topic - nodeB', async () => {
      const promise = new Promise<InMessage>((resolve) => nodes[0].once(topic, resolve))
      nodes[1].once(topic, shouldNotHappen)

      nodes[1].publish(topic, uint8ArrayFromString('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodes[1].peerId.toB58String())

      nodes[1].removeListener(topic, shouldNotHappen)
    })

    it('Publish 10 msg to a topic', (done) => {
      let counter = 0

      nodes[1].once(topic, shouldNotHappen)

      nodes[0].on(topic, receivedMsg)

      function receivedMsg(msg: InMessage) {
        expect(msg.data.toString().startsWith('banana')).to.be.true
        expect(msg.from).to.be.eql(nodes[1].peerId.toB58String())
        expect(msg.seqno).to.be.a('Uint8Array')
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodes[0].removeListener(topic, receivedMsg)
          nodes[1].removeListener(topic, shouldNotHappen)
          done()
        }
      }

      Array.from({ length: 10 }).forEach((_, i) => {
        nodes[1].publish(topic, uint8ArrayFromString('banana' + i))
      })
    })
  })

  describe('publish after unsubscribe', () => {
    const topic = 'Z'
    let nodes: Gossipsub[] = []

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    // Create subscriptions
    beforeEach(async () => {
      nodes[0].subscribe(topic)
      nodes[1].subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodes[0].once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(() => Promise.all(nodes.map(stopNode)))

    it('Unsubscribe from a topic', async () => {
      nodes[0].unsubscribe(topic)
      expect(nodes[0].subscriptions.size).to.equal(0)

      const [changedPeerId, changedSubs] = await new Promise<[PeerId, RPC.ISubOpts[]]>((resolve) => {
        nodes[1].once('pubsub:subscription-change', (...args: [PeerId, RPC.ISubOpts[]]) => resolve(args))
      })
      await new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))

      expect(nodes[1].peers.size).to.equal(1)
      expectSet(nodes[1].topics.get(topic), [])
      expect(changedPeerId.toB58String()).to.equal(first(nodes[1].peers).id.toB58String())
      expect(changedSubs).to.have.lengthOf(1)
      expect(changedSubs[0].topicID).to.equal(topic)
      expect(changedSubs[0].subscribe).to.equal(false)
    })

    it('Publish to a topic after unsubscribe', async () => {
      const promises = [
        new Promise((resolve) => nodes[1].once('pubsub:subscription-change', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ]

      nodes[0].unsubscribe(topic)

      await Promise.all(promises)

      const promise = new Promise<void>((resolve, reject) => {
        nodes[0].once(topic, reject)
        setTimeout(() => {
          nodes[0].removeListener(topic, reject)
          resolve()
        }, 100)
      })

      nodes[1].publish('Z', uint8ArrayFromString('banana'))
      nodes[0].publish('Z', uint8ArrayFromString('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })

  describe('nodes send state on connection', () => {
    let nodes: Gossipsub[] = []

    // Create pubsub nodes
    before(async () => {
      nodes = await createGossipsubs({ number: 2 })
    })

    // Make subscriptions prior to new nodes
    before(() => {
      nodes[0].subscribe('Za')
      nodes[1].subscribe('Zb')

      expect(nodes[0].peers.size).to.equal(0)
      expectSet(nodes[0].subscriptions, ['Za'])
      expect(nodes[1].peers.size).to.equal(0)
      expectSet(nodes[1].subscriptions, ['Zb'])
    })

    after(() => Promise.all(nodes.map(stopNode)))

    it('existing subscriptions are sent upon peer connection', async function () {
      this.timeout(5000)

      await Promise.all([
        nodes[0]._libp2p.dialProtocol(nodes[1]._libp2p.peerId, multicodec),
        new Promise((resolve) => nodes[0].once('pubsub:subscription-change', resolve)),
        new Promise((resolve) => nodes[1].once('pubsub:subscription-change', resolve))
      ])
      expect(nodes[0].peers.size).to.equal(1)
      expect(nodes[1].peers.size).to.equal(1)

      expectSet(nodes[0].subscriptions, ['Za'])
      expect(nodes[1].peers.size).to.equal(1)
      expectSet(nodes[1].topics.get('Za'), [nodes[0].peerId.toB58String()])

      expectSet(nodes[1].subscriptions, ['Zb'])
      expect(nodes[0].peers.size).to.equal(1)
      expectSet(nodes[0].topics.get('Zb'), [nodes[1].peerId.toB58String()])
    })
  })

  describe('nodes handle stopping', () => {
    let nodes: Gossipsub[] = []

    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    it("nodes don't have peers after stopped", async () => {
      await Promise.all(nodes.map(stopNode))
      expect(nodes[0].peers.size).to.equal(0)
      expect(nodes[1].peers.size).to.equal(0)
    })
  })
})

/* eslint-env mocha */
'use strict'

const { Buffer } = require('buffer')
const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect
const delay = require('delay')

const { multicodec } = require('../src')
const Gossipsub = require('../src')

const {
  createPeer,
  createGossipsubs,
  createConnectedGossipsubs,
  expectSet,
  startNode,
  stopNode,
  first
} = require('./utils')

const shouldNotHappen = (msg) => expect.fail()

describe('1 node', () => {
  describe('basics', () => {
    let gossipsub

    before(async () => {
      gossipsub = new Gossipsub(await createPeer({ started: false }))
    })

    after(() => stopNode(gossipsub))

    it('should mount the pubsub protocol', () => {
      expect(gossipsub.peers.size).to.be.eql(0)
      expect(gossipsub.mesh.size).to.eql(0)
      expect(gossipsub.fanout.size).to.eql(0)
      expect(gossipsub.lastpub.size).to.eql(0)
      expect(gossipsub.gossip.size).to.eql(0)
      expect(gossipsub.control.size).to.eql(0)
      expect(gossipsub.subscriptions.size).to.eql(0)
    })

    it('should start a gossipsub successfully', async () => {
      await startNode(gossipsub)
      expect(gossipsub.started).to.equal(true)
    })
  })
})

describe('2 nodes', () => {
  describe('basics', () => {
    let nodes

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
    let nodes

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
        new Promise(resolve => nodes[0].once('pubsub:subscription-change', (...args) => resolve(args))),
        new Promise(resolve => nodes[1].once('pubsub:subscription-change', (...args) => resolve(args)))
      ])

      const [changedPeerId, changedTopics, changedSubs] = evt0

      expectSet(nodes[0].subscriptions, [topic])
      expectSet(nodes[1].subscriptions, [topic])
      expect(nodes[0].peers.size).to.equal(1)
      expect(nodes[1].peers.size).to.equal(1)
      expectSet(first(nodes[0].peers).topics, [topic])
      expectSet(first(nodes[1].peers).topics, [topic])

      expect(changedPeerId.toB58String()).to.equal(first(nodes[0].peers).id.toB58String())
      expectSet(changedTopics, [topic])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: true }])

      // await heartbeats
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ])

      expect(first(nodes[0].mesh.get(topic)).id.toB58String()).to.equal(first(nodes[0].peers).id.toB58String())
      expect(first(nodes[1].mesh.get(topic)).id.toB58String()).to.equal(first(nodes[1].peers).id.toB58String())
    })
  })

  describe('publish functionality', () => {
    const topic = 'Z'
    let nodes

    // Create pubsub nodes
    beforeEach(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    // Create subscriptions
    beforeEach(async () => {
      nodes[0].subscribe(topic)
      nodes[1].subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all(
        nodes.map(n => new Promise(resolve => n.once('pubsub:subscription-change', resolve)))
      )
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(() => Promise.all(nodes.map(stopNode)))

    it('Publish to a topic - nodeA', async () => {
      const promise = new Promise((resolve) => nodes[1].once(topic, resolve))
      nodes[0].once(topic, (m) => shouldNotHappen)

      nodes[0].publish(topic, Buffer.from('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodes[0].peerId.toB58String())

      nodes[0].removeListener(topic, shouldNotHappen)
    })

    it('Publish to a topic - nodeB', async () => {
      const promise = new Promise((resolve) => nodes[0].once(topic, resolve))
      nodes[1].once(topic, shouldNotHappen)

      nodes[1].publish(topic, Buffer.from('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodes[1].peerId.toB58String())

      nodes[1].removeListener(topic, shouldNotHappen)
    })

    it('Publish 10 msg to a topic', (done) => {
      let counter = 0

      nodes[1].once(topic, shouldNotHappen)

      nodes[0].on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(nodes[1].peerId.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodes[0].removeListener(topic, receivedMsg)
          nodes[1].removeListener(topic, shouldNotHappen)
          done()
        }
      }

      Array.from({ length: 10 }).forEach(() => {
        nodes[1].publish(topic, Buffer.from('banana'))
      })
    })

    it('Publish 10 msg to a topic as array', (done) => {
      let counter = 0

      nodes[1].once(topic, shouldNotHappen)

      nodes[0].on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(nodes[1].peerId.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodes[0].removeListener(topic, receivedMsg)
          nodes[1].removeListener(topic, shouldNotHappen)
          done()
        }
      }

      const msgs = []
      Array.from({ length: 10 }).forEach(() => {
        msgs.push(Buffer.from('banana'))
      })
      nodes[1].publish(topic, msgs)
    })
  })

  describe('publish after unsubscribe', () => {
    const topic = 'Z'
    let nodes

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

      const [changedPeerId, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodes[1].once('pubsub:subscription-change', (...args) => resolve(args))
      })
      await new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))

      expect(nodes[1].peers.size).to.equal(1)
      expectSet(first(nodes[1].peers).topics, [])
      expect(changedPeerId.toB58String()).to.equal(first(nodes[1].peers).id.toB58String())
      expectSet(changedTopics, [])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: false }])
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodes[0].unsubscribe(topic)
      await new Promise((resolve) => nodes[1].once('pubsub:subscription-change', resolve))
      await new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve))

      const promise = new Promise((resolve, reject) => {
        nodes[0].once(topic, reject)
        setTimeout(() => {
          nodes[0].removeListener(topic, reject)
          resolve()
        }, 100)
      })

      nodes[1].publish('Z', Buffer.from('banana'))
      nodes[0].publish('Z', Buffer.from('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })

  describe('nodes send state on connection', () => {
    let nodes

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
      expectSet(first(nodes[1].peers).topics, ['Za'])

      expectSet(nodes[1].subscriptions, ['Zb'])
      expect(nodes[0].peers.size).to.equal(1)
      expectSet(first(nodes[0].peers).topics, ['Zb'])
    })
  })

  describe('nodes handle stopping', () => {
    let nodes

    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 2 })
    })

    it('nodes don\'t have peers after stopped', async () => {
      await Promise.all(nodes.map(stopNode))
      expect(nodes[0].peers.size).to.equal(0)
      expect(nodes[1].peers.size).to.equal(0)
    })
  })
})

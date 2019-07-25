/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect
const times = require('lodash/times')

const {
  createNode,
  expectSet,
  first,
  dialNode,
  startNode,
  stopNode
} = require('./utils')

const shouldNotHappen = (msg) => expect.fail()

describe('1 node', () => {
  describe('basics', () => {
    let nodeA

    beforeEach(async () => {
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
    })

    afterEach(async function () {
      if (nodeA.gs.started) {
        await stopNode(nodeA.gs)
      }
      await stopNode(nodeA)
    })

    it('should mount the pubsub protocol', () => {
      expect(nodeA.gs.peers.size).to.be.eql(0)
      expect(nodeA.gs.mesh.size).to.eql(0)
      expect(nodeA.gs.fanout.size).to.eql(0)
      expect(nodeA.gs.lastpub.size).to.eql(0)
      expect(nodeA.gs.gossip.size).to.eql(0)
      expect(nodeA.gs.control.size).to.eql(0)
      expect(nodeA.gs.subscriptions.size).to.eql(0)
      expect(nodeA._switch.protocols[nodeA.gs.multicodec]).to.not.be.null()
    })

    it('should start a gossipsub successfully', async () => {
      await startNode(nodeA.gs)
      expect(nodeA.gs.started).to.equal(true)
    })
  })
})

describe('2 nodes', () => {
  describe('basics', () => {
    let nodeA
    let nodeB

    beforeEach(async () => {
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('Dial from nodeA to nodeB', async () => {
      await dialNode(nodeA, nodeB.peerInfo)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      expect(nodeA.gs.peers.size).to.equal(1)
      expect(nodeB.gs.peers.size).to.equal(1)
    })
  })

  describe('subscription functionality', () => {
    let nodeA
    let nodeB

    beforeEach(async function () {
      this.timeout(4000)
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])
      await dialNode(nodeA, nodeB.peerInfo)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('Subscribe to a topic', async () => {
      const topic = 'Z'
      nodeA.gs.subscribe(topic)
      nodeB.gs.subscribe(topic)

      // await subscription change
      const [changedPeerInfo, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodeA.gs.once('pubsub:subscription-change', (...args) => resolve(args))
      })

      expectSet(nodeA.gs.subscriptions, [topic])
      expectSet(nodeB.gs.subscriptions, [topic])
      expect(nodeA.gs.peers.size).to.equal(1)
      expect(nodeB.gs.peers.size).to.equal(1)
      expectSet(first(nodeA.gs.peers).topics, [topic])
      expectSet(first(nodeB.gs.peers).topics, [topic])

      expect(changedPeerInfo.id.toB58String()).to.equal(first(nodeA.gs.peers).info.id.toB58String())
      expectSet(changedTopics, [topic])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: true }])

      // await heartbeats
      await Promise.all([
        new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve))
      ])

      expect(first(nodeA.gs.mesh.get(topic)).info.id.toB58String()).to.equal(first(nodeA.gs.peers).info.id.toB58String())
      expect(first(nodeB.gs.mesh.get(topic)).info.id.toB58String()).to.equal(first(nodeB.gs.peers).info.id.toB58String())
    })
  })

  describe('publish functionality', () => {
    let nodeA
    let nodeB
    const topic = 'Z'

    beforeEach(async function () {
      this.timeout(4000)
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])
      await dialNode(nodeA, nodeB.peerInfo)

      nodeA.gs.subscribe(topic)
      nodeB.gs.subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodeA.gs.once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('Publish to a topic - nodeA', async () => {
      const promise = new Promise((resolve) => nodeB.gs.once(topic, resolve))
      nodeA.gs.once(topic, (m) => shouldNotHappen)

      nodeA.gs.publish(topic, Buffer.from('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodeA.gs.libp2p.peerInfo.id.toB58String())

      nodeA.gs.removeListener(topic, shouldNotHappen)
    })

    it('Publish to a topic - nodeB', async () => {
      const promise = new Promise((resolve) => nodeA.gs.once(topic, resolve))
      nodeB.gs.once(topic, shouldNotHappen)

      nodeB.gs.publish(topic, Buffer.from('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodeB.gs.libp2p.peerInfo.id.toB58String())

      nodeB.gs.removeListener(topic, shouldNotHappen)
    })

    it('Publish 10 msg to a topic', (done) => {
      let counter = 0

      nodeB.gs.once(topic, shouldNotHappen)

      nodeA.gs.on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(nodeB.gs.libp2p.peerInfo.id.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodeA.gs.removeListener(topic, receivedMsg)
          nodeB.gs.removeListener(topic, shouldNotHappen)
          done()
        }
      }

      times(10, () => nodeB.gs.publish(topic, Buffer.from('banana')))
    })

    it('Publish 10 msg to a topic as array', (done) => {
      let counter = 0

      nodeB.gs.once(topic, shouldNotHappen)

      nodeA.gs.on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(nodeB.gs.libp2p.peerInfo.id.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodeA.gs.removeListener(topic, receivedMsg)
          nodeB.gs.removeListener(topic, shouldNotHappen)
          done()
        }
      }

      const msgs = []
      times(10, () => msgs.push(Buffer.from('banana')))
      nodeB.gs.publish(topic, msgs)
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeA
    let nodeB
    const topic = 'Z'

    beforeEach(async function () {
      this.timeout(4000)
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])
      await dialNode(nodeA, nodeB.peerInfo)

      nodeA.gs.subscribe(topic)
      nodeB.gs.subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodeA.gs.once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodeA.gs.once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve))
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('Unsubscribe from a topic', async () => {
      nodeA.gs.unsubscribe(topic)
      expect(nodeA.gs.subscriptions.size).to.equal(0)

      const [changedPeerInfo, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodeB.gs.once('pubsub:subscription-change', (...args) => resolve(args))
      })
      await new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve))

      expect(nodeB.gs.peers.size).to.equal(1)
      expectSet(first(nodeB.gs.peers).topics, [])
      expect(changedPeerInfo.id.toB58String()).to.equal(first(nodeB.gs.peers).info.id.toB58String())
      expectSet(changedTopics, [])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: false }])
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeA.gs.unsubscribe(topic)
      await new Promise((resolve) => nodeB.gs.once('pubsub:subscription-change', resolve))
      await new Promise((resolve) => nodeB.gs.once('gossipsub:heartbeat', resolve))

      const promise = new Promise((resolve, reject) => {
        nodeA.gs.once(topic, reject)
        setTimeout(() => {
          nodeA.gs.removeListener(topic, reject)
          resolve()
        }, 100)
      })

      nodeB.gs.publish('Z', Buffer.from('banana'))
      nodeA.gs.publish('Z', Buffer.from('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })

  describe('nodes send state on connection', () => {
    let nodeA
    let nodeB

    before(async () => {
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('existing subscriptions are sent upon peer connection', async function () {
      this.timeout(5000)
      nodeA.gs.subscribe('Za')
      nodeB.gs.subscribe('Zb')

      expect(nodeA.gs.peers.size).to.equal(0)
      expectSet(nodeA.gs.subscriptions, ['Za'])
      expect(nodeB.gs.peers.size).to.equal(0)
      expectSet(nodeB.gs.subscriptions, ['Zb'])

      await dialNode(nodeA, nodeB.peerInfo)

      await Promise.all([
        new Promise((resolve) => nodeA.gs.once('pubsub:subscription-change', resolve)),
        new Promise((resolve) => nodeB.gs.once('pubsub:subscription-change', resolve))
      ])
      expect(nodeA.gs.peers.size).to.equal(1)
      expect(nodeB.gs.peers.size).to.equal(1)

      expectSet(nodeA.gs.subscriptions, ['Za'])
      expect(nodeB.gs.peers.size).to.equal(1)
      expectSet(first(nodeB.gs.peers).topics, ['Za'])

      expectSet(nodeB.gs.subscriptions, ['Zb'])
      expect(nodeA.gs.peers.size).to.equal(1)
      expectSet(first(nodeA.gs.peers).topics, ['Zb'])
    })
  })

  describe('nodes handle stopping', () => {
    let nodeA
    let nodeB

    before(async () => {
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])

      await dialNode(nodeA, nodeB.peerInfo)
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('nodes don\'t have peers after stopped', async () => {
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      expect(nodeA.gs.peers.size).to.equal(0)
      expect(nodeB.gs.peers.size).to.equal(0)
    })
  })

  describe('prevent concurrent dials', () => {
    let sandbox
    let nodeA
    let nodeB

    before(async () => {
      sandbox = chai.spy.sandbox()
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      // Put node B in node A's peer book
      nodeA.peerBook.put(nodeB.peerInfo)

      await startNode(nodeB.gs)
    })

    after(async function () {
      this.timeout(4000)
      sandbox.restore()
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('does not dial twice to same peer', async () => {
      sandbox.on(nodeA.gs, ['_onDial'])

      // When node A starts, it will dial all peers in its peer book, which
      // is just peer B
      await startNode(nodeA.gs)

      // Simulate a connection coming in from peer B at the same time. This
      // causes gossipsub to dial peer B
      nodeA.emit('peer:connect', nodeB.peerInfo)

      await new Promise((resolve) => setTimeout(resolve, 1000))
      // Check that only one dial was made
      expect(nodeA.gs._onDial).to.have.been.called.once()
    })
  })

  describe('allow dials even after error', () => {
    let sandbox
    let nodeA
    let nodeB

    before(async () => {
      sandbox = chai.spy.sandbox()

      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      // Put node B in node A's peer book
      nodeA.peerBook.put(nodeB.peerInfo)

      await startNode(nodeB.gs)
    })

    after(async function () {
      this.timeout(4000)
      sandbox.restore()
      await Promise.all([
        stopNode(nodeA.gs),
        stopNode(nodeB.gs)
      ])
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('can dial again after error', (done) => {
      let firstTime = true
      const dialProtocol = nodeA.gs.libp2p.dialProtocol.bind(nodeA.gs.libp2p)
      sandbox.on(nodeA.gs.libp2p, 'dialProtocol', (peerInfo, multicodec, cb) => {
        // Return an error for the first dial
        if (firstTime) {
          firstTime = false
          return cb(new Error('dial error'))
        }

        // Subsequent dials proceed as normal
        dialProtocol(peerInfo, multicodec, cb)
      })

      // When node A starts, it will dial all peers in its peer book, which
      // is just peer B
      nodeA.gs.start(startComplete)

      function startComplete () {
        // Simulate a connection coming in from peer B. This causes gossipsub
        // to dial peer B
        nodeA.emit('peer:connect', nodeB.peerInfo)

        // Check that both dials were made
        setTimeout(() => {
          expect(nodeA.gs.libp2p.dialProtocol).to.have.been.called.twice()
          done()
        }, 1000)
      }
    })
  })

  describe('prevent processing dial after stop', () => {
    let sandbox
    let nodeA
    let nodeB

    before(async () => {
      sandbox = chai.spy.sandbox()

      nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeB = await createNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeA)
      await startNode(nodeB)

      // Put node B in node A's peer book
      nodeA.peerBook.put(nodeB.peerInfo)

      await Promise.all([
        startNode(nodeA.gs),
        startNode(nodeB.gs)
      ])
    })

    after(async function () {
      this.timeout(4000)
      sandbox.restore()
      await stopNode(nodeB.gs)
      await Promise.all([
        stopNode(nodeA),
        stopNode(nodeB)
      ])
    })

    it('does not process dial after stop', (done) => {
      sandbox.on(nodeA.gs, ['_onDial'])

      // Simulate a connection coming in from peer B at the same time. This
      // causes gossipsub to dial peer B
      nodeA.emit('peer:connect', nodeB.peerInfo)

      // Stop gossipsub before the dial can complete
      nodeA.gs.stop(() => {
        // Check that the dial was not processed
        setTimeout(() => {
          expect(nodeA.gs._onDial).to.not.have.been.called()
          done()
        }, 1000)
      })
    })
  })
})

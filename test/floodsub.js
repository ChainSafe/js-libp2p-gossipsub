/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))

const expect = chai.expect
const times = require('lodash/times')

const {
  createNode,
  createFloodsubNode,
  expectSet,
  first,
  dialNode,
  startNode,
  stopNode
} = require('./utils')

const shouldNotHappen = () => expect.fail()

describe('gossipsub fallbacks to floodsub', () => {
  describe('basics', () => {
    let nodeGs
    let nodeFs

    beforeEach(async () => {
      nodeGs = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeFs = await createFloodsubNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeGs)
      await startNode(nodeFs)

      await Promise.all([
        startNode(nodeGs.gs),
        startNode(nodeFs.fs)
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs.gs),
        stopNode(nodeFs.fs)
      ])
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Dial from nodeGs to nodeFs', async () => {
      await dialNode(nodeGs, nodeFs.peerInfo)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      expect(nodeGs.gs.peers.size).to.equal(1)
      expect(nodeFs.fs.peers.size).to.equal(1)
    })
  })

  describe('should not be added if fallback disabled', () => {
    let nodeGs
    let nodeFs

    beforeEach(async () => {
      nodeGs = await createNode('/ip4/127.0.0.1/tcp/0', { fallbackToFloodsub: false })
      nodeFs = await createFloodsubNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeGs)
      await startNode(nodeFs)

      await Promise.all([
        startNode(nodeGs.gs),
        startNode(nodeFs.fs)
      ])
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs.gs),
        stopNode(nodeFs.fs)
      ])
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Dial from nodeGs to nodeFs', async () => {
      await dialNode(nodeGs, nodeFs.peerInfo)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // Peers not added to the pubsub set
      expect(nodeGs.gs.peers.size).to.equal(0)
      expect(nodeFs.fs.peers.size).to.equal(0)
    })
  })

  describe('subscription functionality', () => {
    let nodeGs
    let nodeFs

    beforeEach(async () => {
      nodeGs = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeFs = await createFloodsubNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeGs)
      await startNode(nodeFs)

      await Promise.all([
        startNode(nodeGs.gs),
        startNode(nodeFs.fs)
      ])

      await dialNode(nodeGs, nodeFs.peerInfo)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs.gs),
        stopNode(nodeFs.fs)
      ])
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Subscribe to a topic', async function () {
      this.timeout(10000)
      const topic = 'Z'
      nodeGs.gs.subscribe(topic)
      nodeFs.fs.subscribe(topic)

      // await subscription change
      const [changedPeerInfo, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodeGs.gs.once('pubsub:subscription-change', (...args) => resolve(args))
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))

      expectSet(nodeGs.gs.subscriptions, [topic])
      expectSet(nodeFs.fs.subscriptions, [topic])
      expect(nodeGs.gs.peers.size).to.equal(1)
      expect(nodeFs.fs.peers.size).to.equal(1)
      expectSet(first(nodeGs.gs.peers).topics, [topic])
      expectSet(first(nodeFs.fs.peers).topics, [topic])

      expect(changedPeerInfo.id.toB58String()).to.equal(first(nodeGs.gs.peers).info.id.toB58String())
      expectSet(changedTopics, [topic])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: true }])
    })
  })

  describe('publish functionality', () => {
    let nodeGs
    let nodeFs
    const topic = 'Z'

    beforeEach(async function () {
      this.timeout(4000)
      nodeGs = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeFs = await createFloodsubNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeGs)
      await startNode(nodeFs)

      await Promise.all([
        startNode(nodeGs.gs),
        startNode(nodeFs.fs)
      ])
      await dialNode(nodeGs, nodeFs.peerInfo)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      nodeGs.gs.subscribe(topic)
      nodeFs.fs.subscribe(topic)

      // await subscription change
      await new Promise((resolve) => nodeGs.gs.once('pubsub:subscription-change', resolve))
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs.gs),
        stopNode(nodeFs.fs)
      ])
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Publish to a topic - nodeGs', async () => {
      const promise = new Promise((resolve) => nodeFs.fs.once(topic, resolve))
      nodeGs.gs.once(topic, (m) => shouldNotHappen)

      nodeGs.gs.publish(topic, Buffer.from('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodeGs.gs.libp2p.peerInfo.id.toB58String())

      nodeGs.gs.removeListener(topic, shouldNotHappen)
    })

    it('Publish to a topic - nodeFs', async () => {
      const promise = new Promise((resolve) => nodeGs.gs.once(topic, resolve))

      nodeFs.fs.publish(topic, Buffer.from('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodeFs.fs.libp2p.peerInfo.id.toB58String())

      nodeFs.fs.removeListener(topic, shouldNotHappen)
    })

    it('Publish 10 msg to a topic', (done) => {
      let counter = 0

      nodeGs.gs.once(topic, shouldNotHappen)

      nodeFs.fs.on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(nodeGs.gs.libp2p.peerInfo.id.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodeFs.fs.removeListener(topic, receivedMsg)
          nodeGs.gs.removeListener(topic, shouldNotHappen)
          done()
        }
      }

      times(10, () => nodeGs.gs.publish(topic, Buffer.from('banana')))
    })

    it('Publish 10 msg to a topic as array', (done) => {
      let counter = 0

      nodeGs.gs.once(topic, shouldNotHappen)

      nodeFs.fs.on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(nodeGs.gs.libp2p.peerInfo.id.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodeFs.fs.removeListener(topic, receivedMsg)
          nodeGs.gs.removeListener(topic, shouldNotHappen)
          done()
        }
      }

      const msgs = []
      times(10, () => msgs.push(Buffer.from('banana')))
      nodeGs.gs.publish(topic, msgs)
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeGs
    let nodeFs
    const topic = 'Z'

    beforeEach(async function () {
      this.timeout(4000)
      nodeGs = await createNode('/ip4/127.0.0.1/tcp/0')
      nodeFs = await createFloodsubNode('/ip4/127.0.0.1/tcp/0')
      await startNode(nodeGs)
      await startNode(nodeFs)

      await Promise.all([
        startNode(nodeGs.gs),
        startNode(nodeFs.fs)
      ])
      await dialNode(nodeGs, nodeFs.peerInfo)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      nodeGs.gs.subscribe(topic)
      nodeFs.fs.subscribe(topic)

      // await subscription change
      await new Promise((resolve) => nodeGs.gs.once('pubsub:subscription-change', resolve))
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        stopNode(nodeGs.gs),
        stopNode(nodeFs.fs)
      ])
      await Promise.all([
        stopNode(nodeGs),
        stopNode(nodeFs)
      ])
    })

    it('Unsubscribe from a topic', async () => {
      nodeGs.gs.unsubscribe(topic)
      expect(nodeGs.gs.subscriptions.size).to.equal(0)

      const [changedPeerInfo, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodeFs.fs.once('floodsub:subscription-change', (...args) => resolve(args))
      })

      expect(nodeFs.fs.peers.size).to.equal(1)
      expectSet(first(nodeFs.fs.peers).topics, [])
      expect(changedPeerInfo.id.toB58String()).to.equal(first(nodeFs.fs.peers).info.id.toB58String())
      expectSet(changedTopics, [])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: false }])
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeGs.gs.unsubscribe(topic)
      await new Promise((resolve) => nodeFs.fs.once('floodsub:subscription-change', resolve))

      const promise = new Promise((resolve, reject) => {
        nodeGs.gs.once(topic, reject)
        setTimeout(() => {
          nodeGs.gs.removeListener(topic, reject)
          resolve()
        }, 100)
      })

      nodeFs.fs.publish('Z', Buffer.from('banana'))
      nodeGs.gs.publish('Z', Buffer.from('banana'))

      try {
        await promise
      } catch (e) {
        expect.fail('message should not be received')
      }
    })
  })
})

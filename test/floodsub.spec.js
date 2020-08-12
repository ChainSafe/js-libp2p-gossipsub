/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const uint8ArrayFromString = require('uint8arrays/from-string')

const expect = chai.expect
const times = require('lodash/times')

const { multicodec: floodsubMulticodec } = require('libp2p-floodsub')

const {
  createGossipsub,
  createFloodsubNode,
  expectSet,
  createMockRegistrar,
  ConnectionPair,
  first
} = require('./utils')

describe('gossipsub fallbacks to floodsub', () => {
  let registrarRecords = Array.from({ length: 2 })

  describe('basics', () => {
    let nodeGs
    let nodeFs

    beforeEach(async () => {
      registrarRecords[0] = {}
      registrarRecords[1] = {}

      nodeGs = await createGossipsub(createMockRegistrar(registrarRecords[0]), true)
      nodeFs = await createFloodsubNode(createMockRegistrar(registrarRecords[1]), true)
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Dial event happened from nodeGs to nodeFs', () => {
      const onConnectGs = registrarRecords[0][floodsubMulticodec].onConnect
      const onConnectFs = registrarRecords[1][floodsubMulticodec].onConnect

      expect(onConnectGs).to.exist()
      expect(onConnectFs).to.exist()

      // Notice peers of connection
      const [d0, d1] = ConnectionPair()
      onConnectGs(nodeFs.peerId, d0)
      onConnectFs(nodeGs.peerId, d1)

      expect(nodeGs.peers.size).to.equal(1)
      expect(nodeFs.peers.size).to.equal(1)
    })
  })

  describe('should not be added if fallback disabled', () => {
    let nodeGs
    let nodeFs

    before(async () => {
      registrarRecords[0] = {}
      registrarRecords[1] = {}

      nodeGs = await createGossipsub(createMockRegistrar(registrarRecords[0]), true, { fallbackToFloodsub: false })
      nodeFs = await createFloodsubNode(createMockRegistrar(registrarRecords[1]), true)
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Dial event happened from nodeGs to nodeFs, but NodeGs does not support floodsub', () => {
      let onConnectGs
      let onConnectFs

      try {
        onConnectFs = registrarRecords[1][floodsubMulticodec].onConnect
        onConnectGs = registrarRecords[0][floodsubMulticodec].onConnect
      } catch (err) {
        expect(err).to.exist()
        expect(onConnectFs).to.exist()
        expect(onConnectGs).to.not.exist()

        expect(nodeGs.peers.size).to.equal(0)
        expect(nodeFs.peers.size).to.equal(0)
        return
      }
      throw new Error('should not have floodsub handler')
    })
  })

  describe('subscription functionality', () => {
    let nodeGs
    let nodeFs

    before(async () => {
      registrarRecords[0] = {}
      registrarRecords[1] = {}

      nodeGs = await createGossipsub(createMockRegistrar(registrarRecords[0]), true)
      nodeFs = await createFloodsubNode(createMockRegistrar(registrarRecords[1]), true)

      const onConnectGs = registrarRecords[0][floodsubMulticodec].onConnect
      const onConnectFs = registrarRecords[1][floodsubMulticodec].onConnect
      const handleGs = registrarRecords[0][floodsubMulticodec].handler
      const handleFs = registrarRecords[1][floodsubMulticodec].handler

      // Notice peers of connection
      const [d0, d1] = ConnectionPair()
      await onConnectGs(nodeFs.peerId, d0)
      await handleFs({
        protocol: floodsubMulticodec,
        stream: d1.stream,
        connection: {
          remotePeer: nodeGs.peerId
        }
      })
      await onConnectFs(nodeGs.peerId, d1)
      await handleGs({
        protocol: floodsubMulticodec,
        stream: d0.stream,
        connection: {
          remotePeer: nodeFs.peerId
        }
      })
    })

    after(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Subscribe to a topic', async function () {
      this.timeout(10000)
      const topic = 'Z'
      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      const [changedPeerId, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodeGs.once('pubsub:subscription-change', (...args) => resolve(args))
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))

      expectSet(nodeGs.subscriptions, [topic])
      expectSet(nodeFs.subscriptions, [topic])
      expect(nodeGs.peers.size).to.equal(1)
      expect(nodeFs.peers.size).to.equal(1)
      expectSet(first(nodeGs.peers).topics, [topic])
      expectSet(first(nodeFs.peers).topics, [topic])

      expect(changedPeerId.toB58String()).to.equal(first(nodeGs.peers).id.toB58String())
      expectSet(changedTopics, [topic])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: true }])
    })
  })

  describe('publish functionality', () => {
    let nodeGs
    let nodeFs
    const topic = 'Z'

    beforeEach(async () => {
      registrarRecords = Array.from({ length: 2 })
      registrarRecords[0] = {}
      registrarRecords[1] = {}

      nodeGs = await createGossipsub(createMockRegistrar(registrarRecords[0]), true)
      nodeFs = await createFloodsubNode(createMockRegistrar(registrarRecords[1]), true)

      const onConnectGs = registrarRecords[0][floodsubMulticodec].onConnect
      const onConnectFs = registrarRecords[1][floodsubMulticodec].onConnect
      const handleGs = registrarRecords[0][floodsubMulticodec].handler
      const handleFs = registrarRecords[1][floodsubMulticodec].handler

      // Notice peers of connection
      const [d0, d1] = ConnectionPair()
      await onConnectGs(nodeFs.peerId, d0)
      await handleFs({
        protocol: floodsubMulticodec,
        stream: d1.stream,
        connection: {
          remotePeer: nodeGs.peerId
        }
      })
      await onConnectFs(nodeGs.peerId, d1)
      await handleGs({
        protocol: floodsubMulticodec,
        stream: d0.stream,
        connection: {
          remotePeer: nodeFs.peerId
        }
      })

      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      await new Promise((resolve) => nodeGs.once('pubsub:subscription-change', resolve))
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Publish to a topic - nodeGs', (done) => {
      const shouldNotHappen = () => {
        done(new Error('Should not be here'))
      }

      const promise = new Promise((resolve) => nodeFs.once(topic, resolve))
      nodeGs.once(topic, (m) => shouldNotHappen)

      nodeGs.publish(topic, uint8ArrayFromString('hey'))

      promise.then((msg) => {
        expect(msg.data.toString()).to.equal('hey')
        expect(msg.from).to.be.eql(nodeGs.peerId.toB58String())

        nodeGs.removeListener(topic, shouldNotHappen)
        done()
      }, done)
    })

    it('Publish to a topic - nodeFs', async () => {
      const promise = new Promise((resolve) => nodeGs.once(topic, resolve))

      nodeFs.publish(topic, uint8ArrayFromString('banana'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('banana')
      expect(msg.from).to.be.eql(nodeFs.peerId.toB58String())
    })

    it.skip('Publish 10 msg to a topic', (done) => {
      let counter = 0

      const shouldNotHappen = (msg) => {
        done(new Error('Should not be here'))
      }

      nodeGs.once(topic, shouldNotHappen)
      nodeFs.on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana ' + counter)
        expect(msg.from).to.be.eql(nodeGs.peerId.toB58String())
        expect(msg.seqno).to.be.a('Uint8Array')
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodeFs.removeListener(topic, receivedMsg)
          nodeGs.removeListener(topic, shouldNotHappen)
          done()
        }
      }

      times(10, (index) => nodeGs.publish(topic, uint8ArrayFromString('banana ' + index)))
    })

    it.skip('Publish 10 msg to a topic as array', (done) => {
      let counter = 0

      const shouldNotHappen = () => {
        done(new Error('Should not be here'))
      }

      nodeGs.once(topic, shouldNotHappen)

      nodeFs.on(topic, receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana ' + counter)
        expect(msg.from).to.be.eql(nodeGs.peerId.toB58String())
        expect(msg.seqno).to.be.a('Uint8Array')
        expect(msg.topicIDs).to.be.eql([topic])

        if (++counter === 10) {
          nodeFs.removeListener(topic, receivedMsg)
          nodeGs.removeListener(topic, shouldNotHappen)
          done()
        }
      }

      const msgs = []
      times(10, (index) => msgs.push(uint8ArrayFromString('banana ' + index)))
      nodeGs.publish(topic, msgs)
    })
  })

  describe('publish after unsubscribe', () => {
    let nodeGs
    let nodeFs
    const topic = 'Z'

    beforeEach(async () => {
      registrarRecords[0] = {}
      registrarRecords[1] = {}

      nodeGs = await createGossipsub(createMockRegistrar(registrarRecords[0]), true)
      nodeFs = await createFloodsubNode(createMockRegistrar(registrarRecords[1]), true)

      const onConnectGs = registrarRecords[0][floodsubMulticodec].onConnect
      const onConnectFs = registrarRecords[1][floodsubMulticodec].onConnect
      const handleGs = registrarRecords[0][floodsubMulticodec].handler
      const handleFs = registrarRecords[1][floodsubMulticodec].handler

      // Notice peers of connection
      const [d0, d1] = ConnectionPair()
      await onConnectGs(nodeFs.peerId, d0)
      await handleFs({
        protocol: floodsubMulticodec,
        stream: d1.stream,
        connection: {
          remotePeer: nodeGs.peerId
        }
      })
      await onConnectFs(nodeGs.peerId, d1)
      await handleGs({
        protocol: floodsubMulticodec,
        stream: d0.stream,
        connection: {
          remotePeer: nodeFs.peerId
        }
      })

      nodeGs.subscribe(topic)
      nodeFs.subscribe(topic)

      // await subscription change
      await new Promise((resolve) => nodeGs.once('pubsub:subscription-change', resolve))
    })

    afterEach(async function () {
      this.timeout(4000)
      await Promise.all([
        nodeGs.stop(),
        nodeFs.stop()
      ])
    })

    it('Unsubscribe from a topic', async () => {
      nodeGs.unsubscribe(topic)
      expect(nodeGs.subscriptions.size).to.equal(0)

      const [changedPeerId, changedTopics, changedSubs] = await new Promise((resolve) => {
        nodeFs.once('floodsub:subscription-change', (...args) => resolve(args))
      })

      expect(nodeFs.peers.size).to.equal(1)
      expectSet(first(nodeFs.peers).topics, [])
      expect(changedPeerId.toB58String()).to.equal(first(nodeFs.peers).id.toB58String())
      expectSet(changedTopics, [])
      expect(changedSubs).to.be.eql([{ topicID: topic, subscribe: false }])
    })

    it('Publish to a topic after unsubscribe', async () => {
      nodeGs.unsubscribe(topic)
      await new Promise((resolve) => nodeFs.once('floodsub:subscription-change', resolve))

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

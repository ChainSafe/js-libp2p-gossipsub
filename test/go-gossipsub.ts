import chai from 'chai'
import delay from 'delay'
import errcode from 'err-code'
import sinon from 'sinon'
import pRetry from 'p-retry'
import { EventEmitter } from 'events'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import PubsubBaseProtocol, { InMessage } from 'libp2p-interfaces/src/pubsub'
import { IRPC, RPC } from '../ts/message/rpc'
import { TopicScoreParams } from '../ts/score'
import Floodsub from 'libp2p-floodsub'
import Gossipsub from '../ts'
import * as constants from '../ts/constants'
import { GossipsubD } from '../ts/constants'
import {
  createGossipsubs,
  sparseConnect,
  denseConnect,
  stopNode,
  connectSome,
  connectGossipsub,
  expectSet,
  fastMsgIdFn,
  tearDownGossipsubs,
  createPeers
} from './utils'
import PeerId from 'peer-id'

/**
 * These tests were translated from:
 *   https://github.com/libp2p/go-libp2p-pubsub/blob/master/gossipsub_test.go
 */

const expect = chai.expect
chai.use(require('dirty-chai'))

EventEmitter.defaultMaxListeners = 100

const checkReceivedSubscription = (psub: Gossipsub, peerIdStr: string, topic: string, peerIdx: number) => new Promise<void> ((resolve, reject) => {
  const event = 'pubsub:subscription-change'
  let cb: (peerId: PeerId) => void
  const t = setTimeout(() => reject(`Not received subscriptions of psub ${peerIdx}`), 1000)
  cb = (peerId) => {
    if (peerId.toB58String() === peerIdStr) {
      clearTimeout(t)
      psub.off(event, cb)
      expect(Array.from(psub.topics.get(topic) || []).includes(peerIdStr), 'topics should include the peerId').to.be.true
      resolve()
    }
  }
  psub.on(event, cb);
});

const checkReceivedSubscriptions = async (psub: Gossipsub, peerIdStrs: string[], topic: string) => {
  const recvPeerIdStrs = peerIdStrs.filter((peerIdStr) => peerIdStr !== psub.peerId.toB58String())
  const promises = recvPeerIdStrs.map((peerIdStr, idx) => checkReceivedSubscription(psub, peerIdStr, topic, idx))
  await Promise.all(promises)
  expect(Array.from(psub.topics.get(topic) || []).sort()).to.be.deep.equal(recvPeerIdStrs.sort())
}

/**
 * Given a topic and data (and debug metadata -- sender index and msg index)
 * Return a function (takes a gossipsub (and receiver index))
 * that returns a Promise that awaits the message being received
 * and checks that the received message equals the given message
 */
const checkReceivedMessage =
  (topic: string, data: Uint8Array, senderIx: number, msgIx: number) => (psub: EventEmitter, receiverIx: number) =>
    new Promise<void>((resolve, reject) => {
      let cb: (msg: InMessage) => void
      const t = setTimeout(() => {
        psub.off(topic, cb)
        reject(new Error(`Message never received, sender ${senderIx}, receiver ${receiverIx}, index ${msgIx}`))
      }, 20000)
      cb = (msg: InMessage) => {
        if (uint8ArrayEquals(data, msg.data)) {
          clearTimeout(t)
          psub.off(topic, cb)
          resolve()
        }
      }
      psub.on(topic, cb)
    })

const awaitEvents = (emitter: EventEmitter, event: string, number: number, timeout = 10000) => {
  return new Promise<void>((resolve, reject) => {
    let cb: () => void
    let counter = 0
    const t = setTimeout(() => {
      emitter.off(event, cb)
      reject(new Error(`${counter} of ${number} '${event}' events received`))
    }, timeout)
    cb = () => {
      counter++
      if (counter >= number) {
        clearTimeout(t)
        emitter.off(event, cb)
        resolve()
      }
    }
    emitter.on(event, cb)
  })
}

describe('go-libp2p-pubsub gossipsub tests', function () {
  this.timeout(100000)
  afterEach(() => {
    sinon.restore()
  })
  it('test sparse gossipsub', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes
    // Sparsely connect the nodes
    // Publish 100 messages, each from a random node
    // Assert that subscribed nodes receive the message
    const psubs = await createGossipsubs({
      number: 20,
      options: { floodPublish: false, scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    psubs.forEach((ps) => ps.subscribe(topic))

    await sparseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)

      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test dense gossipsub', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes
    // Densely connect the nodes
    // Publish 100 messages, each from a random node
    // Assert that subscribed nodes receive the message
    const psubs = await createGossipsubs({
      number: 20,
      options: { floodPublish: false, scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    psubs.forEach((ps) => ps.subscribe(topic))

    await denseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub fanout', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes except the first
    // Densely connect the nodes
    // Publish 100 messages, each from the first node
    // Assert that subscribed nodes receive the message
    // Subscribe to the topic, first node
    // Publish 100 messages, each from the first node
    // Assert that subscribed nodes receive the message
    const psubs = await createGossipsubs({
      number: 20,
      options: { floodPublish: false, scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    psubs.slice(1).forEach((ps) => ps.subscribe(topic))

    await denseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)

      const owner = 0

      const results = Promise.all(
        psubs
          .slice(1)
          .filter((psub, j) => j !== owner)
          .map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)

    psubs[0].subscribe(topic)

    // wait for a heartbeat
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 1)))

    sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`2nd - ${i} its not a flooooood ${i}`)

      const owner = 0

      const results = Promise.all(
        psubs
          .slice(1)
          .filter((psub, j) => j !== owner)
          .map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub fanout maintenance', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes except the first
    // Densely connect the nodes
    // Publish 100 messages, each from the first node
    // Assert that subscribed nodes receive the message
    // Unsubscribe to the topic, all nodes except the first
    // Resubscribe to the topic, all nodes except the first
    // Publish 100 messages, each from the first node
    // Assert that the subscribed nodes receive the message
    const psubs = await createGossipsubs({
      number: 20,
      options: { floodPublish: false, scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    psubs.slice(1).forEach((ps) => ps.subscribe(topic))

    await denseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv: Promise<unknown>[] = []
    const sendMessages = (time: number) => {
      for (let i = 0; i < 100; i++) {
        const msg = uint8ArrayFromString(`${time} ${i} its not a flooooood ${i}`)

        const owner = 0

        const results = Promise.all(
          psubs
            .slice(1)
            .filter((psub, j) => j !== owner)
            .map(checkReceivedMessage(topic, msg, owner, i))
        )
        sendRecv.push(psubs[owner].publish(topic, msg))
        sendRecv.push(results)
      }
    }
    sendMessages(1)
    await Promise.all(sendRecv)

    psubs.slice(1).forEach((ps) => ps.unsubscribe(topic))

    // wait for heartbeats
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    psubs.slice(1).forEach((ps) => ps.subscribe(topic))

    // wait for heartbeats
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    sendRecv = []
    sendMessages(2)
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub fanout expiry', async function () {
    // Create 10 gossipsub nodes
    // Subscribe to the topic, all nodes except the first
    // Densely connect the nodes
    // Publish 5 messages, each from the first node
    // Assert that the subscribed nodes receive every message
    // Assert that the first node has fanout peers
    // Wait until fanout expiry
    // Assert that the first node has no fanout
    sinon.replace(constants, 'GossipsubFanoutTTL', 1000)
    const psubs = await createGossipsubs({
      number: 10,
      options: {
        scoreParams: { IPColocationFactorThreshold: 20 },
        floodPublish: false
      }
    })
    const topic = 'foobar'
    psubs.slice(1).forEach((ps) => ps.subscribe(topic))

    await denseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv = []
    for (let i = 0; i < 5; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)

      const owner = 0

      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)

    expect(psubs[0].fanout.size).to.be.gt(0)

    // wait for TTL to expore fanout peers in owner
    await delay(2000)

    expect(psubs[0].fanout.size).to.be.eql(0)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub gossip', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes
    // Densely connect the nodes
    // Publish 100 messages, each from a random node
    // Assert that the subscribed nodes receive the message
    // Wait a bit between each message so gossip can be interleaved
    const psubs = await createGossipsubs({
      number: 20,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    psubs.forEach((ps) => ps.subscribe(topic))

    await denseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      await psubs[owner].publish(topic, msg)
      await results
      // wait a bit to have some gossip interleaved
      await delay(100)
    }
    // and wait for some gossip flushing
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub gossip propagation', async function () {
    // Create 20 gossipsub nodes
    // Split into two groups, just a single node shared between
    // Densely connect each group to itself
    // Subscribe to the topic, first group minus the shared node
    // Publish 10 messages, each from the shared node
    // Assert that the first group receives the messages
    // Subscribe to the topic, second group minus the shared node
    // Assert that the second group receives the messages (via gossip)
    const psubs = await createGossipsubs({
      number: 20,
      options: { floodPublish: false, scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    const group1 = psubs.slice(0, GossipsubD + 1)
    const group2 = psubs.slice(GossipsubD + 1)
    group2.unshift(psubs[0])

    await denseConnect(group1)
    await denseConnect(group2)

    group1.slice(1).forEach((ps) => ps.subscribe(topic))

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 3)))

    let sendRecv = []
    for (let i = 0; i < 10; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = 0
      const results = Promise.all(group1.slice(1).map(checkReceivedMessage(topic, msg, owner, i)))
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)

    await delay(100)

    psubs.slice(GossipsubD + 1).forEach((ps) => ps.subscribe(topic))

    const received: InMessage[][] = Array.from({ length: psubs.length - (GossipsubD + 1) }, () => [])
    const results = Promise.all(
      group2.slice(1).map(
        (ps, ix) =>
          new Promise<void>((resolve, reject) => {
            const t = setTimeout(reject, 10000)
            ps.on(topic, (m: InMessage) => {
              received[ix].push(m)
              if (received[ix].length >= 10) {
                clearTimeout(t)
                resolve()
              }
            })
          })
      )
    )
    try {
      await results
    } catch (e) {
      expect.fail(e)
    }

    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub prune', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes
    // Densely connect nodes
    // Unsubscribe to the topic, first 5 nodes
    // Publish 100 messages, each from a random node
    // Assert that the subscribed nodes receive every message
    const psubs = await createGossipsubs({
      number: 20,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'
    psubs.forEach((ps) => ps.subscribe(topic))

    await denseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    // disconnect some peers from the mesh to get some PRUNEs
    psubs.slice(0, 5).forEach((ps) => ps.unsubscribe(topic))

    // wait a bit to take effect
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 1)))

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs
          .slice(5)
          .filter((psub, j) => j + 5 !== owner)
          .map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub graft', async function () {
    // Create 20 gossipsub nodes
    // Sparsely connect nodes
    // Subscribe to the topic, all nodes, waiting for each subscription to propagate first
    // Publish 100 messages, each from a random node
    // Assert that the subscribed nodes receive every message
    const psubs = await createGossipsubs({
      number: 20,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'

    await sparseConnect(psubs)

    psubs.forEach(async (ps) => {
      ps.subscribe(topic)
      // wait for announce to propagate
      await delay(100)
    })

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub remove peer', async function () {
    // Create 20 gossipsub nodes
    // Subscribe to the topic, all nodes
    // Densely connect nodes
    // Stop 5 nodes
    // Publish 100 messages, each from a random still-started node
    // Assert that the subscribed nodes receive every message
    const psubs = await createGossipsubs({
      number: 20,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'

    await denseConnect(psubs)

    psubs.forEach(async (ps) => ps.subscribe(topic))

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    // disconnect some peers to exercise _removePeer paths
    await Promise.all(psubs.slice(0, 5).map((ps) => stopNode(ps)))

    // wait a bit
    await delay(2000)

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * (psubs.length - 5))
      const results = Promise.all(
        psubs
          .slice(5)
          .filter((psub, j) => j !== owner)
          .map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs.slice(5)[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub graft prune retry', async function () {
    // Create 10 gossipsub nodes
    // Densely connect nodes
    // Subscribe to 35 topics, all nodes
    // Publish a message from each topic, each from a random node
    // Assert that the subscribed nodes receive every message
    const psubs = await createGossipsubs({
      number: 10,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'

    await denseConnect(psubs)

    for (let i = 0; i < 35; i++) {
      psubs.forEach(async (ps) => ps.subscribe(topic + i))
    }

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 9)))

    for (let i = 0; i < 35; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic + i, msg, owner, i))
      )
      await psubs[owner].publish(topic + i, msg)
      await delay(20)
      await results
    }

    await tearDownGossipsubs(psubs)
  })
  it.skip('test gossipsub control piggyback', async function () {
    // Create 10 gossipsub nodes
    // Densely connect nodes
    // Subscribe to a 'flood' topic, all nodes
    // Publish 10k messages on the flood topic, each from a random node, in the background
    // Subscribe to 5 topics, all nodes
    // Wait for the flood to stop
    // Publish a message to each topic, each from a random node
    // Assert that subscribed nodes receive each message
    // Publish a message from each topic, each from a random node
    // Assert that the subscribed nodes receive every message
    const psubs = await createGossipsubs({
      number: 10,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'

    await denseConnect(psubs)

    const floodTopic = 'flood'
    psubs.forEach((ps) => ps.subscribe(floodTopic))

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 1)))

    // create a background flood of messages that overloads the queues
    const floodOwner = Math.floor(Math.random() * psubs.length)
    const floodMsg = uint8ArrayFromString('background flooooood')
    const backgroundFlood = new Promise<void>(async (resolve) => {
      for (let i = 0; i < 10000; i++) {
        await psubs[floodOwner].publish(floodTopic, floodMsg)
      }
      resolve()
    })

    await delay(20)

    // and subscribe to a bunch of topics in the meantime -- this should
    // result in some dropped control messages, with subsequent piggybacking
    // in the background flood
    for (let i = 0; i < 5; i++) {
      psubs.forEach((ps) => ps.subscribe(topic + i))
    }

    // wait for the flood to stop
    await backgroundFlood

    // and test that we have functional overlays
    let sendRecv: Promise<unknown>[] = []
    for (let i = 0; i < 5; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic + i, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic + i, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })
  it('test mixed gossipsub', async function () {
    // Create 20 gossipsub nodes
    // Create 10 floodsub nodes
    // Subscribe to the topic, all nodes
    // Sparsely connect nodes
    // Publish 100 messages, each from a random node
    // Assert that the subscribed nodes receive every message
    const libp2ps = await createPeers({ number: 30 })
    const gsubs: PubsubBaseProtocol[] = libp2ps.slice(0, 20).map((libp2p) => {
      return new Gossipsub(libp2p, { scoreParams: { IPColocationFactorThreshold: 20 }, fastMsgIdFn })
    })
    const fsubs = libp2ps.slice(20).map((libp2p) => {
      const fs = new Floodsub(libp2p)
      fs._libp2p = libp2p
      return fs
    })
    const psubs = gsubs.concat(fsubs)
    await Promise.all(psubs.map((ps) => ps.start()))

    const topic = 'foobar'
    psubs.forEach((ps) => ps.subscribe(topic))

    await sparseConnect(psubs)

    // wait for heartbeats to build mesh
    await Promise.all(gsubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    let sendRecv = []
    for (let i = 0; i < 100; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = Math.floor(Math.random() * psubs.length)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })

  it('test gossipsub multihops', async function () {
    // Create 6 gossipsub nodes
    // Connect nodes in a line (eg: 0 -> 1 -> 2 -> 3 ...)
    // Subscribe to the topic, all nodes
    // Publish a message from node 0
    // Assert that the last node receives the message
    const numPeers = 6
    const psubs = await createGossipsubs({
      number: numPeers,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'

    for (let i = 0; i < numPeers - 1; i++) {
      await psubs[i]._libp2p.dialProtocol(psubs[i + 1]._libp2p.peerId, psubs[i].multicodecs)
    }
    const peerIdStrsByIdx: string[][] = []
    for (let i = 0; i < numPeers; i++) {
      if (i === 0) { // first
        peerIdStrsByIdx[i] = [psubs[i + 1].peerId.toB58String()]
      } else if (i > 0 && i < numPeers - 1) { // middle
        peerIdStrsByIdx[i] = [psubs[i + 1].peerId.toB58String(), psubs[i - 1].peerId.toB58String()]
      } else if (i === numPeers - 1) { // last
        peerIdStrsByIdx[i] = [psubs[i - 1].peerId.toB58String()]
      }
    }

    const subscriptionPromises = psubs.map((psub, i) => checkReceivedSubscriptions(psub, peerIdStrsByIdx[i], topic))
    psubs.forEach(ps => ps.subscribe(topic))

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))
    await Promise.all(subscriptionPromises)

    const msg = uint8ArrayFromString(`${0} its not a flooooood ${0}`)
    const owner = 0
    const results = checkReceivedMessage(topic, msg, owner, 0)(psubs[5], 5)
    await psubs[owner].publish(topic, msg)
    await results
    await tearDownGossipsubs(psubs)
  })

  it('test gossipsub tree topology', async function () {
    // Create 10 gossipsub nodes
    // Connect nodes in a tree, diagram below
    // Subscribe to the topic, all nodes
    // Assert that the nodes are peered appropriately
    // Publish two messages, one from either end of the tree
    // Assert that the subscribed nodes receive every message
    const psubs = await createGossipsubs({
      number: 10,
      options: { scoreParams: { IPColocationFactorThreshold: 20 } }
    })
    const topic = 'foobar'

    /*
     [0] -> [1] -> [2] -> [3]
      |      L->[4]
      v
     [5] -> [6] -> [7]
      |
      v
     [8] -> [9]
    */
    const multicodecs = psubs[0].multicodecs
    const treeTopology = [
      [1, 5], // 0
      [2, 4], // 1
      [3], // 2
      [], // 3 leaf
      [], // 4 leaf
      [6, 8], // 5
      [7], // 6
      [], // 7 leaf
      [9], // 8
      [], // 9 leaf
    ]
    for (let from = 0; from < treeTopology.length; from++) {
      for (let to of treeTopology[from]) {
        await psubs[from]._libp2p.dialProtocol(psubs[to]._libp2p.peerId, multicodecs)
      }
    }

    const getPeerIdStrs = (idx: number): string[] => {
      const outbounds = treeTopology[idx]
      const inbounds = []
      for (let i = 0; i < treeTopology.length; i++) {
        if (treeTopology[i].includes(idx)) inbounds.push(i)
      }
      return Array.from(new Set([...inbounds, ...outbounds])).map((i) => psubs[i].peerId.toB58String())
    }

    const subscriptionPromises = psubs.map((psub, i) => checkReceivedSubscriptions(psub, getPeerIdStrs(i), topic))
    psubs.forEach((ps) => ps.subscribe(topic))

    // wait for heartbeats to build mesh
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))
    await Promise.all(subscriptionPromises)

    expectSet(new Set(psubs[0].peers.keys()), [psubs[1].peerId.toB58String(), psubs[5].peerId.toB58String()])
    expectSet(new Set(psubs[1].peers.keys()), [
      psubs[0].peerId.toB58String(),
      psubs[2].peerId.toB58String(),
      psubs[4].peerId.toB58String()
    ])
    expectSet(new Set(psubs[2].peers.keys()), [psubs[1].peerId.toB58String(), psubs[3].peerId.toB58String()])

    let sendRecv = []
    for (const owner of [9, 3]) {
      const msg = uint8ArrayFromString(`${owner} its not a flooooood ${owner}`)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, owner))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })

  it('test gossipsub star topology with signed peer records', async function () {
    // Create 20 gossipsub nodes with lower degrees
    // Connect nodes to a center node, with the center having very low degree
    // Subscribe to the topic, all nodes
    // Assert that all nodes have > 1 connection
    // Publish one message per node
    // Assert that the subscribed nodes receive every message
    sinon.replace(constants, 'GossipsubPrunePeers', 5 as 16)
    const psubs = await createGossipsubs({
      number: 20,
      options: {
        scoreThresholds: { acceptPXThreshold: 0 },
        scoreParams: { IPColocationFactorThreshold: 20 },
        doPX: true,
        D: 4,
        Dhi: 5,
        Dlo: 3,
        Dscore: 3
      }
    })

    // configure the center of the star with very low D
    psubs[0]._options.D = 0
    psubs[0]._options.Dhi = 0
    psubs[0]._options.Dlo = 0
    psubs[0]._options.Dscore = 0

    // build the star
    await psubs.slice(1).map((ps) => psubs[0]._libp2p.dialProtocol(ps._libp2p.peerId, ps.multicodecs))

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    // build the mesh
    const topic = 'foobar'
    const peerIdStrs = psubs.map((psub) => psub.peerId.toB58String())
    const subscriptionPromise = checkReceivedSubscriptions(psubs[0], peerIdStrs, topic)
    psubs.forEach((ps) => ps.subscribe(topic))

    // wait a bit for the mesh to build
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 15, 25000)))
    await subscriptionPromise

    // check that all peers have > 1 connection
    psubs.forEach((ps) => {
      expect(ps._libp2p.connectionManager.size).to.be.gt(1)
    })

    // send a message from each peer and assert it was propagated
    let sendRecv = []
    for (let i = 0; i < psubs.length; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = i
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })

  it('test gossipsub direct peers', async function () {
    // Create 3 gossipsub nodes
    // 2 and 3 with direct peer connections with each other
    // Connect nodes: 2 <- 1 -> 3
    // Assert that the nodes are connected
    // Subscribe to the topic, all nodes
    // Publish a message from each node
    // Assert that all nodes receive the messages
    // Disconnect peers
    // Assert peers reconnect
    // Publish a message from each node
    // Assert that all nodes receive the messages
    sinon.replace(constants, 'GossipsubDirectConnectTicks', 2 as 300)
    const libp2ps = await createPeers({ number: 3 })
    const psubs = [
      new Gossipsub(libp2ps[0], { scoreParams: { IPColocationFactorThreshold: 20 }, fastMsgIdFn }),
      new Gossipsub(libp2ps[1], {
        scoreParams: { IPColocationFactorThreshold: 20 },
        directPeers: [
          {
            id: libp2ps[2].peerId,
            addrs: libp2ps[2].multiaddrs
          }
        ],
        fastMsgIdFn
      }),
      new Gossipsub(libp2ps[2], {
        scoreParams: { IPColocationFactorThreshold: 20 },
        directPeers: [
          {
            id: libp2ps[1].peerId,
            addrs: libp2ps[1].multiaddrs
          }
        ],
        fastMsgIdFn
      })
    ]
    await Promise.all(psubs.map((ps) => ps.start()))
    const multicodecs = psubs[0].multicodecs
    await libp2ps[0].dialProtocol(libp2ps[1].peerId, multicodecs)
    await libp2ps[0].dialProtocol(libp2ps[2].peerId, multicodecs)

    // verify that the direct peers connected
    await delay(2000)
    expect(libp2ps[1].connectionManager.get(libp2ps[2].peerId)).to.be.ok

    const topic = 'foobar'
    const peerIdStrs = libp2ps.map((libp2p) => libp2p.peerId.toB58String())
    const subscriptionPromises = psubs.map((psub) => checkReceivedSubscriptions(psub, peerIdStrs, topic))
    psubs.forEach(ps => ps.subscribe(topic))
    await Promise.all(psubs.map(ps => awaitEvents(ps, 'gossipsub:heartbeat', 1)))
    await subscriptionPromises

    let sendRecv = []
    for (let i = 0; i < 3; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = i
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)

    const connectPromises = [1,2].map((i) => new Promise<void>((resolve, reject) => {
      const t = setTimeout(reject, 3000)
      libp2ps[i].connectionManager.once('peer:connect', () => {
        clearTimeout(t)
        resolve()
      })
    }))
    // disconnect the direct peers to test reconnection
    await libp2ps[1].hangUp(libp2ps[2].peerId);

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 5)))
    await Promise.all(connectPromises)
    expect(libp2ps[1].connectionManager.get(libp2ps[2].peerId)).to.be.ok

    sendRecv = []
    for (let i = 0; i < 3; i++) {
      const msg = uint8ArrayFromString(`2nd - ${i} its not a flooooood ${i}`)
      const owner = i
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })

  it('test gossipsub flood publish', async function () {
    // Create 30 gossipsub nodes
    // Connect in star topology
    // Subscribe to the topic, all nodes
    // Publish 20 messages, each from the center node
    // Assert that the other nodes receive the message
    const numPeers = 30;
    const psubs = await createGossipsubs({
      number: numPeers,
      options: { scoreParams: { IPColocationFactorThreshold: 30 } }
    })

    await Promise.all(
      psubs.slice(1).map((ps) => {
        return psubs[0]._libp2p.dialProtocol(ps.peerId, ps.multicodecs)
      })
    )

    const owner = 0
    const psub0 = psubs[owner]
    const peerIdStrs = psubs.filter((_, j) => j !== owner).map(psub => psub.peerId.toB58String())
    // build the (partial, unstable) mesh
    const topic = 'foobar'
    const subscriptionPromise = checkReceivedSubscriptions(psub0, peerIdStrs, topic)
    psubs.forEach((ps) => ps.subscribe(topic))

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 1)))
    await subscriptionPromise

    // send messages from the star and assert they were received
    let sendRecv = []
    for (let i = 0; i < 20; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const results = Promise.all(
        psubs.filter((psub, j) => j !== owner).map(checkReceivedMessage(topic, msg, owner, i))
      )
      sendRecv.push(psubs[owner].publish(topic, msg))
      sendRecv.push(results)
    }
    await Promise.all(sendRecv)
    await tearDownGossipsubs(psubs)
  })

  it('test gossipsub negative score', async function () {
    // Create 20 gossipsub nodes, with scoring params to quickly lower node 0's score
    // Connect densely
    // Subscribe to the topic, all nodes
    // Publish 20 messages, each from a different node, collecting all received messages
    // Assert that nodes other than 0 should not receive any messages from node 0
    const libp2ps = await createPeers({ number: 20 })
    const psubs = libp2ps.map(
      (libp2p) =>
        new Gossipsub(libp2p, {
          scoreParams: {
            IPColocationFactorThreshold: 30,
            appSpecificScore: (p) => (p === libp2ps[0].peerId.toB58String() ? -1000 : 0),
            decayInterval: 1000,
            decayToZero: 0.01
          },
          scoreThresholds: {
            gossipThreshold: -10,
            publishThreshold: -100,
            graylistThreshold: -1000
          },
          fastMsgIdFn
        })
    )
    await Promise.all(psubs.map((ps) => ps.start()))

    await denseConnect(psubs)

    const topic = 'foobar'
    psubs.forEach((ps) => ps.subscribe(topic))

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 3)))

    psubs.slice(1).forEach((ps) =>
      ps.on(topic, (m) => {
        expect(m.receivedFrom).to.not.equal(libp2ps[0].peerId.toB58String())
      })
    )

    let sendRecv = []
    for (let i = 0; i < 20; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = i
      sendRecv.push(psubs[owner].publish(topic, msg))
    }
    await Promise.all(sendRecv)

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub score validator ex', async function () {
    // Create 3 gossipsub nodes
    // Connect fully
    // Register a topic validator on node 0: ignore 1, reject 2
    // Subscribe to the topic, node 0
    // Publish 2 messages, from 1 and 2
    // Assert that 0 received neither message
    // Assert that 1's score is 0, 2's score is negative
    const topic = 'foobar'
    const psubs = await createGossipsubs({
      number: 3,
      options: {
        scoreParams: {
          topics: {
            [topic]: {
              topicWeight: 1,
              timeInMeshQuantum: 1000,
              invalidMessageDeliveriesWeight: -1,
              invalidMessageDeliveriesDecay: 0.9999
            } as TopicScoreParams
          }
        }
      }
    })

    const multicodecs = psubs[0].multicodecs
    await psubs[0]._libp2p.dialProtocol(psubs[1].peerId, multicodecs)
    await psubs[1]._libp2p.dialProtocol(psubs[2].peerId, multicodecs)
    await psubs[0]._libp2p.dialProtocol(psubs[2].peerId, multicodecs)

    psubs[0].topicValidators.set(topic, async (topic, m) => {
      if (m.receivedFrom === psubs[1].peerId.toB58String()) {
        throw errcode(new Error(), constants.ERR_TOPIC_VALIDATOR_IGNORE)
      }
      if (m.receivedFrom === psubs[2].peerId.toB58String()) {
        throw errcode(new Error(), constants.ERR_TOPIC_VALIDATOR_REJECT)
      }
    })

    psubs[0].subscribe(topic)

    await delay(200)

    psubs[0].on(topic, () => expect.fail('node 0 should not receive any messages'))

    const msg = uint8ArrayFromString('its not a flooooood')
    await psubs[1].publish(topic, msg)
    const msg2 = uint8ArrayFromString('2nd - its not a flooooood')
    await psubs[2].publish(topic, msg2)

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 2)))

    expect(psubs[0].score.score(psubs[1].peerId.toB58String())).to.be.eql(0)
    expect(psubs[0].score.score(psubs[2].peerId.toB58String())).to.be.lt(0)

    await tearDownGossipsubs(psubs)
  })
  it('test gossipsub piggyback control', async function () {
    const libp2ps = await createPeers({ number: 2 })
    const otherId = libp2ps[1].peerId.toB58String()
    const psub = new Gossipsub(libp2ps[0], { fastMsgIdFn })
    await psub.start()

    const test1 = 'test1'
    const test2 = 'test2'
    const test3 = 'test3'
    psub.mesh.set(test1, new Set([otherId]))
    psub.mesh.set(test2, new Set())

    const rpc: IRPC = {}
    psub._piggybackControl(otherId, rpc, {
      graft: [{ topicID: test1 }, { topicID: test2 }, { topicID: test3 }],
      prune: [{ topicID: test1 }, { topicID: test2 }, { topicID: test3 }]
    })

    expect(rpc.control).to.be.ok
    expect(rpc.control!.graft!.length).to.be.eql(1)
    expect(rpc.control!.graft![0].topicID).to.be.eql(test1)
    expect(rpc.control!.prune!.length).to.be.eql(2)
    expect(rpc.control!.prune![0].topicID).to.be.eql(test2)
    expect(rpc.control!.prune![1].topicID).to.be.eql(test3)

    await psub.stop()
    await Promise.all(libp2ps.map((libp2p) => libp2p.stop()))
  })
  it('test gossipsub opportunistic grafting', async function () {
    // Create 20 nodes
    // 6 real gossip nodes, 14 'sybil' nodes, unresponsive nodes
    // Connect some of the real nodes
    // Connect every sybil to every real node
    // Subscribe to the topic, all real nodes
    // Publish 300 messages from the real nodes
    // Wait for opgraft
    // Assert the real peer meshes have at least 3 honest peers
    sinon.replace(constants, 'GossipsubPruneBackoff', 500)
    sinon.replace(constants, 'GossipsubGraftFloodThreshold', 100)
    sinon.replace(constants, 'GossipsubOpportunisticGraftPeers', 3 as 2)
    sinon.replace(constants, 'GossipsubOpportunisticGraftTicks', 1 as 60)
    const topic = 'test'
    const psubs = await createGossipsubs({
      number: 20,
      options: {
        scoreParams: {
          IPColocationFactorThreshold: 50,
          decayToZero: 0.01,
          topics: {
            [topic]: {
              topicWeight: 1,
              timeInMeshWeight: 0.00002777,
              timeInMeshQuantum: 1000,
              timeInMeshCap: 3600,
              firstMessageDeliveriesWeight: 100,
              firstMessageDeliveriesDecay: 0.99997,
              firstMessageDeliveriesCap: 1000,
              meshMessageDeliveriesWeight: 0,
              invalidMessageDeliveriesDecay: 0.99997
            } as TopicScoreParams
          }
        },
        scoreThresholds: {
          gossipThreshold: -10,
          publishThreshold: -100,
          graylistThreshold: -10000,
          opportunisticGraftThreshold: 1
        }
      }
    })
    const real = psubs.slice(0, 6)
    const sybils = psubs.slice(6)

    await connectSome(real, 5)

    sybils.forEach((s) => {
      s._processRpc = async function () {
        return true
      }
    })

    for (let i = 0; i < sybils.length; i++) {
      for (let j = 0; j < real.length; j++) {
        await connectGossipsub(sybils[i], real[j])
      }
    }

    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 1)))

    psubs.forEach((ps) => ps.subscribe(topic))

    for (let i = 0; i < 300; i++) {
      const msg = uint8ArrayFromString(`${i} its not a flooooood ${i}`)
      const owner = i % 10
      await psubs[owner].publish(topic, msg)
      await delay(20)
    }

    // now wait for opgraft cycles
    await Promise.all(psubs.map((ps) => awaitEvents(ps, 'gossipsub:heartbeat', 7)))

    // check the honest node meshes, they should have at least 3 honest peers each
    const realPeerIds = real.map((r) => r.peerId.toB58String())
    const sybilPeerIds = sybils.map((r) => r.peerId.toB58String())

    await pRetry(
      () =>
        new Promise<void>((resolve, reject) => {
          real.forEach(async (r, i) => {
            const meshPeers = r.mesh.get(topic)
            let count = 0
            realPeerIds.forEach((p) => {
              if (meshPeers!.has(p)) {
                count++
              }
            })

            if (count < 3) {
              await delay(100)
              reject(new Error())
            }
            resolve()
          })
        }),
      { retries: 10 }
    )
    await tearDownGossipsubs(psubs)
  })
})

import { stop } from '@libp2p/interface'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'
import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { pEvent } from 'p-event'
import sinon, { type SinonStubbedInstance } from 'sinon'
import { stubInterface } from 'ts-sinon'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { GossipsubDhi } from '../src/constants.js'
import { GossipSub } from '../src/index.js'
import { connectAllPubSubNodes, createComponentsArray, type GossipSubAndComponents } from './utils/create-pubsub.js'
import type { PeerStore } from '@libp2p/interface'
import type { ConnectionManager, Registrar } from '@libp2p/interface-internal'

describe('gossip', () => {
  let nodes: GossipSubAndComponents[]

  // Create pubsub nodes
  beforeEach(async () => {
    mockNetwork.reset()
    nodes = await createComponentsArray({
      number: GossipsubDhi + 2,
      connected: false,
      init: {
        scoreParams: {
          IPColocationFactorThreshold: GossipsubDhi + 3
        },
        maxInboundDataLength: 4000000,
        allowPublishToZeroTopicPeers: false
      }
    })
  })

  afterEach(async () => {
    await stop(...nodes.reduce<any[]>((acc, curr) => acc.concat(curr.pubsub, ...Object.entries(curr.components)), []))
    mockNetwork.reset()
  })

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    const subscriptionPromises = nodes.map(async (n) => pEvent(n.pubsub, 'subscription-change'))
    // add subscriptions to each node
    nodes.forEach((n) => { n.pubsub.subscribe(topic) })

    // every node connected to every other
    await connectAllPubSubNodes(nodes)

    // wait for subscriptions to be transmitted
    await Promise.all(subscriptionPromises)

    // await mesh rebalancing
    await Promise.all(nodes.map(async (n) => pEvent(n.pubsub, 'gossipsub:heartbeat')))

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = nodeA.pubsub as Partial<GossipSub> as SinonStubbedInstance<{
      pushGossip: GossipSub['pushGossip']
    }>
    sinon.spy(nodeASpy, 'pushGossip')

    await nodeA.pubsub.publish(topic, uint8ArrayFromString('hey'))

    // gossip happens during the heartbeat
    await pEvent(nodeA.pubsub, 'gossipsub:heartbeat')

    const mesh = (nodeA.pubsub).mesh.get(topic)

    if (mesh == null) {
      throw new Error('No mesh for topic')
    }

    nodeASpy.pushGossip
      .getCalls()
      .map((call) => call.args[0])
      .forEach((peerId) => {
        expect(mesh).to.not.include(peerId)
      })

    // unset spy
    nodeASpy.pushGossip.restore()
  })

  it('Should allow publishing to zero peers if flag is passed', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    const publishResult = await nodeA.pubsub.publish(topic, uint8ArrayFromString('hey'), {
      allowPublishToZeroTopicPeers: true
    })

    // gossip happens during the heartbeat
    await pEvent(nodeA.pubsub, 'gossipsub:heartbeat')

    // should have sent message to peerB
    expect(publishResult.recipients).to.deep.equal([])
  })

  it('should tag peers', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const nodeB = nodes[1]
    const topic = 'Z'

    const twoNodes = [nodeA, nodeB]

    const graftPromises = twoNodes.map(async (n) => pEvent(n.pubsub, 'gossipsub:graft'))

    // add subscriptions to each node
    twoNodes.forEach((n) => { n.pubsub.subscribe(topic) })

    // every node connected to every other
    await connectAllPubSubNodes(twoNodes)

    // await grafts
    await Promise.all(graftPromises)

    // await mesh rebalancing
    await Promise.all(twoNodes.map(async (n) => pEvent(n.pubsub, 'gossipsub:heartbeat')))

    const peerInfoA = await nodeA.components.peerStore.get(nodeB.components.peerId).catch((e) => undefined)
    const peerInfoB = await nodeB.components.peerStore.get(nodeA.components.peerId).catch((e) => undefined)
    expect(peerInfoA?.tags.get(topic)?.value).to.equal(100)
    expect(peerInfoB?.tags.get(topic)?.value).to.equal(100)
  })

  it('should remove the tags upon pruning', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const nodeB = nodes[1]
    const topic = 'Z'

    const twoNodes = [nodeA, nodeB]

    const subscriptionPromises = nodes.map(async (n) => pEvent(n.pubsub, 'subscription-change'))
    // add subscriptions to each node
    twoNodes.forEach((n) => { n.pubsub.subscribe(topic) })

    // every node connected to every other
    await connectAllPubSubNodes(nodes)

    // await for subscriptions to be transmitted
    await Promise.all(subscriptionPromises)

    // await mesh rebalancing
    await Promise.all(twoNodes.map(async (n) => pEvent(n.pubsub, 'gossipsub:heartbeat')))

    twoNodes.forEach((n) => { n.pubsub.unsubscribe(topic) })

    // await for unsubscriptions to be transmitted
    // await mesh rebalancing
    await Promise.all(twoNodes.map(async (n) => pEvent(n.pubsub, 'gossipsub:heartbeat')))

    const peerInfoA = await nodeA.components.peerStore.get(nodeB.components.peerId).catch((e) => undefined)
    const peerInfoB = await nodeB.components.peerStore.get(nodeA.components.peerId).catch((e) => undefined)
    expect(peerInfoA?.tags.get(topic)).to.be.undefined()
    expect(peerInfoB?.tags.get(topic)).to.be.undefined()
  })

  it('should reject incoming messages bigger than maxInboundDataLength limit', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const nodeB = nodes[1]

    const twoNodes = [nodeA, nodeB]
    const topic = 'Z'
    const subscriptionPromises = twoNodes.map(async (n) => pEvent(n.pubsub, 'subscription-change'))
    // add subscriptions to each node
    twoNodes.forEach((n) => { n.pubsub.subscribe(topic) })

    // every node connected to every other
    await connectAllPubSubNodes(twoNodes)

    // wait for subscriptions to be transmitted
    await Promise.all(subscriptionPromises)

    // await mesh rebalancing
    await Promise.all(twoNodes.map(async (n) => pEvent(n.pubsub, 'gossipsub:heartbeat')))

    // set spy. NOTE: Forcing private property to be public
    const nodeBSpy = nodeB.pubsub as Partial<GossipSub> as SinonStubbedInstance<{
      handlePeerReadStreamError: GossipSub['handlePeerReadStreamError']
    }>
    sinon.spy(nodeBSpy, 'handlePeerReadStreamError')

    // This should lead to handlePeerReadStreamError at nodeB
    await nodeA.pubsub.publish(topic, new Uint8Array(5000000))
    await pEvent(nodeA.pubsub, 'gossipsub:heartbeat')
    const expectedError = nodeBSpy.handlePeerReadStreamError.getCalls()[0]?.args[0]
    expect(expectedError !== undefined && (expectedError as unknown as { code: string }).code, 'ERR_MSG_DATA_TOO_LONG')

    // unset spy
    nodeBSpy.handlePeerReadStreamError.restore()
  })

  it('should send piggyback control into other sent messages', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    const promises = nodes.map(async (n) => pEvent(n.pubsub, 'subscription-change'))
    // add subscriptions to each node
    nodes.forEach((n) => { n.pubsub.subscribe(topic) })

    // every node connected to every other
    await connectAllPubSubNodes(nodes)

    // wait for subscriptions to be transmitted
    await Promise.all(promises)

    // await nodeA mesh rebalancing
    await pEvent(nodeA.pubsub, 'gossipsub:heartbeat')

    const mesh = (nodeA.pubsub).mesh.get(topic)

    if (mesh == null) {
      throw new Error('No mesh for topic')
    }

    if (mesh.size === 0) {
      throw new Error('Topic mesh was empty')
    }

    const peerB = Array.from(mesh)[0]

    if (peerB == null) {
      throw new Error('Could not get peer from mesh')
    }

    // should have peerB as a subscriber to the topic
    expect(nodeA.pubsub.getSubscribers(topic).map((p) => p.toString())).to.include(
      peerB,
      "did not know about peerB's subscription to topic"
    )

    // should be able to send them messages
    expect((nodeA.pubsub).streamsOutbound.has(peerB)).to.be.true(
      'nodeA did not have connection open to peerB'
    )

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = sinon.spy(nodeA.pubsub, 'piggybackControl')
    // manually add control message to be sent to peerB
    const graft = { ihave: [], iwant: [], graft: [{ topicID: topic }], prune: [], idontwant: [] }
    ;(nodeA.pubsub).control.set(peerB, graft)
    ;(nodeA.pubsub).gossip.set(peerB, [])

    const publishResult = await nodeA.pubsub.publish(topic, uint8ArrayFromString('hey'))

    // should have sent message to peerB
    expect(publishResult.recipients.map((p) => p.toString())).to.include(peerB, 'did not send pubsub message to peerB')

    // wait until spy is called
    const startTime = Date.now()
    while (Date.now() - startTime < 5000) {
      if (nodeASpy.callCount > 0) break
    }

    expect(nodeASpy.callCount).to.be.equal(1)
    // expect control message to be sent alongside published message
    const call = nodeASpy.getCalls()[0]
    expect(call).to.have.deep.nested.property('args[1].control.graft', graft.graft)

    // unset spy
    nodeASpy.restore()
  })

  it('should allow configuring stream limits', async () => {
    const maxInboundStreams = 7
    const maxOutboundStreams = 5

    const registrar = stubInterface<Registrar>()

    const pubsub = new GossipSub(
      {
        peerId: await createEd25519PeerId(),
        registrar,
        peerStore: stubInterface<PeerStore>(),
        connectionManager: stubInterface<ConnectionManager>(),
        logger: defaultLogger()
      },
      {
        maxInboundStreams,
        maxOutboundStreams
      }
    )

    await pubsub.start()

    expect(registrar.register.called).to.be.true()
    expect(registrar.handle.getCall(0)).to.have.nested.property('args[2].maxInboundStreams', maxInboundStreams)
    expect(registrar.handle.getCall(0)).to.have.nested.property('args[2].maxOutboundStreams', maxOutboundStreams)

    await pubsub.stop()
  })
})

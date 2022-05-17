import { expect } from 'aegir/utils/chai.js'
import sinon, { SinonStubbedInstance } from 'sinon'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { GossipsubDhi } from '../src/constants.js'
import type { GossipSub } from '../src/index.js'
import { pEvent } from 'p-event'
import { connectAllPubSubNodes, createComponentsArray } from './utils/create-pubsub.js'
import { Components } from '@libp2p/interfaces/components'
import { stop } from '@libp2p/interfaces/startable'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'

describe('gossip', () => {
  let nodes: Components[]

  // Create pubsub nodes
  beforeEach(async () => {
    mockNetwork.reset()
    nodes = await createComponentsArray({
      number: GossipsubDhi + 2,
      connected: false,
      init: {
        scoreParams: {
          IPColocationFactorThreshold: GossipsubDhi + 3
        }
      }
    })
  })

  afterEach(async () => {
    await stop(...nodes)
    mockNetwork.reset()
  })

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.getPubSub().subscribe(topic))

    // every node connected to every other
    await connectAllPubSubNodes(nodes)

    // wait for subscriptions to be transmitted
    await Promise.all(nodes.map(async (n) => await pEvent(n.getPubSub(), 'subscription-change')))

    // await mesh rebalancing
    await Promise.all(nodes.map(async (n) => await pEvent(n.getPubSub(), 'gossipsub:heartbeat')))

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = nodeA.getPubSub() as Partial<GossipSub> as SinonStubbedInstance<{
      pushGossip: GossipSub['pushGossip']
    }>
    sinon.spy(nodeASpy, 'pushGossip')

    await nodeA.getPubSub().publish(topic, uint8ArrayFromString('hey'))

    // gossip happens during the heartbeat
    await pEvent(nodeA.getPubSub(), 'gossipsub:heartbeat')

    const mesh = (nodeA.getPubSub() as GossipSub).mesh.get(topic)

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

  it('should send piggyback control into other sent messages', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    const promises = nodes.map(async (n) => await pEvent(n.getPubSub(), 'subscription-change'))
    // add subscriptions to each node
    nodes.forEach((n) => n.getPubSub().subscribe(topic))

    // every node connected to every other
    await connectAllPubSubNodes(nodes)

    // wait for subscriptions to be transmitted
    await Promise.all(promises)

    // await nodeA mesh rebalancing
    await pEvent(nodeA.getPubSub(), 'gossipsub:heartbeat')

    const mesh = (nodeA.getPubSub() as GossipSub).mesh.get(topic)

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
    expect(
      nodeA
        .getPubSub()
        .getSubscribers(topic)
        .map((p) => p.toString())
    ).to.include(peerB, "did not know about peerB's subscription to topic")

    // should be able to send them messages
    expect((nodeA.getPubSub() as GossipSub).peers.get(peerB)).to.have.property(
      'isWritable',
      true,
      'nodeA did not have connection open to peerB'
    )

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = sinon.spy(nodeA.getPubSub() as GossipSub, 'piggybackControl')
    // manually add control message to be sent to peerB
    const graft = { ihave: [], iwant: [], graft: [{ topicID: topic }], prune: [] }
    ;(nodeA.getPubSub() as GossipSub).control.set(peerB, graft)
    ;(nodeA.getPubSub() as GossipSub).gossip.set(peerB, [])

    const publishResult = await nodeA.getPubSub().publish(topic, uint8ArrayFromString('hey'))

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
})

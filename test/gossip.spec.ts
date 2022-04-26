import { expect } from 'aegir/utils/chai.js'
import sinon, { SinonStubbedInstance } from 'sinon'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { GossipsubDhi } from '../ts/constants.js'
import type { GossipSub } from '../ts/index.js'
import { createGossipSub, connectGossipsubs, waitForAllNodesToBePeered } from './utils/index.js'
import type { Libp2p } from 'libp2p'
import { pEvent } from 'p-event'

describe('gossip', () => {
  let nodes: Libp2p[]

  // Create pubsub nodes
  beforeEach(async () => {
    nodes = await Promise.all(
      Array.from({ length: GossipsubDhi + 2 }).fill(0).map(async () => {
        return await createGossipSub({
          init: {
            scoreParams: {
              IPColocationFactorThreshold: GossipsubDhi + 3
            }
          }
        })
      })
    )
  })

  afterEach(async () => await Promise.all(nodes.map(n => n.stop())))

  it('should send gossip to non-mesh peers in topic', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'
    // add subscriptions to each node
    nodes.forEach((n) => n.pubsub.subscribe(topic))

    // every node connected to every other
    await connectGossipsubs(nodes)
    await waitForAllNodesToBePeered(nodes)

    // await mesh rebalancing
    await Promise.all(nodes.map(async (n) => await pEvent(n.pubsub, 'gossipsub:heartbeat')))

    await delay(500)

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = nodeA.pubsub as Partial<GossipSub> as SinonStubbedInstance<{
      pushGossip: GossipSub['pushGossip']
    }>
    sinon.spy(nodeASpy, 'pushGossip')

    await nodeA.pubsub.publish(topic, uint8ArrayFromString('hey'))

    await Promise.all(nodes.map(async (n) => await pEvent(n.pubsub, 'gossipsub:heartbeat')))

    nodeASpy.pushGossip
      .getCalls()
      .map((call) => call.args[0])
      .forEach((peerId) => {
        const mesh = (nodeA.pubsub as GossipSub).mesh.get(topic)

        if (mesh != null) {
          mesh.forEach((meshPeerId) => {
            expect(meshPeerId).to.not.equal(peerId)
          })
        }
      })

    // unset spy
    nodeASpy.pushGossip.restore()
  })

  it('should send piggyback control into other sent messages', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((n) => n.pubsub.subscribe(topic))

    // every node connected to every other
    await connectGossipsubs(nodes)
    await waitForAllNodesToBePeered(nodes)

    // await mesh rebalancing
    await Promise.all(nodes.map(async (n) => await pEvent(n.pubsub, 'gossipsub:heartbeat')))
    await delay(500)

    const peerB = [...((nodeA.pubsub as GossipSub).mesh.get(topic) ?? [])][0]

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = sinon.spy(nodeA.pubsub as GossipSub, 'piggybackControl')

    // manually add control message to be sent to peerB
    const graft = { ihave: [], iwant: [], graft: [{ topicID: topic }], prune: [] }
    ;(nodeA.pubsub as GossipSub).control.set(peerB, graft)

    await nodeA.pubsub.publish(topic, uint8ArrayFromString('hey'))

    expect(nodeASpy.callCount).to.be.equal(1)
    // expect control message to be sent alongside published message
    const call = nodeASpy.getCalls()[0]
    expect(call).to.have.deep.nested.property('args[1].control.graft', graft.graft)

    // unset spy
    nodeASpy.restore()
  })
})

import { expect } from 'chai'
import sinon, { SinonStubbedInstance } from 'sinon'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { GossipsubDhi } from '../ts/constants'
import Gossipsub from '../ts'
import { first, createGossipsubs, connectGossipsubs, stopNode, waitForAllNodesToBePeered } from './utils'

describe('gossip', () => {
  let nodes: sinon.SinonStubbedInstance<Gossipsub>[]

  // Create pubsub nodes
  beforeEach(async function () {
    this.timeout(5e3)
    nodes = (await createGossipsubs({
      number: GossipsubDhi + 2,
      options: { scoreParams: { IPColocationFactorThreshold: GossipsubDhi + 3 } }
    })) as sinon.SinonStubbedInstance<Gossipsub>[]
  })

  afterEach(() => Promise.all(nodes.map(stopNode)))

  for (let i = 0; i<100; i++) {
    it.only('should send gossip to non-mesh peers in topic i=' + i, async function () {
      this.timeout(10e4)
      const nodeA = nodes[0]
      const topic = 'Z'
      // add subscriptions to each node
      nodes.forEach((n) => n.subscribe(topic))

      // every node connected to every other
      await connectGossipsubs(nodes)
      await waitForAllNodesToBePeered(nodes)

      // await mesh rebalancing
      await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
      await delay(500)

      // set spy. NOTE: Forcing private property to be public
      const nodeASpy = nodeA as Partial<Gossipsub> as SinonStubbedInstance<{
        pushGossip: Gossipsub['pushGossip']
      }>
      sinon.spy(nodeASpy, 'pushGossip')

      await nodeA.publish(topic, uint8ArrayFromString('hey'))

      await new Promise((resolve) => nodeA.once('gossipsub:heartbeat', resolve))

      nodeASpy.pushGossip
        .getCalls()
        .map((call) => call.args[0])
        .forEach((peerId) => {
          nodeA['mesh'].get(topic)!.forEach((meshPeerId) => {
            expect(meshPeerId).to.not.equal(peerId)
          })
        })

      // unset spy
      nodeASpy.pushGossip.restore()
    })
  }

  it('should send piggyback control into other sent messages', async function () {
    this.timeout(10e4)
    const nodeA = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((n) => n.subscribe(topic))

    // every node connected to every other
    await connectGossipsubs(nodes)
    await waitForAllNodesToBePeered(nodes)

    // await mesh rebalancing
    await Promise.all(nodes.map((n) => new Promise((resolve) => n.once('gossipsub:heartbeat', resolve))))
    await delay(500)

    const peerB = first(nodeA['mesh'].get(topic))
    const nodeB = nodes.find((n) => n.peerId.toB58String() === peerB)

    // set spy. NOTE: Forcing private property to be public
    const nodeASpy = nodeA as Partial<Gossipsub> as SinonStubbedInstance<{
      piggybackControl: Gossipsub['piggybackGossip']
    }>
    sinon.spy(nodeASpy, 'piggybackControl')

    // manually add control message to be sent to peerB
    const graft = { graft: [{ topicID: topic }] }
    nodeA['control'].set(peerB, graft)

    await nodeA.publish(topic, uint8ArrayFromString('hey'))

    expect(nodeASpy.piggybackControl.callCount).to.be.equal(1)
    // expect control message to be sent alongside published message
    const call = nodeASpy.piggybackControl.getCalls()[0]
    expect(call.args[1].control!.graft).to.deep.equal(graft.graft)

    // unset spy
    nodeASpy.piggybackControl.restore()
  })
})

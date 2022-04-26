import { expect } from 'aegir/utils/chai.js'
import delay from 'delay'
import { GossipsubDhi } from '../ts/constants.js'
import { createGossipSub, connectGossipsubs } from './utils/index.js'
import type { Libp2p } from 'libp2p'
import type { GossipSub } from '../ts/index.js'

describe('mesh overlay', () => {
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

  it('should add mesh peers below threshold', async function () {
    this.timeout(10e3)

    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((node) => node.pubsub.subscribe(topic))

    // connect N (< GossipsubD) nodes to node0
    const N = 4
    await connectGossipsubs(nodes.slice(0, N + 1))

    await delay(50)
    // await mesh rebalancing
    await new Promise((resolve) => (node0.pubsub as GossipSub).addEventListener('gossipsub:heartbeat', resolve, {
      once: true
    }))

    const mesh = (node0.pubsub as GossipSub).mesh.get(topic)
    expect(mesh).to.have.property('size', N)
  })

  it('should remove mesh peers once above threshold', async function () {
    this.timeout(10e4)
    // test against node0
    const node0 = nodes[0]
    const topic = 'Z'

    // add subscriptions to each node
    nodes.forEach((node) => node.pubsub.subscribe(topic))

    await connectGossipsubs(nodes)

    await delay(500)
    // await mesh rebalancing
    await new Promise((resolve) => (node0.pubsub as GossipSub).addEventListener('gossipsub:heartbeat', resolve, {
      once: true
    }))

    const mesh = (node0.pubsub as GossipSub).mesh.get(topic)
    expect(mesh).to.have.property('size').that.is.lte(GossipsubDhi)
  })
})

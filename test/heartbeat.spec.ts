import { expect } from 'aegir/utils/chai.js'
import { GossipsubHeartbeatInterval } from '../ts/constants.js'
import { createGossipSub } from './utils/index.js'
import type { Libp2p } from 'libp2p'
import { pEvent } from 'p-event'

describe('heartbeat', () => {
  let node: Libp2p

  before(async () => {
    node = await createGossipSub({
      started: true,
      init: {
        emitSelf: true
      }
    })
  })

  after(async () => {
    if (node != null) {
      await node.stop()
    }
  })

  it('should occur with regularity defined by a constant', async function () {
    this.timeout(GossipsubHeartbeatInterval * 5)

    await pEvent(node.pubsub, 'gossipsub:heartbeat')
    const t1 = Date.now()

    await pEvent(node.pubsub, 'gossipsub:heartbeat')
    const t2 = Date.now()

    const safeFactor = 1.5
    expect(t2 - t1).to.be.lt(GossipsubHeartbeatInterval * safeFactor)
  })
})

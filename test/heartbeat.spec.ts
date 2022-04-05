import { expect } from 'chai'
import Gossipsub from '../ts'
import { GossipsubHeartbeatInterval } from '../ts/constants'
import { createPeer, startNode, stopNode } from './utils'

describe('heartbeat', () => {
  let gossipsub: Gossipsub

  before(async () => {
    gossipsub = new Gossipsub(await createPeer({ started: false }), { emitSelf: true })
    await startNode(gossipsub)
  })

  after(() => stopNode(gossipsub))

  it('should occur with regularity defined by a constant', async function () {
    this.timeout(GossipsubHeartbeatInterval * 5)
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t1 = Date.now()
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t2 = Date.now()
    const safeFactor = 1.5
    expect(t2 - t1).to.be.lt(GossipsubHeartbeatInterval * safeFactor)
  })
})

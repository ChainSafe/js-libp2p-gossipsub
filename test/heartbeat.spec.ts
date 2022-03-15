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
    this.timeout(3000)
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t1 = Date.now()
    await new Promise((resolve) => gossipsub.once('gossipsub:heartbeat', resolve))
    const t2 = Date.now()
    const safeDelta = 100 // ms
    expect(t2 - t1).to.be.lt(GossipsubHeartbeatInterval + safeDelta)
  })
})

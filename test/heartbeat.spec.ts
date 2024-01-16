import { stop } from '@libp2p/interface'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'
import { expect } from 'aegir/chai'
import { pEvent } from 'p-event'
import { GossipsubHeartbeatInterval } from '../src/constants.js'
import { createComponents, type GossipSubAndComponents } from './utils/create-pubsub.js'

describe('heartbeat', () => {
  let node: GossipSubAndComponents

  before(async () => {
    mockNetwork.reset()
    node = await createComponents({
      init: {
        emitSelf: true
      }
    })
  })

  after(async () => {
    await stop(node.pubsub, ...Object.entries(node.components))
    mockNetwork.reset()
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

import { expect } from 'aegir/utils/chai.js'
import { GossipsubHeartbeatInterval } from '../src/constants.js'
import { pEvent } from 'p-event'
import { Components } from '@libp2p/interfaces/components'
import { createComponents } from './utils/create-pubsub.js'
import { stop } from '@libp2p/interfaces/startable'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'

describe('heartbeat', () => {
  let node: Components

  before(async () => {
    mockNetwork.reset()
    node = await createComponents({
      init: {
        emitSelf: true
      }
    })
  })

  after(() => {
    stop(node)
    mockNetwork.reset()
  })

  it('should occur with regularity defined by a constant', async function () {
    this.timeout(GossipsubHeartbeatInterval * 5)

    await pEvent(node.getPubSub(), 'gossipsub:heartbeat')
    const t1 = Date.now()

    await pEvent(node.getPubSub(), 'gossipsub:heartbeat')
    const t2 = Date.now()

    const safeFactor = 1.5
    expect(t2 - t1).to.be.lt(GossipsubHeartbeatInterval * safeFactor)
  })
})

/* eslint-env mocha */

import { expect } from 'aegir/utils/chai.js'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { createConnectedGossipsubs } from './utils/index.js'
import { pEvent } from 'p-event'
import type { Libp2p } from 'libp2p'
import type { Message } from '@libp2p/interfaces/pubsub'

const shouldNotHappen = () => expect.fail()

describe('gossip incoming', () => {
  const topic = 'Z'
  let nodes: Libp2p[]

  describe('gossipIncoming == true', () => {
    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 3 })
    })

    // Create subscriptions
    before(async () => {
      nodes[0].pubsub.subscribe(topic)
      nodes[1].pubsub.subscribe(topic)
      nodes[2].pubsub.subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].pubsub, 'subscription-change'),
        pEvent(nodes[0].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[1].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[2].pubsub, 'gossipsub:heartbeat')
      ])
    })

    after(async () => await Promise.all(nodes.map(n => n.stop())))

    it('should gossip incoming messages', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodes[2].pubsub, 'message')

      nodes[0].pubsub.addEventListener('message', shouldNotHappen)
      const data = uint8ArrayFromString('hey')
      await nodes[0].pubsub.publish(topic, data)

      const evt = await promise

      expect(evt.detail.data).to.equalBytes(data)
      expect(nodes[0].peerId.equals(evt.detail.from)).to.be.true()

      nodes[0].pubsub.removeEventListener('message', shouldNotHappen)
    })
  })

  // https://github.com/ChainSafe/js-libp2p-gossipsub/issues/231
  describe.skip('gossipIncoming == false', () => {
    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 3, init: { gossipIncoming: false } })
    })

    // Create subscriptions
    before(async () => {
      nodes[0].pubsub.subscribe(topic)
      nodes[1].pubsub.subscribe(topic)
      nodes[2].pubsub.subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].pubsub, 'subscription-change'),
        pEvent(nodes[0].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[1].pubsub, 'gossipsub:heartbeat'),
        pEvent(nodes[2].pubsub, 'gossipsub:heartbeat')
      ])
    })

    after(async () => await Promise.all(nodes.map(n => n.stop())))

    it('should not gossip incoming messages', async () => {
      nodes[2].pubsub.addEventListener('message', shouldNotHappen)

      await nodes[0].pubsub.publish(topic, uint8ArrayFromString('hey'))

      await delay(1000)

      nodes[2].pubsub.removeEventListener('message', shouldNotHappen)
    })
  })
})

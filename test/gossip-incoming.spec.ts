/* eslint-env mocha */

import { expect } from 'aegir/utils/chai.js'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { pEvent } from 'p-event'
import type { Message } from '@libp2p/interfaces/pubsub'
import { Components } from '@libp2p/interfaces/components'
import { createComponentsArray } from './utils/create-pubsub.js'
import { stop } from '@libp2p/interfaces/startable'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'

const shouldNotHappen = () => expect.fail()

describe('gossip incoming', () => {
  const topic = 'Z'
  let nodes: Components[]

  describe('gossipIncoming == true', () => {
    // Create pubsub nodes
    before(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({ number: 3, connected: true })

      // Create subscriptions
      nodes[0].getPubSub().subscribe(topic)
      nodes[1].getPubSub().subscribe(topic)
      nodes[2].getPubSub().subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].getPubSub(), 'subscription-change'),
        pEvent(nodes[0].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[2].getPubSub(), 'gossipsub:heartbeat')
      ])
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('should gossip incoming messages', async () => {
      const promise = pEvent<'message', CustomEvent<Message>>(nodes[2].getPubSub(), 'message')

      nodes[0].getPubSub().addEventListener('message', shouldNotHappen)
      const data = uint8ArrayFromString('hey')
      await nodes[0].getPubSub().publish(topic, data)

      const evt = await promise

      expect(evt.detail.data).to.equalBytes(data)
      expect(nodes[0].getPeerId().equals(evt.detail.from)).to.be.true()

      nodes[0].getPubSub().removeEventListener('message', shouldNotHappen)
    })
  })

  // https://github.com/ChainSafe/js-libp2p-gossipsub/issues/231
  describe.skip('gossipIncoming == false', () => {
    // Create pubsub nodes
    before(async () => {
      mockNetwork.reset()
      nodes = await createComponentsArray({ number: 3, connected: true, init: { gossipIncoming: false } })

      // Create subscriptions
      nodes[0].getPubSub().subscribe(topic)
      nodes[1].getPubSub().subscribe(topic)
      nodes[2].getPubSub().subscribe(topic)

      // await subscription change and heartbeat
      await Promise.all([
        pEvent(nodes[0].getPubSub(), 'subscription-change'),
        pEvent(nodes[0].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[1].getPubSub(), 'gossipsub:heartbeat'),
        pEvent(nodes[2].getPubSub(), 'gossipsub:heartbeat')
      ])
    })

    afterEach(async () => {
      await stop(...nodes)
      mockNetwork.reset()
    })

    it('should not gossip incoming messages', async () => {
      nodes[2].getPubSub().addEventListener('message', shouldNotHappen)

      await nodes[0].getPubSub().publish(topic, uint8ArrayFromString('hey'))

      await delay(1000)

      nodes[2].getPubSub().removeEventListener('message', shouldNotHappen)
    })
  })
})

/* eslint-env mocha */

import chai from 'chai'
import delay from 'delay'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import Gossipsub from '../ts'
import { GossipsubMessage } from '../ts/types'
import { createConnectedGossipsubs, stopNode } from './utils'

const expect = chai.expect
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const shouldNotHappen = () => expect.fail()

describe('gossip incoming', () => {
  const topic = 'Z'
  let nodes: Gossipsub[]

  describe('gossipIncoming == true', () => {
    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 3 })
    })

    // Create subscriptions
    before(async () => {
      nodes[0].subscribe(topic)
      nodes[1].subscribe(topic)
      nodes[2].subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodes[0].once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[2].once('gossipsub:heartbeat', resolve))
      ])
    })

    after(() => Promise.all(nodes.map(stopNode)))

    it('should gossip incoming messages', async () => {
      const promise = new Promise<GossipsubMessage>((resolve) => nodes[2].once(topic, resolve))
      nodes[0].once(topic, (m) => shouldNotHappen)

      nodes[0].publish(topic, uint8ArrayFromString('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodes[0].peerId.toBytes())

      nodes[0].removeListener(topic, shouldNotHappen)
    })
  })

  describe('gossipIncoming == false', () => {
    // Create pubsub nodes
    before(async () => {
      nodes = await createConnectedGossipsubs({ number: 3, options: { gossipIncoming: false } })
    })

    // Create subscriptions
    before(async () => {
      nodes[0].subscribe(topic)
      nodes[1].subscribe(topic)
      nodes[2].subscribe(topic)

      // await subscription change and heartbeat
      await new Promise((resolve) => nodes[0].once('pubsub:subscription-change', resolve))
      await Promise.all([
        new Promise((resolve) => nodes[0].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[1].once('gossipsub:heartbeat', resolve)),
        new Promise((resolve) => nodes[2].once('gossipsub:heartbeat', resolve))
      ])
    })

    after(() => Promise.all(nodes.map(stopNode)))

    it('should not gossip incoming messages', async () => {
      nodes[2].once(topic, (m) => shouldNotHappen)

      nodes[0].publish(topic, uint8ArrayFromString('hey'))

      await delay(1000)

      nodes[2].removeListener(topic, shouldNotHappen)
    })
  })
})

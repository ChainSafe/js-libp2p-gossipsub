/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect

const delay = require('delay')
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string')

const { createConnectedGossipsubs, stopNode } = require('./utils')

const shouldNotHappen = (msg) => expect.fail()

describe('gossip incoming', () => {
  const topic = 'Z'
  let nodes

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
      const promise = new Promise((resolve) => nodes[2].once(topic, resolve))
      nodes[0].once(topic, (m) => shouldNotHappen)

      nodes[0].publish(topic, uint8ArrayFromString('hey'))

      const msg = await promise

      expect(msg.data.toString()).to.equal('hey')
      expect(msg.from).to.be.eql(nodes[0].peerId.toB58String())

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

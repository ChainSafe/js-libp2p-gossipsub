/* eslint-env mocha */
'use strict'

const tests = require('libp2p-interfaces-compliance-tests/src/pubsub')

const Gossipsub = require('../src')
const { createPeers } = require('./utils/create-peer')

describe('interface compliance', function () {
  this.timeout(3000)
  let peers
  let pubsubNodes = []

  tests({
    async setup(number = 1, options = {}) {
      peers = await createPeers({ number })

      peers.forEach((peer) => {
        const gossipsub = new Gossipsub(peer, {
          emitSelf: true,
          // we don't want to cache anything, spec test sends duplicate messages and expect
          // peer to receive all.
          seenTTL: -1,
          ...options,
        })

        pubsubNodes.push(gossipsub)
      })

      return pubsubNodes
    },
    async teardown() {
      await Promise.all(pubsubNodes.map((ps) => ps.stop()))
      peers.length && (await Promise.all(peers.map((peer) => peer.stop())))

      peers = undefined
      pubsubNodes = []
    },
  })
})

/* eslint-env mocha */
'use strict'

const tests = require('libp2p-interfaces/src/pubsub/tests')

const Gossipsub = require('../src')
const { createPeers } = require('./utils/create-peer')

describe('interface compliance', () => {
  let peers
  let pubsubNodes = []

  tests({
    async setup(number = 1, options = {}) {
      peers = await createPeers({ number })

      peers.forEach((peer) => {
        const gossipsub = new Gossipsub(peer, {
          emitSelf: true,
          ...options
        })

        pubsubNodes.push(gossipsub)
      })

      return pubsubNodes
    },
    async teardown() {
      await Promise.all(pubsubNodes.map(ps => ps.stop()))
      peers.length && await Promise.all(peers.map(peer => peer.stop()))

      peers = undefined
      pubsubNodes = []
    }
  })
})

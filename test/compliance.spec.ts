// @ts-ignore
import tests from 'libp2p-interfaces-compliance-tests/src/pubsub'
import Libp2p from 'libp2p'
import Gossipsub from '../ts'
import { createPeers } from './utils/create-peer'

describe('interface compliance', function () {
  this.timeout(3000)
  let peers: Libp2p[] | undefined
  let pubsubNodes: Gossipsub[] = []

  tests({
    async setup(number = 1, options = {}) {
      const _peers = await createPeers({ number })

      _peers.forEach((peer) => {
        const gossipsub = new Gossipsub(peer, {
          emitSelf: true,
          // we don't want to cache anything, spec test sends duplicate messages and expect
          // peer to receive all.
          seenTTL: -1,
          ...options
        })

        pubsubNodes.push(gossipsub)
      })

      peers = _peers

      return pubsubNodes
    },
    async teardown() {
      await Promise.all(pubsubNodes.map((ps) => ps.stop()))
      if (peers) {
        peers.length && (await Promise.all(peers.map((peer) => peer.stop())))
        peers = undefined
      }
      pubsubNodes = []
    }
  })
})

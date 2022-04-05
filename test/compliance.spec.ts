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
          // libp2p-interfaces-compliance-tests in test 'can subscribe and unsubscribe correctly' publishes to no peers
          // Disable check to allow passing tests
          allowPublishToZeroPeers: true,
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

  // As of Mar 15 2022 only 4/29 tests are failing due to:
  // - 1. Tests want to stub internal methods like `_emitMessage` that are not spec and not in this Gossipsub version
  // - 2. Old protobuf RPC.Message version where
  skipIds(
    this,
    new Set([
      'should emit normalized signed messages on publish',
      'should drop unsigned messages',
      'should not drop unsigned messages if strict signing is disabled',
      'Publish 10 msg to a topic in nodeB'
    ])
  )
})

function skipIds(suite: Mocha.Suite, ids: Set<string>): void {
  suite.tests = suite.tests.filter((test) => !ids.has(test.title))

  for (const suiteChild of suite.suites) {
    skipIds(suiteChild, ids)
  }
}

import { TypedEventEmitter } from '@libp2p/interface'
import tests from '@libp2p/interface-compliance-tests/pubsub'
import { defaultLogger } from '@libp2p/logger'
import { PersistentPeerStore } from '@libp2p/peer-store'
import { MemoryDatastore } from 'datastore-core'
import { GossipSub } from '../src/index.js'
import type { Libp2pEvents } from '@libp2p/interface'

describe.skip('interface compliance', function () {
  this.timeout(3000)

  tests({
    async setup (args) {
      if (args == null) {
        throw new Error('PubSubOptions is required')
      }

      const pubsub = new GossipSub(
        {
          ...args.components,
          peerStore: new PersistentPeerStore({
            peerId: args.components.peerId,
            datastore: new MemoryDatastore(),
            events: new TypedEventEmitter<Libp2pEvents>(),
            logger: defaultLogger()
          })
        },
        {
          ...args.init,
          // libp2p-interfaces-compliance-tests in test 'can subscribe and unsubscribe correctly' publishes to no peers
          // Disable check to allow passing tests
          allowPublishToZeroTopicPeers: true
        }
      )

      return pubsub
    },

    async teardown () {
      //
    }
  })
})

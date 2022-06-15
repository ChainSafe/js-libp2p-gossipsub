import tests from '@libp2p/interface-pubsub-compliance-tests'
import { GossipSub } from '../src/index.js'

describe.skip('interface compliance', function () {
  this.timeout(3000)

  tests({
    async setup(args) {
      if (args == null) {
        throw new Error('PubSubOptions is required')
      }

      const pubsub = new GossipSub({
        ...args.init,
        // libp2p-interfaces-compliance-tests in test 'can subscribe and unsubscribe correctly' publishes to no peers
        // Disable check to allow passing tests
        allowPublishToZeroPeers: true
      })
      await pubsub.init(args.components)

      return pubsub
    },

    async teardown() {
      //
    }
  })
})

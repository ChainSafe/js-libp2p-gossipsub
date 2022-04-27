/**
 * This file uses aegir hooks to
 * set up a libp2p instance for browser nodes to relay through
 * before tests start
 */

/** @type {import('aegir').PartialOptions} */
const opts = {
  test: {
    async before () {
      const { createLibp2p } = await import('libp2p')
      const { WebSockets } = await import('@libp2p/websockets')
      const { Mplex } = await import('@libp2p/mplex')
      const { Noise } = await import('@chainsafe/libp2p-noise')
      const { createFromJSON } = await import('@libp2p/peer-id-factory')

      // Use the last peer
      const RelayPeer = await import('./dist/test/fixtures/relay.js')
      const peerId = await createFromJSON(RelayPeer.default)
      const libp2p = await createLibp2p({
        addresses: {
          listen: [RelayPeer.default.multiaddr]
        },
        peerId,
        transports: [
          new WebSockets()
        ],
        streamMuxers: [
          new Mplex()
        ],
        connectionEncryption: [
          new Noise()
        ],
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: false
          }
        }
      })

      await libp2p.start()

      return {
        libp2p
      }
    },
    async after (_, before) {
      await before.libp2p.stop()
    }
  }
}

module.exports = opts

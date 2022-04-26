import { createLibp2p, Libp2p, Libp2pOptions } from 'libp2p'
import { Multiaddr } from '@multiformats/multiaddr'
import type { PeerId } from '@libp2p/interfaces/peer-id'
import { NOISE } from '@chainsafe/libp2p-noise'
import { WebSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { Mplex } from '@libp2p/mplex'
import Peers from '../fixtures/peers.js'
import RelayPeer from '../fixtures/relay.js'
import { createEd25519PeerId, createFromJSON } from '@libp2p/peer-id-factory'
import { setMaxListeners } from 'events'

/**
 * These utilities rely on the fixtures defined in test/fixtures
 *
 * We create peers for use in browser/node environments
 * configured to either connect directly (websocket listening multiaddr)
 * or connecting through a well-known relay
 */

const defaultConfig = (): Libp2pOptions => ({
  transports: [
    new WebSockets({
      filter: filters.all
    })
  ],
  streamMuxers: [
    new Mplex()
  ],
  connectionEncryption: [
    NOISE
  ],
  connectionManager: {
    autoDial: false
  }
})

function isBrowser () {
  return typeof window === 'object' || typeof self === 'object'
}

/**
 * Selectively determine the listen address based on the operating environment
 *
 * If in node, use websocket address
 * If in browser, use relay address
 */
function getListenAddress (peerId: PeerId) {
  if (isBrowser()) {
    // browser
    return new Multiaddr(`${RelayPeer.multiaddr}/p2p-circuit/p2p/${peerId.toString()}`)
  } else {
    // node
    return new Multiaddr('/ip4/127.0.0.1/tcp/0/ws')
  }
}

export async function createPeerId () {
  return await createFromJSON(Peers[0])
}

/**
 * Create libp2p node, selectively determining the listen address based on the operating environment
 * If no peerId is given, default to the first peer in the fixtures peer list
 */
export async function createPeer (opts: { peerId?: PeerId, started?: boolean, config?: Libp2pOptions } = {}) {
  let {
    peerId,
    started = true,
    config
  } = opts

  if (peerId == null) {
    peerId = await createEd25519PeerId()
  }

  const libp2p = await createLibp2p({
    peerId: peerId,
    addresses: {
      listen: [
        getListenAddress(peerId).toString()
      ]
    },
    ...defaultConfig(),
    ...config
  })

  if (started) {
    await libp2p.start()
  }


  try {
    // not available everywhere
    setMaxListeners(Infinity, libp2p.pubsub)
    setMaxListeners(Infinity, libp2p)
  } catch {}


  return libp2p
}

export async function seedAddressBooks (...peers: Libp2p[]) {
  for (let i = 0; i < peers.length; i++) {
    for (let j = 0; j < peers.length; j++) {
      if (i !== j) {
        await peers[i].peerStore.addressBook.set(peers[j].peerId, peers[j].getMultiaddrs())
      }
    }
  }
}

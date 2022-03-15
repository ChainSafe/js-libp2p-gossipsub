import Libp2p from 'libp2p'
import { Multiaddr } from 'multiaddr'
import PeerId from 'peer-id'
import WS from 'libp2p-websockets'
import filters from 'libp2p-websockets/src/filters'
import MPLEX from 'libp2p-mplex'
import { NOISE } from '@chainsafe/libp2p-noise'
import Peers from '../fixtures/peers'
import RelayPeer from '../fixtures/relay'

/**
 * These utilities rely on the fixtures defined in test/fixtures
 *
 * We create peers for use in browser/node environments
 * configured to either connect directly (websocket listening multiaddr)
 * or connecting through a well-known relay
 */

const transportKey = WS.prototype[Symbol.toStringTag]

const defaultConfig = {
  modules: {
    transport: [WS],
    streamMuxer: [MPLEX],
    connEncryption: [NOISE]
  },
  config: {
    pubsub: {
      enabled: false
    },
    peerDiscovery: {
      autoDial: false
    },
    transport: {
      [transportKey]: {
        filter: filters.all
      }
    }
  }
}

function isBrowser() {
  return typeof window === 'object' || typeof self === 'object'
}

/**
 * Selectively determine the listen address based on the operating environment
 *
 * If in node, use websocket address
 * If in browser, use relay address
 */
function getListenAddress(peerId) {
  if (isBrowser()) {
    // browser
    return new Multiaddr(`${RelayPeer.multiaddr}/p2p-circuit/p2p/${peerId.toB58String()}`)
  } else {
    // node
    return new Multiaddr('/ip4/127.0.0.1/tcp/0/ws')
  }
}

/**
 * Create libp2p node, selectively determining the listen address based on the operating environment
 * If no peerId is given, default to the first peer in the fixtures peer list
 */
export async function createPeer({ peerId, started = true, config = {} } = {}) {
  if (!peerId) {
    peerId = await PeerId.createFromJSON(Peers[0])
  }
  const libp2p = await Libp2p.create({
    peerId: peerId,
    addresses: {
      listen: [getListenAddress(peerId)]
    },
    ...defaultConfig,
    ...config
  })

  if (started) {
    await libp2p.start()
  }

  return libp2p
}

function addPeersToAddressBook(peers) {
  for (let i = 0; i < peers.length; i++) {
    for (let j = 0; j < peers.length; j++) {
      if (i !== j) {
        peers[i].peerStore.addressBook.set(peers[j].peerId, peers[j].multiaddrs)
      }
    }
  }
}

/**
 * Create libp2p nodes from known peer ids, preconfigured to use fixture peer ids
 * @param {Object} [properties]
 * @param {Object} [properties.config]
 * @param {number} [properties.number] number of peers (default: 1).
 * @param {boolean} [properties.started] nodes should start (default: true)
 * @param {boolean} [properties.seedAddressBook] nodes should have each other in their addressbook
 * @return {Promise<Array<Libp2p>>}
 */
export async function createPeers({ number = 1, started = true, seedAddressBook = true, config = {} } = {}) {
  const peerIds = await Promise.all(
    Array.from({ length: number }, (_, i) => (Peers[i] ? PeerId.createFromJSON(Peers[i]) : PeerId.create()))
  )
  const peers = await Promise.all(
    Array.from({ length: number }, (_, i) => createPeer({ peerId: peerIds[i], started: false, config: config }))
  )

  if (started) {
    await Promise.all(peers.map((p) => p.start()))

    if (seedAddressBook) {
      addPeersToAddressBook(peers)
    }
  }

  return peers
}

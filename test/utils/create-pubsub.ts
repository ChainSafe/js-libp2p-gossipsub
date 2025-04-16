import { setMaxListeners } from 'events'
import { generateKeyPair } from '@libp2p/crypto/keys'
import { TypedEventEmitter, start } from '@libp2p/interface'
import { mockRegistrar, mockConnectionManager, mockNetwork } from '@libp2p/interface-compliance-tests/mocks'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { persistentPeerStore } from '@libp2p/peer-store'
import { MemoryDatastore } from 'datastore-core'
import { stubInterface } from 'sinon-ts'
import { gossipsub, GossipSub, type GossipSubComponents, type GossipsubOpts } from '../../src/index.js'
import type { TypedEventTarget, Libp2pEvents } from '@libp2p/interface'
import type { ConnectionManager } from '@libp2p/interface-internal'
import type { floodsub } from '@libp2p/floodsub'

export interface CreateComponentsOpts {
  init?: Partial<GossipsubOpts>
  pubsub?: typeof floodsub
}

export interface GossipSubTestComponents extends GossipSubComponents {
  events: TypedEventTarget<Libp2pEvents>
}

export interface GossipSubAndComponents {
  pubsub: GossipSub
  components: GossipSubTestComponents
}

export const createComponents = async (opts: CreateComponentsOpts): Promise<GossipSubAndComponents> => {
  const Ctor = opts.pubsub ?? gossipsub
  const privateKey = await generateKeyPair('Ed25519')
  const peerId = peerIdFromPrivateKey(privateKey)

  const events = new TypedEventEmitter<Libp2pEvents>()
  const logger = defaultLogger()

  const components: GossipSubTestComponents = {
    privateKey,
    peerId,
    registrar: mockRegistrar(),
    connectionManager: stubInterface<ConnectionManager>(),
    peerStore: persistentPeerStore({
      peerId,
      datastore: new MemoryDatastore(),
      events,
      logger
    }),
    events,
    logger
  }
  components.connectionManager = mockConnectionManager(components)

  const pubsub = Ctor(opts.init)(components) as GossipSub

  await start(...Object.entries(components), pubsub)

  mockNetwork.addNode(components)

  try {
    // not available everywhere
    setMaxListeners(Infinity, pubsub)
  } catch {}

  return { pubsub, components }
}

export const createComponentsArray = async (
  opts: CreateComponentsOpts & { number: number, connected?: boolean } = { number: 1, connected: true }
): Promise<GossipSubAndComponents[]> => {
  const output = await Promise.all(
    Array.from({ length: opts.number }).map(async (_, i) =>
      createComponents({ ...opts, init: { ...opts.init, debugName: `libp2p:gossipsub:${i}` } })
    )
  )

  if (opts.connected ?? false) {
    await connectAllPubSubNodes(output)
  }

  return output
}

export const connectPubsubNodes = async (a: GossipSubAndComponents, b: GossipSubAndComponents): Promise<void> => {
  const multicodecs = new Set<string>([...a.pubsub.multicodecs, ...b.pubsub.multicodecs])

  const connection = await a.components.connectionManager.openConnection(b.components.peerId)

  for (const multicodec of multicodecs) {
    for (const topology of a.components.registrar.getTopologies(multicodec)) {
      topology.onConnect?.(b.components.peerId, connection)
    }
  }
}

export const connectAllPubSubNodes = async (components: GossipSubAndComponents[]): Promise<void> => {
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      await connectPubsubNodes(components[i], components[j])
    }
  }
}

/**
 * Connect some gossipsub nodes to others, ensure each has num peers
 *
 * @param {GossipSubAndComponents[]} gss
 * @param {number} num - number of peers to connect
 */
export async function connectSome (gss: GossipSubAndComponents[], num: number): Promise<void> {
  for (let i = 0; i < gss.length; i++) {
    let count = 0
    // merely do a Math.random() and check for duplicate may take a lot of time to run a test
    // so we make an array of candidate peers
    // initially, don't populate i as a candidate to connect: candidatePeers[i] = i + 1
    const candidatePeers = Array.from({ length: gss.length - 1 }, (_, j) => (j >= i ? j + 1 : j))
    while (count < num) {
      const n = Math.floor(Math.random() * candidatePeers.length)
      const peer = candidatePeers[n]
      await connectPubsubNodes(gss[i], gss[peer])
      // after connecting to a peer, update candidatePeers so that we don't connect to it again
      for (let j = n; j < candidatePeers.length - 1; j++) {
        candidatePeers[j] = candidatePeers[j + 1]
      }
      // remove the last item
      candidatePeers.splice(candidatePeers.length - 1, 1)
      count++
    }
  }
}

export async function sparseConnect (gss: GossipSubAndComponents[]): Promise<void> {
  await connectSome(gss, 3)
}

export async function denseConnect (gss: GossipSubAndComponents[]): Promise<void> {
  await connectSome(gss, Math.min(gss.length - 1, 10))
}

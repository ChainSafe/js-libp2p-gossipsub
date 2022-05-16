import { Components } from '@libp2p/interfaces/components'
import { createRSAPeerId } from '@libp2p/peer-id-factory'
import {
  mockRegistrar,
  mockConnectionManager,
  mockConnectionGater,
  mockNetwork
} from '@libp2p/interface-compliance-tests/mocks'
import { MemoryDatastore } from 'datastore-core'
import { GossipSub, GossipsubOpts } from '../../src/index.js'
import { PubSub } from '@libp2p/interfaces/pubsub'
import { setMaxListeners } from 'events'
import { PersistentPeerStore } from '@libp2p/peer-store'
import { start } from '@libp2p/interfaces/startable'

export interface CreateComponentsOpts {
  init?: Partial<GossipsubOpts>
  pubsub?: { new (opts?: any): PubSub }
}

export const createComponents = async (opts: CreateComponentsOpts) => {
  const Ctor = opts.pubsub ?? GossipSub

  const components = new Components({
    peerId: await createRSAPeerId({ bits: 512 }),
    registrar: mockRegistrar(),
    datastore: new MemoryDatastore(),
    connectionManager: mockConnectionManager(),
    connectionGater: mockConnectionGater(),
    pubsub: new Ctor(opts.init),
    peerStore: new PersistentPeerStore()
  })

  await start(components)

  mockNetwork.addNode(components)

  try {
    // not available everywhere
    setMaxListeners(Infinity, components.getPubSub())
  } catch {}

  return components
}

export const createComponentsArray = async (
  opts: CreateComponentsOpts & { number: number; connected?: boolean } = { number: 1, connected: true }
) => {
  const output = await Promise.all(Array.from({ length: opts.number }).map(async () => createComponents(opts)))

  if (opts.connected) {
    await connectAllPubSubNodes(output)
  }

  return output
}

export const connectPubsubNodes = async (componentsA: Components, componentsB: Components, multicodec?: string) => {
  const multicodecs = new Set<string>([...componentsA.getPubSub().multicodecs, ...componentsB.getPubSub().multicodecs])

  const connection = await componentsA.getConnectionManager().openConnection(componentsB.getPeerId())

  connection.newStream(Array.from(multicodecs))
}

export const connectAllPubSubNodes = async (components: Components[]) => {
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      await connectPubsubNodes(components[i], components[j])
    }
  }
}

/**
 * Connect some gossipsub nodes to others, ensure each has num peers
 * @param {Gossipsub[]} gss
 * @param {number} num number of peers to connect
 */
export async function connectSome(gss: Components[], num: number) {
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

export async function sparseConnect(gss: Components[]) {
  await connectSome(gss, 3)
}

export async function denseConnect(gss: Components[]) {
  await connectSome(gss, Math.min(gss.length - 1, 10))
}

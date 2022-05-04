import { Components } from '@libp2p/interfaces/components'
import { createRSAPeerId } from '@libp2p/peer-id-factory'
import {
  mockRegistrar,
  mockConnectionManager,
  mockConnectionGater,
  mockNetwork
} from '@libp2p/interface-compliance-tests/mocks'
import { MemoryDatastore } from 'datastore-core'
import { GossipSub, GossipsubOpts } from '../../ts/index.js'
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
 * For every node in `gss`, connect it to `num` other nodes in `gss`
 *
 * @param {Gossipsub[]} gss
 * @param {number} num - number of peers to connect each node to
 */
export async function connectSome(gss: Components[], num: number) {
  for (let i = 0; i < gss.length; i++) {
    while (gss[i].getConnectionManager().getConnections().length < num) {
      const n = Math.floor(Math.random() * gss.length)
      if (n === i || gss[i].getConnectionManager().getConnections(gss[n].getPeerId()).length > 0) {
        continue
      }

      await connectPubsubNodes(gss[i], gss[n])
    }
  }
}

export async function sparseConnect(gss: Components[]) {
  await connectSome(gss, 3)
}

export async function denseConnect(gss: Components[]) {
  await connectSome(gss, Math.min(gss.length - 1, 10))
}

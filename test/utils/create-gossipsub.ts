import { GossipSub, GossipsubOpts } from '../../ts/index.js'
import { fastMsgIdFn } from './msgId.js'
import { createPeer, seedAddressBooks } from './create-peer.js'
import { FloodSub, FloodSubInit } from '@libp2p/floodsub'
import type { Libp2p } from 'libp2p'

export async function connectGossipsub (gs1: Libp2p, gs2: Libp2p) {
  const addr = gs2.getMultiaddrs()[0]

  if (addr == null) {
    throw new Error('Peer has no multiaddrs available')
  }

  await gs1.dialProtocol(addr, gs1.pubsub.multicodecs)
}

/**
 * Create a number of preconfigured gossipsub nodes
 */
export async function createGossipSub ({
  started = true,
  init
}: {
  started?: boolean
  init?: Partial<GossipsubOpts>
} = {}): Promise<Libp2p> {
  return await createPeer({
    started,
    config: {
      pubsub: new GossipSub({ ...init, fastMsgIdFn: fastMsgIdFn })
    }
  })
}

/**
 * Create a number of preconfigured gossipsub nodes
 */
export async function createGossipSubs ({
  number = 2,
  started = true,
  init
}: {
  number?: number
  started?: boolean
  init?: Partial<GossipsubOpts>
} = {}): Promise<Libp2p[]> {
  const nodes = await Promise.all(
    Array.from({ length: number }).fill(0).map(async () => await createGossipSub({ started, init }))
  )

  await seedAddressBooks(...nodes)

  return nodes
}

/**
 * Create a number of preconfigured floodsub nodes
 */
export async function createFloodSub ({
  started = true,
  init
}: {
  started?: boolean
  init?: Partial<FloodSubInit>
} = {}): Promise<Libp2p> {
  return await createPeer({
    started,
    config: {
      pubsub: new FloodSub(init)
    }
  })
}

/**
 * Create a number of preconfigured floodsub nodes
 */
export async function createFloodSubs ({
  number = 2,
  started = true,
  init
}: {
  number?: number
  started?: boolean
  init?: Partial<FloodSubInit>
} = {}): Promise<Libp2p[]> {
  return await Promise.all(
    Array.from({ length: number }).fill(0).map(async () => await createFloodSub({ started, init }))
  )
}

/**
 * Connect some gossipsub nodes to others
 *
 * @param {Gossipsub[]} gss
 * @param {number} num - number of peers to connect
 */
export async function connectSome (gss: Libp2p[], num: number) {
  for (let i = 0; i < gss.length; i++) {
    for (let j = 0; j < num; j++) {
      const n = Math.floor(Math.random() * gss.length)
      if (n === i) {
        j--
        continue
      }
      await connectGossipsub(gss[i], gss[n])
    }
  }
}

export async function sparseConnect (gss: Libp2p[]) {
  await connectSome(gss, 3)
}

export async function denseConnect (gss: Libp2p[]) {
  await connectSome(gss, 10)
}

/**
 * Connect every gossipsub node to every other
 *
 * @param {Gossipsub[]} gss
 */
export async function connectGossipsubs (gss: Libp2p[]) {
  for (let i = 0; i < gss.length; i++) {
    for (let j = i + 1; j < gss.length; j++) {
      await connectGossipsub(gss[i], gss[j])
    }
  }
}

/**
 * Create a number of fully connected gossipsub nodes
 */
export async function createConnectedGossipsubs ({
  number = 2,
  init = {}
}: { number?: number, init?: Partial<GossipsubOpts> } = {}): Promise<Libp2p[]> {
  const nodes = await Promise.all(
    Array.from({ length: number }).fill(0).map(async () => await createGossipSub({ started: true, init }))
  )

  await connectGossipsubs(nodes)

  return nodes
}

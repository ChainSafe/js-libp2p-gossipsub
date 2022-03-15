import Gossipsub, { GossipInputOptions } from '../../ts'
import { fastMsgIdFn } from './msgId'
import { createPeers } from './create-peer'
import PubsubBaseProtocol from 'libp2p-interfaces/src/pubsub'

/**
 * Start node - gossipsub + libp2p
 */
export async function startNode(gs: PubsubBaseProtocol) {
  await gs._libp2p.start()
  await gs.start()
}

/**
 * Stop node - gossipsub + libp2p
 */
export async function stopNode(gs: PubsubBaseProtocol) {
  await gs._libp2p.stop()
  await gs.stop()
}

export async function connectGossipsub(gs1: PubsubBaseProtocol, gs2: PubsubBaseProtocol) {
  await gs1._libp2p.dialProtocol(gs2._libp2p.peerId, gs1.multicodecs)
}

/**
 * Create a number of preconfigured gossipsub nodes
 */
export async function createGossipsubs({
  number = 1,
  started = true,
  options
}: {
  number?: number
  started?: boolean
  options?: Partial<GossipInputOptions>
} = {}) {
  const libp2ps = await createPeers({ number, started })
  const gss = libp2ps.map((libp2p) => new Gossipsub(libp2p, { ...options, fastMsgIdFn: fastMsgIdFn }))

  if (started) {
    await Promise.all(gss.map((gs) => gs.start()))
  }

  return gss
}

/**
 * Stop gossipsub nodes
 */
export async function tearDownGossipsubs(gss: PubsubBaseProtocol[]) {
  await Promise.all(
    gss.map(async (p) => {
      await p.stop()
      await p._libp2p.stop()
    })
  )
}

/**
 * Connect some gossipsub nodes to others
 * @param {Gossipsub[]} gss
 * @param {number} num number of peers to connect
 */
export async function connectSome(gss: PubsubBaseProtocol[], num: number) {
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

export async function sparseConnect(gss: PubsubBaseProtocol[]) {
  await connectSome(gss, 3)
}

export async function denseConnect(gss: PubsubBaseProtocol[]) {
  await connectSome(gss, 10)
}

/**
 * Connect every gossipsub node to every other
 * @param {Gossipsub[]} gss
 */
export async function connectGossipsubs(gss: PubsubBaseProtocol[]) {
  for (let i = 0; i < gss.length; i++) {
    for (let j = i + 1; j < gss.length; j++) {
      await connectGossipsub(gss[i], gss[j])
    }
  }
}

/**
 * Create a number of fully connected gossipsub nodes
 */
export async function createConnectedGossipsubs({
  number = 2,
  options = {}
}: { number?: number; options?: Partial<GossipInputOptions> } = {}) {
  const gss = await createGossipsubs({ number, started: true, options })
  await connectGossipsubs(gss)
  return gss
}

import { EventEmitter } from 'events'
import PubsubBaseProtocol from 'libp2p-interfaces/src/pubsub'
import Gossipsub, { GossipsubOpts } from '../../ts'
import { fastMsgIdFn } from './msgId'
import { createPeers } from './create-peer'
import { FloodsubID } from '../../ts/constants'

export type PubsubBaseMinimal = EventEmitter &
  Pick<PubsubBaseProtocol, 'start' | 'stop' | '_libp2p' | 'multicodecs' | 'subscribe'>

/**
 * Start node - gossipsub + libp2p
 */
export async function startNode(gs: PubsubBaseMinimal) {
  await gs._libp2p.start()
  await gs.start()
}

/**
 * Stop node - gossipsub + libp2p
 */
export async function stopNode(gs: PubsubBaseMinimal) {
  await gs._libp2p.stop()
  await gs.stop()
}

export async function connectGossipsub(gs1: PubsubBaseMinimal, gs2: PubsubBaseMinimal) {
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
  options?: Partial<GossipsubOpts>
} = {}) {
  const libp2ps = await createPeers({ number, started })
  const gss = libp2ps.map((libp2p) => new Gossipsub(libp2p, { ...options, fastMsgIdFn: fastMsgIdFn }))

  if (started) {
    await Promise.all(gss.map((gs) => gs.start()))
  }

  return gss
}

export async function createPubsubs({
  number = 1,
  started = true,
  options = {}
}: {
  number?: number
  started?: boolean
  options?: Partial<GossipsubOpts>
} = {}) {
  const libp2ps = await createPeers({ number, started })
  const pubsubs = libp2ps.map(
    (libp2p) =>
      new PubsubBaseProtocol({
        debugName: 'pubsub',
        multicodecs: FloodsubID,
        libp2p
      })
  )

  if (started) {
    await Promise.all(pubsubs.map((gs) => gs.start()))
  }

  return pubsubs
}

/**
 * Stop gossipsub nodes
 */
export async function tearDownGossipsubs(gss: PubsubBaseMinimal[]) {
  await Promise.all(
    gss.map(async (p) => {
      await p.stop()
      await p._libp2p.stop()
    })
  )
}

/**
 * Connect some gossipsub nodes to others, ensure each has num peers
 * @param {Gossipsub[]} gss
 * @param {number} num number of peers to connect
 */
export async function connectSome(gss: PubsubBaseMinimal[], num: number) {
  for (let i = 0; i < gss.length; i++) {
    let count = 0;
    // merely do a Math.random() and check for duplicate may take a lot of time to run a test
    // so we make an array of candidate peers
    // initially, don't populate i as a candidate to connect: candidatePeers[i] = i + 1
    const candidatePeers = Array.from({length: gss.length - 1}, (_, j) => j >= i ? j + 1 : j)
    while (count < num) {
      const n = Math.floor(Math.random() * (candidatePeers.length))
      const peer = candidatePeers[n]
      await connectGossipsub(gss[i], gss[peer])
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

export async function sparseConnect(gss: PubsubBaseMinimal[]) {
  await connectSome(gss, Math.min(3, gss.length - 1))
}

export async function denseConnect(gss: PubsubBaseMinimal[]) {
  await connectSome(gss, Math.min(10, gss.length - 1))
}

/**
 * Connect every gossipsub node to every other
 * @param {Gossipsub[]} gss
 */
export async function connectGossipsubs(gss: PubsubBaseMinimal[]) {
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
}: { number?: number; options?: Partial<GossipsubOpts> } = {}) {
  const gss = await createGossipsubs({ number, started: true, options })
  await connectGossipsubs(gss)
  return gss
}

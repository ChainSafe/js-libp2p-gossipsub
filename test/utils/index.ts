import { FloodSub } from '@libp2p/floodsub'
import delay from 'delay'
import type { Libp2p } from 'libp2p'
import type { TopicStr } from '../../ts/types.js'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import type { PeerId } from '@libp2p/interfaces/peer-id'
import type { RPC } from '../../ts/message/rpc.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

export * from './create-gossipsub.js'
export * from './msgId.js'

export const createPeerId = async () => {
  const peerId = await createEd25519PeerId()

  return peerId
}

export const createFloodsubNode = async (libp2p: Libp2p, shouldStart = false) => {
  const fs = new FloodSub()

  if (shouldStart) {
    await libp2p.start()
    await fs.start()
  }

  return fs
}

export const waitForAllNodesToBePeered = async (peers: Libp2p[], attempts = 10, delayMs = 100) => {
  const nodeIds = peers.map((peer) => peer.peerId)

  for (let i = 0; i < attempts; i++) {
    for (const node of peers) {
      const others = nodeIds.filter((peerId) => !peerId.equals(node.peerId))
      const missing = others.some((other) => node.getConnections(other).length === 0)

      if (!missing) {
        return
      }
    }

    await delay(delayMs)
  }
}

let seq = 0n
const defaultPeer = uint8ArrayFromString('12D3KooWBsYhazxNL7aeisdwttzc6DejNaM48889t5ifiS6tTrBf', 'base58btc')

export function makeTestMessage (i: number, topic: TopicStr, from?: PeerId): RPC.Message {
  return {
    seqno: uint8ArrayFromString((seq++).toString(16).padStart(16, '0'), 'base16'),
    data: Uint8Array.from([i]),
    from: from?.toBytes() ?? defaultPeer,
    topic
  }
}

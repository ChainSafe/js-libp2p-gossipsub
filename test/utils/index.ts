import { expect } from 'chai'
import FloodSub from 'libp2p-floodsub'
import PeerId from 'peer-id'
import delay from 'delay'
import Libp2p from 'libp2p'
import Gossipsub from '../../ts'
import { GossipsubMessage, TopicStr } from '../../ts/types'

export * from './create-peer'
export * from './create-gossipsub'
export * from './msgId'

export const first = <T>(map: Map<unknown, T> | Set<T> | undefined): T => {
  if (!map) throw Error('No map')

  return map.values().next().value
}

export const expectSet = <T>(set: Set<T> | undefined, list: T[]) => {
  if (!set) throw Error('No map')

  expect(set.size).to.eql(list.length)
  list.forEach((item) => {
    expect(set.has(item)).to.eql(true)
  })
}

export const createPeerId = async () => {
  const peerId = await PeerId.create({ bits: 1024 })

  return peerId
}

export const createFloodsubNode = async (libp2p: Libp2p, shouldStart = false) => {
  const fs = new FloodSub(libp2p)
  fs._libp2p = libp2p

  if (shouldStart) {
    await libp2p.start()
    await fs.start()
  }

  return fs
}

export const waitForAllNodesToBePeered = async (peers: Gossipsub[], attempts = 10, delayMs = 100) => {
  const nodeIds = peers.map((peer) => peer.peerId!.toB58String())

  for (let i = 0; i < attempts; i++) {
    for (const node of peers) {
      const nodeId = node.peerId!.toB58String()
      const others = nodeIds.filter((peerId) => peerId !== nodeId)

      const missing = others.some((other) => !node['peers'].has(other))

      if (!missing) {
        return
      }
    }

    await delay(delayMs)
  }
}

export function makeTestMessage(i: number, topic: TopicStr): GossipsubMessage {
  return {
    seqno: Uint8Array.from(new Array(8).fill(i)),
    data: Uint8Array.from([i]),
    from: new Uint8Array(0),
    topic
  }
}

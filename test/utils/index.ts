import { expect } from 'chai'
import FloodSub from 'libp2p-floodsub'
import PeerId from 'peer-id'
import delay from 'delay'

export * from './create-peer'
export * from './create-gossipsub'
export * from './make-test-message'
export * from './msgId'

export const first = (map) => map.values().next().value

export const expectSet = (set, list) => {
  expect(set.size).to.eql(list.length)
  list.forEach((item) => {
    expect(set.has(item)).to.eql(true)
  })
}

export const createPeerId = async () => {
  const peerId = await PeerId.create({ bits: 1024 })

  return peerId
}

export const createFloodsubNode = async (libp2p, shouldStart = false, options) => {
  const fs = new FloodSub(libp2p, options)
  fs._libp2p = libp2p

  if (shouldStart) {
    await libp2p.start()
    await fs.start()
  }

  return fs
}

export const waitForAllNodesToBePeered = async (peers, attempts = 10, delayMs = 100) => {
  const nodeIds = peers.map((peer) => peer.peerId.toB58String())

  for (let i = 0; i < attempts; i++) {
    for (const node of peers) {
      const nodeId = node.peerId.toB58String()
      const others = nodeIds.filter((peerId) => peerId !== nodeId)

      const missing = others.some((other) => !node.peers.has(other))

      if (!missing) {
        return
      }
    }

    await delay(delayMs)
  }
}

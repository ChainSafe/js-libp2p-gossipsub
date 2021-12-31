'use strict'

const { expect } = require('chai')
const FloodSub = require('libp2p-floodsub')
const PeerId = require('peer-id')
const delay = require('delay')

exports.first = (map) => map.values().next().value

exports.expectSet = (set, list) => {
  expect(set.size).to.eql(list.length)
  list.forEach(item => {
    expect(set.has(item)).to.eql(true)
  })
}

const createPeerId = async () => {
  const peerId = await PeerId.create({ bits: 1024 })

  return peerId
}

exports.createPeerId = createPeerId

const createFloodsubNode = async (libp2p, shouldStart = false, options) => {
  const fs = new FloodSub(libp2p, options)
  fs._libp2p = libp2p

  if (shouldStart) {
    await libp2p.start()
    await fs.start()
  }

  return fs
}

exports.createFloodsubNode = createFloodsubNode

for (const [k, v] of Object.entries({
  ...require('./create-peer'),
  ...require('./create-gossipsub'),
  ...require('./make-test-message'),
  ...require('./msgId'),
})) {
  exports[k] = v
}

exports.waitForAllNodesToBePeered = async (peers, attempts = 10, delayMs = 100) => {
  const nodeIds = peers.map(peer => peer.peerId.toB58String())

  for (let i = 0; i < attempts; i++) {
    for (const node of peers) {
      const nodeId = node.peerId.toB58String()
      const others = nodeIds.filter(peerId => peerId !== nodeId)

      const missing = others.some(other => !node.peers.has(other))

      if (!missing) {
        return
      }
    }

    await delay(delayMs)
  }
}

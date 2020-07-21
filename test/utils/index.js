'use strict'

const { expect } = require('chai')

const DuplexPair = require('it-pair/duplex')
const pTimes = require('p-times')

const FloodSub = require('libp2p-floodsub')
const PeerId = require('peer-id')

const Gossipsub = require('../../src')

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
  const fs = new FloodSub(libp2p.peerId, libp2p.registrar, options)
  fs._libp2p = libp2p

  if (shouldStart) {
    await libp2p.start()
    await fs.start()
  }

  return fs
}

exports.createFloodsubNode = createFloodsubNode

for (const [k, v] of Object.entries({
  ...require('./createPeer'),
  ...require('./createGossipsub'),
  ...require('./makeTestMessage')
})) {
  exports[k] = v
}

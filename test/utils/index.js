'use strict'

const { expect } = require('chai')

const DuplexPair = require('it-pair/duplex')
const pTimes = require('p-times')

const FloodSub = require('libp2p-floodsub')
const { multicodec: floodsubMulticodec } = require('libp2p-floodsub')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')

const GossipSub = require('../../src')
const { GossipSubID } = require('../../src/constants')

exports.first = (map) => map.values().next().value

exports.expectSet = (set, subs) => {
  expect(Array.from(set.values())).to.eql(subs)
}

const createPeerInfo = async (protocol = GossipSubID) => {
  const peerId = await PeerId.create({ bits: 1024 })
  const peerInfo = await PeerInfo.create(peerId)
  peerInfo.protocols.add(protocol)

  return peerInfo
}

exports.createPeerInfo = createPeerInfo

const createGossipsub = async (registrar, shouldStart = false, options) => {
  const peerInfo = await createPeerInfo()
  const gs = new GossipSub(peerInfo, registrar, options)

  if (shouldStart) {
    await gs.start()
  }

  return gs
}

exports.createGossipsub = createGossipsub

const createGossipsubNodes = async (n, shouldStart, options) => {
  const registrarRecords = Array.from({ length: n })

  const registrar = (registrarRecord) => ({
    register: (multicodecs, handlers) => {
      registrarRecord[multicodecs[0]] = handlers
    },
    unregister: (multicodecs) => {
      delete registrarRecord[multicodecs[0]]
    }
  })

  const nodes = await pTimes(n, (index) => {
    registrarRecords[index] = {}

    return createGossipsub(registrar(registrarRecords[index]), shouldStart, options)
  })

  return {
    nodes,
    registrarRecords
  }
}

exports.createGossipsubNodes = createGossipsubNodes

const connectGossipsubNodes = (nodes, registrarRecords, multicodec) => {
  // connect all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const onConnectI = registrarRecords[i][multicodec].onConnect
      const onConnectJ = registrarRecords[j][multicodec].onConnect

      // Notice peers of connection
      const [d0, d1] = DuplexPair()
      onConnectI(nodes[j].peerInfo, d0)
      onConnectJ(nodes[i].peerInfo, d1)
    }
  }

  return nodes
}

exports.connectGossipsubNodes = connectGossipsubNodes

const createGossipsubConnectedNodes = async (n, multicodec, options) => {
  const { nodes, registrarRecords } = await createGossipsubNodes(n, true, options)

  // connect all nodes
  return connectGossipsubNodes(nodes, registrarRecords, multicodec)
}

exports.createGossipsubConnectedNodes = createGossipsubConnectedNodes

const createFloodsubNode = async (registrar, shouldStart = false, options) => {
  const peerInfo = await createPeerInfo(floodsubMulticodec)
  const fs = new FloodSub(peerInfo, registrar, options)

  if (shouldStart) {
    await fs.start()
  }

  return fs
}

exports.createFloodsubNode = createFloodsubNode

exports.mockRegistrar = {
  register: (multicodecs, handlers) => {

  },
  unregister: (multicodecs) => {

  }
}

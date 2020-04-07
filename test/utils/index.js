'use strict'

const { expect } = require('chai')

const DuplexPair = require('it-pair/duplex')
const pTimes = require('p-times')

const FloodSub = require('libp2p-floodsub')
const PeerId = require('peer-id')

const GossipSub = require('../../src')

exports.first = (map) => map.values().next().value

exports.expectSet = (set, subs) => {
  expect(Array.from(set.values())).to.eql(subs)
}

const createPeerId = async () => {
  const peerId = await PeerId.create({ bits: 1024 })

  return peerId
}

exports.createPeerId = createPeerId

const createGossipsub = async (registrar, shouldStart = false, options) => {
  const peerId = await createPeerId()
  const gs = new GossipSub(peerId, registrar, options)

  if (shouldStart) {
    await gs.start()
  }

  return gs
}

exports.createGossipsub = createGossipsub

const createGossipsubNodes = async (n, shouldStart, options) => {
  const registrarRecords = Array.from({ length: n })

  const nodes = await pTimes(n, (index) => {
    registrarRecords[index] = {}

    return createGossipsub(createMockRegistrar(registrarRecords[index]), shouldStart, options)
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
      const [d0, d1] = ConnectionPair()
      onConnectI(nodes[j].peerId, d0)
      onConnectJ(nodes[i].peerId, d1)
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
  const peerId = await createPeerId()
  const fs = new FloodSub(peerId, registrar, options)

  if (shouldStart) {
    await fs.start()
  }

  return fs
}

exports.createFloodsubNode = createFloodsubNode

exports.mockRegistrar = {
  handle: () => { },
  register: () => { },
  unregister: () => { }
}

const createMockRegistrar = (registrarRecord) => ({
  handle: (multicodecs, handler) => {
    multicodecs.forEach((multicodec) => {
      const rec = registrarRecord[multicodec] || {}

      registrarRecord[multicodec] = {
        ...rec,
        handler
      }
    })
  },
  register: ({ multicodecs, _onConnect, _onDisconnect }) => {
    multicodecs.forEach((multicodec) => {
      const rec = registrarRecord[multicodec] || {}

      registrarRecord[multicodec] = {
        ...rec,
        onConnect: _onConnect,
        onDisconnect: _onDisconnect
      }
    })
    return multicodecs[0]
  },
  unregister: (id) => {
    delete registrarRecord[id]
  }
})

exports.createMockRegistrar = createMockRegistrar

const ConnectionPair = () => {
  const [d0, d1] = DuplexPair()

  return [
    {
      stream: d0,
      newStream: () => Promise.resolve({ stream: d0 })
    },
    {
      stream: d1,
      newStream: () => Promise.resolve({ stream: d1 })
    }
  ]
}

exports.ConnectionPair = ConnectionPair

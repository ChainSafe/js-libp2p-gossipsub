'use strict'

const WS = require('libp2p-websockets')
const spdy = require('libp2p-spdy')
const secio = require('libp2p-secio')
const libp2p = require('libp2p')

class Node extends libp2p {
  constructor ({ peerInfo, peerBook }) {
    const modules = {
      transport: [WS],
      streamMuxer: [spdy],
      connEncryption: [secio]
    }

    super({
      modules,
      peerInfo,
      peerBook
    })
  }
}

module.exports = Node

'use strict'

const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const { expect } = require('chai')
const promisify = require('promisify-es6')
const isNode = require('detect-node')

const Node = isNode ? require('./nodejs-bundle') : require('./browser-bundle')

const GossipSub = require('../../src')
const FloodSub = require('libp2p-floodsub')

exports.first = (map) => map.values().next().value

exports.expectSet = (set, subs) => {
  expect(Array.from(set.values())).to.eql(subs)
}

exports.createNode = async (maddr, options = {}) => {
  const id = await promisify(PeerId.create)({ bits: 1024 })
  const peerInfo = await promisify(PeerInfo.create)(id)
  peerInfo.multiaddrs.add(maddr)
  const node = new Node({ peerInfo })
  node.gs = new GossipSub(node, options)
  return node
}

exports.createFloodsubNode = async (maddr) => {
  const id = await promisify(PeerId.create)({ bits: 1024 })
  const peerInfo = await promisify(PeerInfo.create)(id)
  peerInfo.multiaddrs.add(maddr)
  const node = new Node({ peerInfo })
  node.fs = new FloodSub(node)
  return node
}

exports.startNode = async (node) => promisify(node.start.bind(node))()
exports.stopNode = async (node) => promisify(node.stop.bind(node))()
exports.dialNode = async (node, peerInfo) => promisify(node.dial.bind(node))(peerInfo)

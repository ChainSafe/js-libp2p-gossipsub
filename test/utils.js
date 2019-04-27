'use strict'

const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const { expect } = require('chai')
const promisify = require('promisify-es6')

const Node = require('./nodejs-bundle')

const GossipSub = require('../src')

exports.first = (map) => map.values().next().value

exports.expectSet = (set, subs) => {
  expect(Array.from(set.values())).to.eql(subs)
}

exports.createNode = async (maddr) => {
  const id = await promisify(PeerId.create)({ bits: 1024 })
  const peerInfo = await promisify(PeerInfo.create)(id)
  peerInfo.multiaddrs.add(maddr)
  const node = new Node({ peerInfo })
  node.gs = new GossipSub(node)
  return node
}

exports.startNode = async (node) => promisify(node.start.bind(node))()
exports.stopNode = async (node) => promisify(node.stop.bind(node))()
exports.dialNode = async (node, peerInfo) => promisify(node.dial.bind(node))(peerInfo)

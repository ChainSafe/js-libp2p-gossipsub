'use strict'

const Benchmark = require('benchmark')

const utils = require('../test/utils')
const suite = new Benchmark.Suite('gossipsub')

// Benchmark how many messages we can send from one peer to another
;(async function () {
  // create peers
  const peers = await Promise.all([
    utils.createNode('/ip4/127.0.0.1/tcp/0'),
    utils.createNode('/ip4/127.0.0.1/tcp/0')
  ])
  // start peer nodes
  await Promise.all(peers.map((p) => utils.startNode(p)))
  await Promise.all(peers.map((p) => utils.startNode(p.gs)))
  // connect peers
  await utils.dialNode(peers[0], peers[1].peerInfo)
  // subscribe
  peers.forEach((p) => p.gs.subscribe('Z'))
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // benchmark definition
  suite
    .add('publish and receive', (deferred) => {
      peers[1].gs.once('Z', (msg) => deferred.resolve(msg))
      peers[0].gs.publish('Z', new Uint8Array(1024))
    }, {
      defer: true
    })
    .on('cycle', (event) => {
      console.log(String(event.target)) // eslint-disable-line
    })
    .on('complete', () => {
      process.exit()
    })
    .run({
      async: true
    })
})()

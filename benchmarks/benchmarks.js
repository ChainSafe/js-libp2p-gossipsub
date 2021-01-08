'use strict'

const Benchmark = require('benchmark')

const utils = require('../test/utils')
const suite = new Benchmark.Suite('gossipsub')

// Benchmark how many messages we can send from one peer to another
;(async function () {
  // create peers
  const peers = await utils.createGossipsubs({ number: 2 })
  // connect peers
  await peers[0]._libp2p.dial(peers[1]._libp2p.peerId)
  // subscribe
  peers.forEach((p) => p.subscribe('Z'))
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // benchmark definition
  suite
    .add('publish and receive', (deferred) => {
      peers[1].once('Z', (msg) => deferred.resolve(msg))
      peers[0].publish('Z', new Uint8Array(1024))
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

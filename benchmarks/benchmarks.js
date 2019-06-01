'use strict'

const Benchmark = require('benchmark')
const map = require('async/map')
const parallel = require('async/parallel')
const series = require('async/series')
const crypto = require('libp2p-crypto')
const utils = require('../test/utils')
const GossipSub = require('../src')
const promisify = require('promisify-es6')
const assert = require('assert')
const suite = new Benchmark.Suite('gossipsub')

// Benchmark how many messages we can send from one peer to another
map([0, 1], (i, cb) => {
   utils.createNode('/ip4/127.0.0.1/tcp/0').then((node) => {
     const gs = new GossipSub(node)

     series([
       (cb) => node.start(cb),
       (cb) => gs.start(cb)
     ], (err) => {
       if (err) {
         return cb(err)
       }

       cb(null, {
         libp2p: node,
         gs
       })
     })
   })
}, (err, peers) => {
  if (err) {
    throw err
  }

  parallel([
    (cb) => peers[0].libp2p.dial(peers[1].libp2p.peerInfo, cb),
    (cb) => setTimeout(() => {
      peers[0].gs.subscribe('Z', () => {}, () => {})
      peers[1].gs.subscribe('Z', () => {}, () => {})
      cb(null, peers)
    }, 200)
  ], (err, res) => {
    if (err) {
      throw err
    }

    const peers = res[1]

    suite.add('publish and receive', (deferred) => {
      const onMsg = (msg) => {
        deferred.resolve()
        peers[1].gs.removeListener('Z', onMsg)
      }

      peers[1].gs.on('Z', onMsg)

      peers[0].gs.publish('Z', crypto.randomBytes(1024))
    }, {
      defer: true
    })

    suite
      .on('cycle', (event) => {
        console.log(String(event.target)) // eslint-disable-line
      })
      .on('complete', () => {
        process.exit()
      })
      .run({
        async: true
      })
  })
})

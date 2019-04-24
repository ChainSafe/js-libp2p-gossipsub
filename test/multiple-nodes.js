/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 8] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const parallel = require('async/parallel')
const promisify = require('promisify-es6')

const GossipSub = require('../src')
const utils = require('./utils')
const first = utils.first
const createNode = utils.createNode
const expectSet = utils.expectSet

describe('multiple nodes (more than 2)', () => {
  describe('every peer subscribes to the topic', () => {
    describe('line', () => {
      // line
      // ◉────◉────◉
      // a    b    c
      let a
      let b
      let c

      before((done) => {
        parallel([
          (cb) => spawnPubSubNode(cb),
          (cb) => spawnPubSubNode(cb),
          (cb) => spawnPubSubNode(cb)
        ], (err, nodes) => {
          if (err) {
            return done(err)
          }
          a = nodes[0]
          b = nodes[1]
          c = nodes[2]

          done()
        })
      })

      after(async function () {
        this.timeout(4000)
        await Promise.all([
          promisify(a.gs.stop.bind(a.gs))(),
          promisify(b.gs.stop.bind(b.gs))(),
          promisify(c.gs.stop.bind(c.gs))()
        ])
        await Promise.all([
          promisify(a.libp2p.stop.bind(a.libp2p))(),
          promisify(b.libp2p.stop.bind(b.libp2p))(),
          promisify(c.libp2p.stop.bind(c.libp2p))()
        ])
      })

      it('establish the connections', (done) => {
        parallel([
          (cb) => a.libp2p.dial(b.libp2p.peerInfo, cb),
          (cb) => b.libp2p.dial(c.libp2p.peerInfo, cb)
        ], (err) => {
          expect(err).to.not.exist()
          // wait for the pubsub pipes to be established
          setTimeout(done, 1000)
        })
      })

      it('subscribe to the topic on node a', (done) => {
        a.gs.subscribe('Z')
        expectSet(a.gs.subscriptions, ['Z'])

        b.gs.once('meshsub:subscription-change', () => {
          expect(b.gs.peers.size).to.equal(2)
          const aPeerId = a.libp2p.peerInfo.id.toB58String()
          const topics = b.gs.peers.get(aPeerId).topics
          expectSet(topics, ['Z'])

          expect(c.gs.peers.size).to.equal(1)
          expectSet(first(c.gs.peers).topics, [])

          done()
        })
      })

      it('subscribe to the topic on node b', (done) => {
        b.gs.subscribe('Z')
        expectSet(b.gs.subscriptions, ['Z'])

        parallel([
          cb => a.gs.once('meshsub:subscription-change', () => cb()),
          cb => c.gs.once('meshsub:subscription-change', () => cb())
        ], () => {
          expect(a.gs.peers.size).to.equal(1)
          expectSet(first(a.gs.peers).topics, ['Z'])

          expect(c.gs.peers.size).to.equal(1)
          expectSet(first(c.gs.peers).topics, ['Z'])

          done()
        })
      })

      it('subscribe to the topic on node c', (done) => {
        c.gs.subscribe('Z')
        expectSet(c.gs.subscriptions, ['Z'])

        b.gs.once('meshsub:subscription-change', () => {
          expect(a.gs.peers.size).to.equal(1)
          expectSet(first(a.gs.peers).topics, ['Z'])

          expect(b.gs.peers.size).to.equal(2)
          b.gs.peers.forEach((peer) => {
            expectSet(peer.topics, ['Z'])
          })

          done()
        })
      })

      it('wait for a heartbeat', async () => {
        await Promise.all([
          promisify(a.gs.once.bind(a.gs))('gossipsub:heartbeat'),
          promisify(b.gs.once.bind(b.gs))('gossipsub:heartbeat'),
          promisify(c.gs.once.bind(c.gs))('gossipsub:heartbeat')
        ])
      })

      it('publish on node a', async () => {
        let msgB = new Promise((resolve) => b.gs.once('Z', resolve))
        let msgC = new Promise((resolve) => c.gs.once('Z', resolve))

        a.gs.publish('Z', Buffer.from('hey'))
        msgB = await msgB
        msgC = await msgC

        expect(msgB.data.toString()).to.equal('hey')
        expect(msgC.data.toString()).to.equal('hey')
      })

      it('publish array on node a', async () => {
        let msgB = new Promise((resolve) => {
          const output = []
          b.gs.on('Z', (msg) => {
            output.push(msg)
            if (output.length === 2) {
              b.gs.removeAllListeners('Z')
              resolve(output)
            }
          })
        })
        let msgC = new Promise((resolve) => {
          const output = []
          c.gs.on('Z', (msg) => {
            output.push(msg)
            if (output.length === 2) {
              c.gs.removeAllListeners('Z')
              resolve(output)
            }
          })
        })

        a.gs.publish('Z', [Buffer.from('hey'), Buffer.from('hey')])
        msgB = await msgB
        msgC = await msgC

        expect(msgB.length).to.equal(2)
        expect(msgB[0].data.toString()).to.equal('hey')
        expect(msgB[1].data.toString()).to.equal('hey')
        expect(msgC.length).to.equal(2)
        expect(msgC[0].data.toString()).to.equal('hey')
        expect(msgC[1].data.toString()).to.equal('hey')
      })

      // since the topology is the same, just the publish
      // gets sent by other peer, we reused the same peers
      describe('1 level tree', () => {
        // 1 level tree
        //     ┌◉┐
        //     │b│
        //   ◉─┘ └─◉
        //   a     c

        it('publish on node b', async () => {
          let msgA = new Promise((resolve) => a.gs.once('Z', resolve))
          let msgC = new Promise((resolve) => c.gs.once('Z', resolve))

          b.gs.publish('Z', Buffer.from('hey'))
          msgA = await msgA
          msgC = await msgC

          expect(msgA.data.toString()).to.equal('hey')
          expect(msgC.data.toString()).to.equal('hey')
        })
      })
    })

    describe('2 level tree', () => {
      // 2 levels tree
      //      ┌◉┐
      //      │c│
      //   ┌◉─┘ └─◉┐
      //   │b     d│
      // ◉─┘       └─◉
      // a           e

      let a
      let b
      let c
      let d
      let e

      before((done) => {
        parallel([
          (cb) => spawnPubSubNode(cb),
          (cb) => spawnPubSubNode(cb),
          (cb) => spawnPubSubNode(cb),
          (cb) => spawnPubSubNode(cb),
          (cb) => spawnPubSubNode(cb)
        ], (err, nodes) => {
          if (err) {
            return done(err)
          }
          a = nodes[0]
          b = nodes[1]
          c = nodes[2]
          d = nodes[3]
          e = nodes[4]

          done()
        })
      })

      after(async function () {
        this.timeout(4000)
        await Promise.all([
          promisify(a.gs.stop.bind(a.gs))(),
          promisify(b.gs.stop.bind(b.gs))(),
          promisify(c.gs.stop.bind(c.gs))(),
          promisify(d.gs.stop.bind(d.gs))(),
          promisify(e.gs.stop.bind(e.gs))()
        ])
        await Promise.all([
          promisify(a.libp2p.stop.bind(a.libp2p))(),
          promisify(b.libp2p.stop.bind(b.libp2p))(),
          promisify(c.libp2p.stop.bind(c.libp2p))(),
          promisify(d.libp2p.stop.bind(d.libp2p))(),
          promisify(e.libp2p.stop.bind(e.libp2p))()
        ])
      })

      it('establish the connections', async () => {
        await Promise.all([
          promisify(a.libp2p.dial.bind(a.libp2p))(b.libp2p.peerInfo),
          promisify(b.libp2p.dial.bind(b.libp2p))(c.libp2p.peerInfo),
          promisify(c.libp2p.dial.bind(c.libp2p))(d.libp2p.peerInfo),
          promisify(d.libp2p.dial.bind(d.libp2p))(e.libp2p.peerInfo)
        ])
        await new Promise((resolve) => setTimeout(resolve, 500))
      })

      it('subscribes', () => {
        a.gs.subscribe('Z')
        expectSet(a.gs.subscriptions, ['Z'])
        b.gs.subscribe('Z')
        expectSet(b.gs.subscriptions, ['Z'])
        c.gs.subscribe('Z')
        expectSet(c.gs.subscriptions, ['Z'])
        d.gs.subscribe('Z')
        expectSet(d.gs.subscriptions, ['Z'])
        e.gs.subscribe('Z')
        expectSet(e.gs.subscriptions, ['Z'])
      })

      it('wait for a heartbeat', async () => {
        await Promise.all([
          promisify(a.gs.once.bind(a.gs))('gossipsub:heartbeat'),
          promisify(b.gs.once.bind(b.gs))('gossipsub:heartbeat'),
          promisify(c.gs.once.bind(c.gs))('gossipsub:heartbeat'),
          promisify(d.gs.once.bind(d.gs))('gossipsub:heartbeat'),
          promisify(e.gs.once.bind(e.gs))('gossipsub:heartbeat')
        ])
      })

      it('publishes from c', (done) => {
        let counter = 0

        a.gs.on('Z', incMsg)
        b.gs.on('Z', incMsg)
        d.gs.on('Z', incMsg)
        e.gs.on('Z', incMsg)

        c.gs.publish('Z', Buffer.from('hey from c'))

        function incMsg (msg) {
          expect(msg.data.toString()).to.equal('hey from c')
          check()
        }

        function check () {
          if (++counter === 4) {
            a.gs.removeListener('Z', incMsg)
            b.gs.removeListener('Z', incMsg)
            d.gs.removeListener('Z', incMsg)
            e.gs.removeListener('Z', incMsg)
            done()
          }
        }
      })
    })
  })

  describe('only some nodes subscribe the networks', () => {
    describe('line', () => {
      // line
      // ◉────◎────◉
      // a    b    c

      before((done) => {})
      after((done) => {})
    })

    describe('1 level tree', () => {
      // 1 level tree
      //     ┌◉┐
      //     │b│
      //   ◎─┘ └─◉
      //   a     c

      before((done) => {})
      after((done) => {})
    })

    describe('2 level tree', () => {
      // 2 levels tree
      //      ┌◉┐
      //      │c│
      //   ┌◎─┘ └─◉┐
      //   │b     d│
      // ◉─┘       └─◎
      // a           e

      before((done) => {})
      after((done) => {})
    })
  })
})

function spawnPubSubNode (callback) {
  createNode('/ip4/127.0.0.1/tcp/0', (err, node) => {
    if (err) {
      return callback(err)
    }
    const gs = new GossipSub(node)
    gs.start((err) => {
      if (err) {
        return callback(err)
      }
      callback(null, {
        libp2p: node,
        gs: gs
      })
    })
  })
}

/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect
const parallel = require('async/parallel')
const series = require('async/series')
const times = require('lodash/times')

const GossipSub = require('../src')
const utils = require('./utils')
const first = utils.first
const createNode = utils.createNode
const expectSet = utils.expectSet

describe('basics between 2 nodes', () => {
  describe('fresh nodes', () => {
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) {
          return done(err)
        }
        nodeA = nodes[0]
        nodeB = nodes[1]
        done()
      })
    })

    after((done) => {
      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], done)
    })

    it('Mount the pubsub protocol', (done) => {
      gsA = new GossipSub(nodeA)
      gsB = new GossipSub(nodeB)

      setTimeout(() => {
        expect(gsA.peers.size).to.be.eql(0)
        expect(gsA.mesh.size).to.eql(0)
        expect(gsA.fanout.size).to.eql(0)
        expect(gsA.lastpub.size).to.eql(0)
        expect(gsA.gossip.size).to.eql(0)
        expect(gsA.control.size).to.eql(0)
        expect(gsA.subscriptions).to.eql(0)
        expect(gsB.peers.size).to.be.eql(0)
        expect(gsB.mesh.size).to.eql(0)
        expect(gsB.fanout.size).to.eql(0)
        expect(gsB.lastpub.size).to.eql(0)
        expect(gsB.gossip.size).to.eql(0)
        expect(gsB.control.size).to.eql(0)
        expect(gsB.subscriptions.size).to.eql(0)
        done()
      }, 50)
    })

    it('start both GossipSubs', (done) => {
      parallel([
        (cb) => gsA.start(cb),
        (cb) => gsB.start(cb)
      ], done)
    })

    it('Dial from nodeA to nodeB', (done) => {
      series([
        (cb) => nodeA.dial(nodeB.peerInfo, cb),
        (cb) => setTimeout(() => {
          expect(gsA.peers.size).to.equal(1)
          expect(gsB.peers.size).to.equal(1)
          cb()
        }, 1000)
      ], done)
    })

    it('Subscribe to a topic:Z in nodeA', (done) => {
      gsA.subscribe('Z')
      gsB.once('meshsub:subscription-change', (changedPeerInfo, changedTopics, changedSubs) => {
        expectSet(gsA.subscriptions, ['Z'])
        expect(gsB.peers.size).to.equal(1)
        expectSet(first(gsB.peers).topics, ['Z'])
        expect(changedPeerInfo.id.toB58String()).to.equal(first(gsB.peers).info.id.toB58String())
        expectSet(changedTopics, ['Z'])
        expect(changedSubs).to.be.eql([{ topicCID: 'Z', subscribe: true }])
        done()
      })
    })

    it('Publish to a topic:Z in nodeA', (done) => {
      gsA.once('Z', (msg) => {
        expect(msg.data.toString()).to.equal('hey')
        gsB.removeListener('Z', shouldNotHappen)
        done()
      })

      gsB.once('Z', shouldNotHappen)

      gsA.publish('Z', Buffer.from('hey'))
    })

    it('Publish to a topic:Z in nodeB', (done) => {
      gsA.once('Z', (msg) => {
        gsA.once('Z', shouldNotHappen)
        expect(msg.data.toString()).to.equal('banana')

        setTimeout(() => {
          gsA.removeListener('Z', shouldNotHappen)
          gsB.removeListener('Z', shouldNotHappen)
          done()
        }, 100)
      })

      gsB.once('Z', shouldNotHappen)

      gsB.publish('Z', Buffer.from('banana'))
    })

    it('Publish 10 msg to a topic:Z in nodeB', (done) => {
      let counter = 0

      gsB.once('Z', shouldNotHappen)

      gsA.on('Z', receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(gsB.libp2p.peerInfo.id.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql(['Z'])

        if (++counter === 10) {
          gsA.removeListener('Z', receivedMsg)
          gsB.removeListener('Z', shouldNotHappen)
          done()
        }
      }

      times(10, () => gsB.publish('Z', Buffer.from('banana')))
    })

    it('Publish 10 msg to a topic:Z in nodeB as array', (done) => {
      let counter = 0

      gsB.once('Z', shouldNotHappen)

      gsA.on('Z', receivedMsg)

      function receivedMsg (msg) {
        expect(msg.data.toString()).to.equal('banana')
        expect(msg.from).to.be.eql(gsB.libp2p.peerInfo.id.toB58String())
        expect(Buffer.isBuffer(msg.seqno)).to.be.true()
        expect(msg.topicIDs).to.be.eql(['Z'])

        if (++counter === 10) {
          gsA.removeListener('Z', receivedMsg)
          gsB.removeListener('Z', shouldNotHappen)
          done()
        }
      }

      let msgs = []
      times(10, () => msgs.push(Buffer.from('banana')))
      gsB.publish('Z', msgs)
    })

    it('Unsubscribe from topic:Z in nodeA', (done) => {
      gsA.unsubscribe('Z')
      expect(gsA.subscriptions.size).to.equal(0)

      gsB.once('meshsub:subscription-change', (changedPeerInfo, changedTopics, changedSubs) => {
        expect(gsB.peers.size).to.equal(1)
        expectSet(first(gsB.peers).topics, [])
        expect(changedPeerInfo.id.toB58String()).to.equal(first(gsB.peers).info.id.toB58String())
        expectSet(changedTopics, [])
        expect(changedSubs).to.be.eql([{ topicCID: 'Z', subscribe: false }])
        done()
      })
    })

    it('Publish to a topic:Z in nodeA nodeB', (done) => {
      gsA.once('Z', shouldNotHappen)
      gsB.once('Z', shouldNotHappen)

      setTimeout(() => {
        gsA.removeListener('Z', shouldNotHappen)
        gsB.removeListener('Z', shouldNotHappen)
        done()
      }, 100)

      gsB.publish('Z', Buffer.from('banana'))
      gsA.publish('Z', Buffer.from('banana'))
    })

    it('stop both GossipSubs', (done) => {
      parallel([
        (cb) => gsA.stop(cb),
        (cb) => gsB.stop(cb)
      ], done)
    })
  })

  describe('nodes send state on connection', () => {
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      parallel([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()

        nodeA = nodes[0]
        nodeB = nodes[1]

        gsA = new GossipSub(nodeA)
        gsB = new GossipSub(nodeB)

        parallel([
          (cb) => gsA.start(cb),
          (cb) => gsB.start(cb)
        ], next)

        function next () {
          gsA.subscribe('Za')
          gsB.subscribe('Zb')

          expect(gsA.peers.size).to.equal(0)
          expectSet(gsA.subscriptions, ['Za'])
          expect(gsB.peers.size).to.equal(0)
          expectSet(gsB.subscriptions, ['Zb'])
          done()
        }
      })
    })

    after((done) => {
      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], done)
    })

    it('existing subscriptions are sent upon peer connection', (done) => {
      parallel([
        cb => gsA.once('meshsub:subscription-change', () => cb()),
        cb => gsB.once('meshsub:subscription-change', () => cb())
      ], () => {
        expect(gsA.peers.size).to.equal(1)
        expect(gsB.peers.size).to.equal(1)

        expectSet(gsA.subscriptions, ['Za'])
        expect(gsB.peers.size).to.equal(1)
        expectSet(first(gsB.peers).topics, ['Za'])

        expectSet(gsB.subscriptions, ['Zb'])
        expect(gsA.peers.size).to.equal(1)
        expectSet(first(gsA.peers).topics, ['Zb'])

        done()
      })

      nodeA.dial(nodeB.peerInfo, (err) => {
        expect(err).to.not.exist()
      })
    })

    it('stop both GossipSubs', (done) => {
      parallel([
        (cb) => gsA.stop(cb),
        (cb) => gsB.stop(cb)
      ], done)
    })
  })

  describe('nodes handle connection errors', () => {
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (cb, nodes) => {
        nodeA = nodes[0]
        nodeB = nodes[1]

        gsA = new GossipSub(nodeA)
        gsB = new GossipSub(nodeB)

        parallel([
          (cb) => gsA.start(cb),
          (cb) => gsB.start(cb)
        ], next)

        function next () {
          gsA.subscribe('Za')
          gsB.subscribe('Zb')

          expect(gsA.peers.size).to.equal(0)
          expectSet(gsA.subscriptions, ['Za'])
          expect(gsB.peers.size).to.equal(0)
          expectSet(gsB.subscriptions, ['Zb'])
          done()
        }
      })
    })

    // Understand why this is failing
    it.skip('peer is removed from the state when connection ends', (done) => {
      nodeA.dial(nodeB.peerInfo, (err) => {
        expect(err).to.not.exist()
        setTimeout(() => {
          expect(first(gsA.peers)._references).to.equal(2)
          expect(first(gsB.peers)._references).to.equal(2)

          gsA.stop(() => setTimeout(() => {
            expect(first(gsB.peers)._references).to.equal(1)
            done()
          }, 1000))
        }, 1000)
      })
    })

    it('stop one node', (done) => {
      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], done)
    })

    it('nodes don\'t have peers in it', (done) => {
      setTimeout(() => {
        expect(gsA.peers.size).to.equal(0)
        expect(gsB.peers.size).to.equal(0)
        done()
      }, 1000)
    })
  })

  describe('dial the pubsub protocol on mount', () => {
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (cb, nodes) => {
        nodeA = nodes[0]
        nodeB = nodes[1]
        nodeA.dial(nodeB.peerInfo, () => setTimeout(done, 1000))
      })
    })

    after((done) => {
      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], done)
    })

    it('dial on gossipsub on mount', (done) => {
      gsA = new GossipSub(nodeA)
      gsB = new GossipSub(nodeB)

      parallel([
        (cb) => gsA.start(cb),
        (cb) => gsB.start(cb)
      ], next)

      function next () {
        expect(gsA.peers.size).to.equal(1)
        expect(gsB.peers.size).to.equal(1)
        done()
      }
    })

    it('stop both GossipSubs', (done) => {
      parallel([
        (cb) => gsA.stop(cb),
        (cb) => gsB.stop(cb)
      ], done)
    })
  })

  describe('prevent concurrent dials', () => {
    let sandbox
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      sandbox = chai.spy.sandbox()

      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) return done(err)

        nodeA = nodes[0]
        nodeB = nodes[1]

        // Put node B in node A's peer book
        nodeA.peerBook.put(nodeB.peerInfo)

        gsA = new GossipSub(nodeA)
        gsB = new GossipSub(nodeB)

        gsB.start(done)
      })
    })

    after((done) => {
      sandbox.restore()

      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], (ignoreErr) => {
        done()
      })
    })

    it('does not dial twice to same peer', (done) => {
      sandbox.on(gsA, ['_onDial'])

      // When node A starts, it will dial all peers in its peer book, which
      // is just peer B
      gsA.start(startComplete)

      // Simulate a connection coming in from peer B at the same time. This
      // causes gossipsub to dial peer B
      nodeA.emit('peer:connect', nodeB.peerInfo)

      function startComplete () {
        // Check that only one dial was made
        setTimeout(() => {
          expect(gsA._onDial).to.have.been.called.once()
          done()
        }, 1000)
      }
    })
  })

  describe('allow dials even after error', () => {
    let sandbox
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      sandbox = chai.spy.sandbox()

      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) return done(err)

        nodeA = nodes[0]
        nodeB = nodes[1]

        // Put node B in node A's peer book
        nodeA.peerBook.put(nodeB.peerInfo)

        gsA = new GossipSub(nodeA)
        gsB = new GossipSub(nodeB)

        gsB.start(done)
      })
    })

    after((done) => {
      sandbox.restore()

      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], (ignoreErr) => {
        done()
      })
    })

    it('can dial again after error', (done) => {
      let firstTime = true
      const dialProtocol = gsA.libp2p.dialProtocol.bind(gsA.libp2p)
      sandbox.on(gsA.libp2p, 'dialProtocol', (peerInfo, multicodec, cb) => {
        // Return an error for the first dial
        if (firstTime) {
          firstTime = false
          return cb(new Error('dial error'))
        }

        // Subsequent dials proceed as normal
        dialProtocol(peerInfo, multicodec, cb)
      })

      // When node A starts, it will dial all peers in its peer book, which
      // is just peer B
      gsA.start(startComplete)

      function startComplete () {
        // Simulate a connection coming in from peer B. This causes gossipsub
        // to dial peer B
        nodeA.emit('peer:connect', nodeB.peerInfo)

        // Check that both dials were made
        setTimeout(() => {
          expect(gsA.libp2p.dialProtocol).to.have.been.called.twice()
          done()
        }, 1000)
      }
    })
  })

  describe('prevent processing dial after stop', () => {
    let sandbox
    let nodeA
    let nodeB
    let gsA
    let gsB

    before((done) => {
      sandbox = chai.spy.sandbox()

      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) return done(err)

        nodeA = nodes[0]
        nodeB = nodes[1]

        gsA = new GossipSub(nodeA)
        gsB = new GossipSub(nodeB)

        parallel([
          (cb) => gsA.start(cb),
          (cb) => gsB.start(cb)
        ], done)
      })
    })

    after((done) => {
      sandbox.restore()

      parallel([
        (cb) => nodeA.stop(cb),
        (cb) => nodeB.stop(cb)
      ], (ignoreErr) => {
        done()
      })
    })

    it('does not process dial after stop', (done) => {
      sandbox.on(gsA, ['_onDial'])

      // Simulate a connection coming in from peer B at the same time. This
      // causes gossipsub to dial peer B
      nodeA.emit('peer:connect', nodeB.peerInfo)

      // Stop gossipsub before the dial can complete
      gsA.stop(() => {
        // Check that the dial was not processed
        setTimeout(() => {
          expect(gsA._onDial).to.not.have.been.called()
          done()
        }, 1000)
      })
    })
  })
})

function shouldNotHappen (msg) {
  expect.fail()
}

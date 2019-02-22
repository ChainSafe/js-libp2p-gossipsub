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
const FloodSub  = require('libp2p-floodsub')
const Pubsub = require('libp2p-pubsub')
const utils = require('./utils')
const first = utils.first
const createNode = utils.createNode
const expectSet = utils.expectSet

describe('basics between 2 nodes', () => {
  describe('fresh nodes', () => {
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB
    let floodNodeA
    let floodNodeB
    let fsA
    let fsB

    before((done) => {
      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
	(cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
	(cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) {
          return done(err)
        }
        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]
	floodNodeA = nodes[2]
	floodNodeB = nodes[3]
        done()
      })
    })

    after((done) => {
      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb),
        (cb) => floodNodeA.stop(cb),
	(cb) => floodNodeB.stop(cb)
      ], done)
    })

    it('Mount the Gossipsub protocol and Floodsub protocol', (done) => {
      gsA = new GossipSub(gossipNodeA)
      gsB = new GossipSub(gossipNodeB)
      fsA = new FloodSub(floodNodeA)
      fsB = new FloodSub(floodNodeB)

      setTimeout(() => {
	expect(gsA.peers.size).to.be.eql(0)
	expect(gsA.mesh.size).to.be.eql(0)
	expect(gsA.fanout.size).to.be.eql(0)
	expect(gsA.lastpub.size).to.be.eql(0)

	expect(gsB.peers.size).to.be.eql(0)
	expect(gsB.mesh.size).to.be.eql(0)
	expect(gsB.fanout.size).to.be.eql(0)
	expect(gsB.lastpub.size).to.be.eql(0)

        expect(fsA.peers.size).to.be.eql(0)
        expect(fsA.subscriptions.size).to.eql(0)

        expect(fsB.peers.size).to.be.eql(0)
        expect(fsB.subscriptions.size).to.eql(0)
        done()
      }, 50)
    })

    it('start both GossipSubs and FloodSubs', (done) => {
      parallel([
	(cb) => gsA.start(cb),
	(cb) => gsB.start(cb),
        (cb) => fsA.start(cb),
        (cb) => fsB.start(cb)
      ], done)
    })

    it('Dial gossipNodeA into gossipNodeB', (done) => {
      series([
        (cb) => gossipNodeA.dial(gossipNodeB.peerInfo, cb),
        (cb) => setTimeout(() => {
          expect(gsA.peers.size).to.equal(1)
          expect(gsB.peers.size).to.equal(1)
          cb()
        }, 1000)
      ], done)
    })

    it('Dial floodNodeA into floodNodeB', (done) => {
      series([
        (cb) => floodNodeA.dial(floodNodeB.peerInfo, cb),
	(cb) => setTimeout(() => {
	   expect(fsA.peers.size).to.equal(1)
           expect(fsB.peers.size).to.equal(1)
           cb()
	}, 1000)
      ], done)
    })

   it('Dial gossipNodeA into floodNodeA', (done) => {
     series([
       (cb) => gossipNodeA.dial(floodNodeB.peerInfo, cb),
       (cb) => setTimeout(() => {
           expect(gsA.peers.size).to.equal(1)
	   expect(fsA.peers.size).to.equal(1)
       }, 1000)
     ], done)
   })

    it('Subscribe to a topic:Z in gossipNodeA', (done) => {
      gsA.subscribe('Z')
      gsB.once('meshsub:subscription-change', (changedPeerInfo, changedTopics, changedSubs) => {
        expectSet(gsA.mesh, ['Z'])
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
        fsB.removeListener('Z', shouldNotHappen)
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
        expect(msg.from).to.be.eql(fsB.libp2p.peerInfo.id.toB58String())
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
        expect(msg.from).to.be.eql(fsB.libp2p.peerInfo.id.toB58String())
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
      expect(fsA.subscriptions.size).to.equal(0)

      gsB.once('floodsub:subscription-change', (changedPeerInfo, changedTopics, changedSubs) => {
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

    it('stop both GossipSubs and FloodSubs', (done) => {
      parallel([
	(cb) => gsA.stop(cb),
	(cb) => gsB.stop(cb),
        (cb) => fsA.stop(cb),
        (cb) => fsB.stop(cb)
      ], done)
    })
  })

/*
  describe('nodes send state on connection', () => {
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB

    before((done) => {
      parallel([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()

        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]

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
          expectSet(gsA.mesh, ['Za'])
          expect(gsB.peers.size).to.equal(0)
          expectSet(gsB.subscriptions, ['Zb'])
          done()
        }
      })
    })

    after((done) => {
      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb)
      ], done)
    })

    it('existing subscriptions are sent upon peer connection', (done) => {
      parallel([
        cb => gsA.once('meshsub:subscription-change', () => cb()),
        cb => gsB.once('meshsub:subscription-change', () => cb())
      ], () => {
        expect(gsA.peers.size).to.equal(1)
        expect(gsB.peers.size).to.equal(1)

        expectSet(gsA.mesh, ['Za'])
        expect(gsB.peers.size).to.equal(1)
        expectSet(first(gsB.peers).topics, ['Za'])

        expectSet(gsB.mesh, ['Zb'])
        expect(gsA.peers.size).to.equal(1)
        expectSet(first(gsA.peers).topics, ['Zb'])

        done()
      })

      gossipNodeA.dial(gossipNodeB.peerInfo, (err) => {
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
*/
/*
  describe('nodes handle connection errors', () => {
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB

    before((done) => {
      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (cb, nodes) => {
        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]

        gsA = new GossipSub(gossipNodeA)
        gsB = new GossipSub(gossipNodeB)

        parallel([
          (cb) => gsA.start(cb),
          (cb) => gsB.start(cb)
        ], next)

        function next () {
          gsA.subscribe('Za')
          gsB.subscribe('Zb')

          expect(gsA.peers.size).to.equal(0)
          expectSet(gsA.mesh, ['Za'])
          expect(gsB.peers.size).to.equal(0)
          expectSet(gsB.subscriptions, ['Zb'])
          done()
        }
      })
    })

    // TODO understand why this test is failing
    it.skip('peer is removed from the state when connection ends', (done) => {
      nodeA.dial(nodeB.peerInfo, (err) => {
        expect(err).to.not.exist()
        setTimeout(() => {
          expect(first(fsA.peers)._references).to.equal(2)
          expect(first(fsB.peers)._references).to.equal(2)

          fsA.stop(() => setTimeout(() => {
            expect(first(fsB.peers)._references).to.equal(1)
            done()
          }, 1000))
        }, 1000)
      })
    })
    
    it('stop one node', (done) => {
      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb)
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
*/
/*
  describe('dial the pubsub protocol on mount', () => {
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB

    before((done) => {
      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (cb, nodes) => {
        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]
        gossipNodeA.dial(gossipNodeB.peerInfo, () => setTimeout(done, 1000))
      })
    })

    after((done) => {
      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb)
      ], done)
    })

    it('dial on gossipsub on mount', (done) => {
      gsA = new GossipSub(gossipNodeA)
      gsB = new GossipSub(gossipNodeB)

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
*/
/*
  describe('prevent concurrent dials', () => {
    let sandbox
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB

    before((done) => {
      sandbox = chai.spy.sandbox()

      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) return done(err)

        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]

        // Put node B in node A's peer book
        gossipNodeA.peerBook.put(gossipNodeB.peerInfo)

        gsA = new GossipSub(gossipNodeA)
        gsB = new GossipSub(gossipNodeB)

        gsB.start(done)
      })
    })

    after((done) => {
      sandbox.restore()

      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb)
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
      // causes floodsub to dial peer B
      gossipNodeA.emit('peer:connect', gossipNodeB.peerInfo)

      function startComplete () {
        // Check that only one dial was made
        setTimeout(() => {
          expect(gsA._onDial).to.have.been.called.once()
          done()
        }, 1000)
      }
    })
  })
*/
/*
  describe('allow dials even after error', () => {
    let sandbox
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB

    before((done) => {
      sandbox = chai.spy.sandbox()

      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) return done(err)

        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]

        // Put node B in node A's peer book
        gossipNodeA.peerBook.put(gossipNodeB.peerInfo)

        gsA = new GossipSub(gossipNodeA)
        gsB = new GossipSub(gossipNodeB)

        gsB.start(done)
      })
    })

    after((done) => {
      sandbox.restore()

      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb)
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
        // Simulate a connection coming in from peer B. This causes floodsub
        // to dial peer B
        gossipNodeA.emit('peer:connect', gossipNodeB.peerInfo)

        // Check that both dials were made
        setTimeout(() => {
          expect(gsA.libp2p.dialProtocol).to.have.been.called.twice()
          done()
        }, 1000)
      }
    })
  })
*/
/*
  describe('prevent processing dial after stop', () => {
    let sandbox
    let gossipNodeA
    let gossipNodeB
    let gsA
    let gsB

    before((done) => {
      sandbox = chai.spy.sandbox()

      series([
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb),
        (cb) => createNode('/ip4/127.0.0.1/tcp/0', cb)
      ], (err, nodes) => {
        if (err) return done(err)

        gossipNodeA = nodes[0]
        gossipNodeB = nodes[1]

        gsA = new GossipSub(gossipNodeA)
        gsB = new GossipSub(gossipNodeB)

        parallel([
          (cb) => gsA.start(cb),
          (cb) => gsB.start(cb)
        ], done)
      })
    })

    after((done) => {
      sandbox.restore()

      parallel([
        (cb) => gossipNodeA.stop(cb),
        (cb) => gossipNodeB.stop(cb)
      ], (ignoreErr) => {
        done()
      })
    })

    it('does not process dial after stop', (done) => {
      sandbox.on(gsA, ['_onDial'])

      // Simulate a connection coming in from peer B at the same time. This
      // causes gossipsub to dial peer B
      gossipNodeA.emit('peer:connect', gossipNodeB.peerInfo)

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
  */
})

function shouldNotHappen (msg) {
  expect.fail()
}

/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 8] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const promisify = require('promisify-es6')

const {
  createNode,
  expectSet,
  dialNode,
  startNode,
  stopNode
} = require('./utils')

describe('multiple nodes (more than 2)', () => {
  describe('every peer subscribes to the topic', () => {
    describe('line', () => {
      // line
      // ◉────◉────◉
      // a    b    c
      describe('subscribe', () => {
        let a
        let b
        let c
        const topic = 'Z'

        beforeEach(async () => {
          a = await createNode('/ip4/127.0.0.1/tcp/0')
          b = await createNode('/ip4/127.0.0.1/tcp/0')
          c = await createNode('/ip4/127.0.0.1/tcp/0')
          await Promise.all([
            startNode(a),
            startNode(b),
            startNode(c)
          ])
          await Promise.all([
            startNode(a.gs),
            startNode(b.gs),
            startNode(c.gs)
          ])
          await dialNode(a, b.peerInfo)
          await dialNode(b, c.peerInfo)
        })

        afterEach(async function () {
          this.timeout(4000)
          await Promise.all([
            stopNode(a.gs),
            stopNode(b.gs),
            stopNode(c.gs)
          ])
          await Promise.all([
            stopNode(a),
            stopNode(b),
            stopNode(c)
          ])
        })

        it('subscribe to the topic on all nodes', async () => {
          a.gs.subscribe(topic)
          b.gs.subscribe(topic)
          c.gs.subscribe(topic)

          expectSet(a.gs.subscriptions, [topic])
          expectSet(b.gs.subscriptions, [topic])
          expectSet(c.gs.subscriptions, [topic])

          await Promise.all([
            promisify(a.gs.once.bind(a.gs))('gossipsub:heartbeat'),
            promisify(b.gs.once.bind(b.gs))('gossipsub:heartbeat'),
            promisify(c.gs.once.bind(c.gs))('gossipsub:heartbeat')
          ])

          expect(a.gs.peers.size).to.equal(1)
          expect(b.gs.peers.size).to.equal(2)
          expect(c.gs.peers.size).to.equal(1)

          const aPeerId = a.peerInfo.id.toB58String()
          const bPeerId = b.peerInfo.id.toB58String()
          const cPeerId = c.peerInfo.id.toB58String()

          expectSet(a.gs.peers.get(bPeerId).topics, [topic])
          expectSet(b.gs.peers.get(aPeerId).topics, [topic])
          expectSet(b.gs.peers.get(cPeerId).topics, [topic])
          expectSet(c.gs.peers.get(bPeerId).topics, [topic])

          expect(a.gs.mesh.get(topic).size).to.equal(1)
          expect(b.gs.mesh.get(topic).size).to.equal(2)
          expect(c.gs.mesh.get(topic).size).to.equal(1)
        })
      })

      describe('publish', () => {
        let a
        let b
        let c
        const topic = 'Z'

        beforeEach(async () => {
          a = await createNode('/ip4/127.0.0.1/tcp/0')
          b = await createNode('/ip4/127.0.0.1/tcp/0')
          c = await createNode('/ip4/127.0.0.1/tcp/0')
          await Promise.all([
            startNode(a),
            startNode(b),
            startNode(c)
          ])
          await Promise.all([
            startNode(a.gs),
            startNode(b.gs),
            startNode(c.gs)
          ])
          await dialNode(a, b.peerInfo)
          await dialNode(b, c.peerInfo)

          a.gs.subscribe(topic)
          b.gs.subscribe(topic)
          c.gs.subscribe(topic)

          await Promise.all([
            promisify(a.gs.once.bind(a.gs))('gossipsub:heartbeat'),
            promisify(b.gs.once.bind(b.gs))('gossipsub:heartbeat'),
            promisify(c.gs.once.bind(c.gs))('gossipsub:heartbeat')
          ])
        })

        afterEach(async function () {
          this.timeout(4000)
          await Promise.all([
            stopNode(a.gs),
            stopNode(b.gs),
            stopNode(c.gs)
          ])
          await Promise.all([
            stopNode(a),
            stopNode(b),
            stopNode(c)
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
      })
    })

    describe('1 level tree', () => {
      // 1 level tree
      //     ┌◉┐
      //     │b│
      //   ◉─┘ └─◉
      //   a     c

      let a
      let b
      let c
      const topic = 'Z'

      beforeEach(async () => {
        a = await createNode('/ip4/127.0.0.1/tcp/0')
        b = await createNode('/ip4/127.0.0.1/tcp/0')
        c = await createNode('/ip4/127.0.0.1/tcp/0')
        await Promise.all([
          startNode(a),
          startNode(b),
          startNode(c)
        ])
        await Promise.all([
          startNode(a.gs),
          startNode(b.gs),
          startNode(c.gs)
        ])
        await dialNode(a, b.peerInfo)
        await dialNode(b, c.peerInfo)

        a.gs.subscribe(topic)
        b.gs.subscribe(topic)
        c.gs.subscribe(topic)

        await Promise.all([
          promisify(a.gs.once.bind(a.gs))('gossipsub:heartbeat'),
          promisify(b.gs.once.bind(b.gs))('gossipsub:heartbeat'),
          promisify(c.gs.once.bind(c.gs))('gossipsub:heartbeat')
        ])
      })

      afterEach(async function () {
        this.timeout(4000)
        await Promise.all([
          stopNode(a.gs),
          stopNode(b.gs),
          stopNode(c.gs)
        ])
        await Promise.all([
          stopNode(a),
          stopNode(b),
          stopNode(c)
        ])
      })

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
      const topic = 'Z'

      beforeEach(async function () {
        this.timeout(5000)
        a = await createNode('/ip4/127.0.0.1/tcp/0')
        b = await createNode('/ip4/127.0.0.1/tcp/0')
        c = await createNode('/ip4/127.0.0.1/tcp/0')
        d = await createNode('/ip4/127.0.0.1/tcp/0')
        e = await createNode('/ip4/127.0.0.1/tcp/0')
        await Promise.all([
          startNode(a),
          startNode(b),
          startNode(c),
          startNode(d),
          startNode(e)
        ])
        await Promise.all([
          startNode(a.gs),
          startNode(b.gs),
          startNode(c.gs),
          startNode(d.gs),
          startNode(e.gs)
        ])
        await dialNode(a, b.peerInfo)
        await dialNode(b, c.peerInfo)
        await dialNode(c, d.peerInfo)
        await dialNode(d, e.peerInfo)

        await new Promise((resolve) => setTimeout(resolve, 500))

        a.gs.subscribe(topic)
        b.gs.subscribe(topic)
        c.gs.subscribe(topic)
        d.gs.subscribe(topic)
        e.gs.subscribe(topic)

        await Promise.all([
          promisify(a.gs.once.bind(a.gs))('gossipsub:heartbeat'),
          promisify(b.gs.once.bind(b.gs))('gossipsub:heartbeat'),
          promisify(c.gs.once.bind(c.gs))('gossipsub:heartbeat'),
          promisify(d.gs.once.bind(c.gs))('gossipsub:heartbeat'),
          promisify(e.gs.once.bind(c.gs))('gossipsub:heartbeat')
        ])
      })

      afterEach(async function () {
        this.timeout(4000)
        await Promise.all([
          stopNode(a.gs),
          stopNode(b.gs),
          stopNode(c.gs),
          stopNode(d.gs),
          stopNode(e.gs)
        ])
        await Promise.all([
          stopNode(a),
          stopNode(b),
          stopNode(c),
          stopNode(d),
          stopNode(e)
        ])
      })

      it('publishes from c', async () => {
        let msgA = new Promise((resolve) => a.gs.once('Z', resolve))
        let msgB = new Promise((resolve) => b.gs.once('Z', resolve))
        let msgD = new Promise((resolve) => d.gs.once('Z', resolve))
        let msgE = new Promise((resolve) => e.gs.once('Z', resolve))

        const msg = 'hey from c'
        c.gs.publish('Z', Buffer.from(msg))

        msgA = await msgA
        msgB = await msgB
        msgD = await msgD
        msgE = await msgE

        expect(msgA.data.toString()).to.equal(msg)
        expect(msgB.data.toString()).to.equal(msg)
        expect(msgD.data.toString()).to.equal(msg)
        expect(msgE.data.toString()).to.equal(msg)
      })
    })
  })
})

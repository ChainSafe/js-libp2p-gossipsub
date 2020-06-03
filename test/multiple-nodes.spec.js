/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 8] */
'use strict'
const { Buffer } = require('buffer')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const promisify = require('promisify-es6')

const { GossipSubID: multicodec } = require('../src/constants')
const {
  createGossipsubNodes,
  expectSet,
  ConnectionPair
} = require('./utils')

describe('multiple nodes (more than 2)', () => {
  describe('every peer subscribes to the topic', () => {
    describe('line', () => {
      // line
      // ◉────◉────◉
      // a    b    c
      describe('subscribe', () => {
        let a, b, c, nodes, registrarRecords
        const topic = 'Z'

        // Create pubsub nodes
        before(async () => {
          ({
            nodes,
            registrarRecords
          } = await createGossipsubNodes(3, true))

          a = nodes[0]
          b = nodes[1]
          c = nodes[2]

          const onConnectA = registrarRecords[0][multicodec].onConnect
          const onConnectB = registrarRecords[1][multicodec].onConnect
          const onConnectC = registrarRecords[2][multicodec].onConnect
          const handleA = registrarRecords[0][multicodec].handler
          const handleB = registrarRecords[1][multicodec].handler
          const handleC = registrarRecords[2][multicodec].handler

          // Notice peers of connection
          const [d0, d1] = ConnectionPair()
          await onConnectA(b.peerId, d0)
          await handleB({
            protocol: multicodec,
            stream: d1.stream,
            connection: {
              remotePeer: a.peerId
            }
          })
          await onConnectB(a.peerId, d1)
          await handleA({
            protocol: multicodec,
            stream: d0.stream,
            connection: {
              remotePeer: b.peerId
            }
          })

          const [d2, d3] = ConnectionPair()
          await onConnectB(c.peerId, d2)
          await handleC({
            protocol: multicodec,
            stream: d3.stream,
            connection: {
              remotePeer: b.peerId
            }
          })
          await onConnectC(b.peerId, d3)
          await handleB({
            protocol: multicodec,
            stream: d2.stream,
            connection: {
              remotePeer: c.peerId
            }
          })
        })

        after(() => Promise.all(nodes.map((n) => n.stop())))

        it('subscribe to the topic on all nodes', async () => {
          a.subscribe(topic)
          b.subscribe(topic)
          c.subscribe(topic)

          expectSet(a.subscriptions, [topic])
          expectSet(b.subscriptions, [topic])
          expectSet(c.subscriptions, [topic])

          await Promise.all([
            promisify(a.once.bind(a))('gossipsub:heartbeat'),
            promisify(b.once.bind(b))('gossipsub:heartbeat'),
            promisify(c.once.bind(c))('gossipsub:heartbeat')
          ])

          expect(a.peers.size).to.equal(1)
          expect(b.peers.size).to.equal(2)
          expect(c.peers.size).to.equal(1)

          const aPeerId = a.peerId.toB58String()
          const bPeerId = b.peerId.toB58String()
          const cPeerId = c.peerId.toB58String()

          expectSet(a.peers.get(bPeerId).topics, [topic])
          expectSet(b.peers.get(aPeerId).topics, [topic])
          expectSet(b.peers.get(cPeerId).topics, [topic])
          expectSet(c.peers.get(bPeerId).topics, [topic])

          expect(a.mesh.get(topic).size).to.equal(1)
          expect(b.mesh.get(topic).size).to.equal(2)
          expect(c.mesh.get(topic).size).to.equal(1)
        })
      })

      describe('publish', () => {
        let a, b, c, nodes, registrarRecords
        const topic = 'Z'

        // Create pubsub nodes
        before(async () => {
          ({
            nodes,
            registrarRecords
          } = await createGossipsubNodes(3, true))

          a = nodes[0]
          b = nodes[1]
          c = nodes[2]

          const onConnectA = registrarRecords[0][multicodec].onConnect
          const onConnectB = registrarRecords[1][multicodec].onConnect
          const onConnectC = registrarRecords[2][multicodec].onConnect
          const handleA = registrarRecords[0][multicodec].handler
          const handleB = registrarRecords[1][multicodec].handler
          const handleC = registrarRecords[2][multicodec].handler

          // Notice peers of connection
          const [d0, d1] = ConnectionPair()
          await onConnectA(b.peerId, d0)
          await handleB({
            protocol: multicodec,
            stream: d1.stream,
            connection: {
              remotePeer: a.peerId
            }
          })
          await onConnectB(a.peerId, d1)
          await handleA({
            protocol: multicodec,
            stream: d0.stream,
            connection: {
              remotePeer: b.peerId
            }
          })

          const [d2, d3] = ConnectionPair()
          await onConnectB(c.peerId, d2)
          await handleC({
            protocol: multicodec,
            stream: d3.stream,
            connection: {
              remotePeer: b.peerId
            }
          })
          await onConnectC(b.peerId, d3)
          await handleB({
            protocol: multicodec,
            stream: d2.stream,
            connection: {
              remotePeer: c.peerId
            }
          })

          a.subscribe(topic)
          b.subscribe(topic)
          c.subscribe(topic)

          await Promise.all([
            promisify(a.once.bind(a))('gossipsub:heartbeat'),
            promisify(b.once.bind(b))('gossipsub:heartbeat'),
            promisify(c.once.bind(c))('gossipsub:heartbeat')
          ])
        })

        after(() => Promise.all(nodes.map((n) => n.stop())))

        it('publish on node a', async () => {
          let msgB = new Promise((resolve) => b.once('Z', resolve))
          let msgC = new Promise((resolve) => c.once('Z', resolve))

          a.publish('Z', Buffer.from('hey'))
          msgB = await msgB
          msgC = await msgC

          expect(msgB.data.toString()).to.equal('hey')
          expect(msgC.data.toString()).to.equal('hey')
        })

        it('publish array on node a', async () => {
          let msgB = new Promise((resolve) => {
            const output = []
            b.on('Z', (msg) => {
              output.push(msg)
              if (output.length === 2) {
                b.removeAllListeners('Z')
                resolve(output)
              }
            })
          })
          let msgC = new Promise((resolve) => {
            const output = []
            c.on('Z', (msg) => {
              output.push(msg)
              if (output.length === 2) {
                c.removeAllListeners('Z')
                resolve(output)
              }
            })
          })

          a.publish('Z', [Buffer.from('hey'), Buffer.from('hey')])
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

      let a, b, c, nodes, registrarRecords
      const topic = 'Z'

      // Create pubsub nodes
      before(async () => {
        ({
          nodes,
          registrarRecords
        } = await createGossipsubNodes(3, true))

        a = nodes[0]
        b = nodes[1]
        c = nodes[2]

        const onConnectA = registrarRecords[0][multicodec].onConnect
        const onConnectB = registrarRecords[1][multicodec].onConnect
        const onConnectC = registrarRecords[2][multicodec].onConnect
        const handleA = registrarRecords[0][multicodec].handler
        const handleB = registrarRecords[1][multicodec].handler
        const handleC = registrarRecords[2][multicodec].handler

        // Notice peers of connection
        const [d0, d1] = ConnectionPair()
        await onConnectA(b.peerId, d0)
        await handleB({
          protocol: multicodec,
          stream: d1.stream,
          connection: {
            remotePeer: a.peerId
          }
        })
        await onConnectB(a.peerId, d1)
        await handleA({
          protocol: multicodec,
          stream: d0.stream,
          connection: {
            remotePeer: b.peerId
          }
        })

        const [d2, d3] = ConnectionPair()
        await onConnectB(c.peerId, d2)
        await handleC({
          protocol: multicodec,
          stream: d3.stream,
          connection: {
            remotePeer: b.peerId
          }
        })
        await onConnectC(b.peerId, d3)
        await handleB({
          protocol: multicodec,
          stream: d2.stream,
          connection: {
            remotePeer: c.peerId
          }
        })

        a.subscribe(topic)
        b.subscribe(topic)
        c.subscribe(topic)

        await Promise.all([
          promisify(a.once.bind(a))('gossipsub:heartbeat'),
          promisify(b.once.bind(b))('gossipsub:heartbeat'),
          promisify(c.once.bind(c))('gossipsub:heartbeat')
        ])
      })

      after(() => Promise.all(nodes.map((n) => n.stop())))

      it('publish on node b', async () => {
        let msgA = new Promise((resolve) => a.once('Z', resolve))
        let msgC = new Promise((resolve) => c.once('Z', resolve))

        b.publish('Z', Buffer.from('hey'))
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
      let a, b, c, d, e, nodes, registrarRecords
      const topic = 'Z'

      // Create pubsub nodes
      before(async () => {
        ({
          nodes,
          registrarRecords
        } = await createGossipsubNodes(5, true))

        a = nodes[0]
        b = nodes[1]
        c = nodes[2]
        d = nodes[3]
        e = nodes[4]

        const onConnectA = registrarRecords[0][multicodec].onConnect
        const onConnectB = registrarRecords[1][multicodec].onConnect
        const onConnectC = registrarRecords[2][multicodec].onConnect
        const onConnectD = registrarRecords[3][multicodec].onConnect
        const onConnectE = registrarRecords[4][multicodec].onConnect

        const handleA = registrarRecords[0][multicodec].handler
        const handleB = registrarRecords[1][multicodec].handler
        const handleC = registrarRecords[2][multicodec].handler
        const handleD = registrarRecords[3][multicodec].handler
        const handleE = registrarRecords[4][multicodec].handler

        // Notice peers of connection
        const [d0, d1] = ConnectionPair()
        await onConnectA(b.peerId, d0)
        await handleB({
          protocol: multicodec,
          stream: d1.stream,
          connection: {
            remotePeer: a.peerId
          }
        })
        await onConnectB(a.peerId, d1)
        await handleA({
          protocol: multicodec,
          stream: d0.stream,
          connection: {
            remotePeer: b.peerId
          }
        })

        const [d2, d3] = ConnectionPair()
        await onConnectB(c.peerId, d2)
        await handleC({
          protocol: multicodec,
          stream: d3.stream,
          connection: {
            remotePeer: b.peerId
          }
        })
        await onConnectC(b.peerId, d3)
        await handleB({
          protocol: multicodec,
          stream: d2.stream,
          connection: {
            remotePeer: c.peerId
          }
        })

        const [d4, d5] = ConnectionPair()
        await onConnectC(d.peerId, d4)
        await handleD({
          protocol: multicodec,
          stream: d5.stream,
          connection: {
            remotePeer: c.peerId
          }
        })
        await onConnectD(c.peerId, d5)
        await handleC({
          protocol: multicodec,
          stream: d4.stream,
          connection: {
            remotePeer: d.peerId
          }
        })

        const [d6, d7] = ConnectionPair()
        await onConnectD(e.peerId, d6)
        await handleE({
          protocol: multicodec,
          stream: d7.stream,
          connection: {
            remotePeer: d.peerId
          }
        })
        await onConnectE(d.peerId, d7)
        await handleD({
          protocol: multicodec,
          stream: d6.stream,
          connection: {
            remotePeer: e.peerId
          }
        })

        a.subscribe(topic)
        b.subscribe(topic)
        c.subscribe(topic)
        d.subscribe(topic)
        e.subscribe(topic)

        await Promise.all([
          promisify(a.once.bind(a))('gossipsub:heartbeat'),
          promisify(b.once.bind(b))('gossipsub:heartbeat'),
          promisify(c.once.bind(c))('gossipsub:heartbeat'),
          promisify(d.once.bind(d))('gossipsub:heartbeat'),
          promisify(e.once.bind(e))('gossipsub:heartbeat')
        ])
      })

      after(() => Promise.all(nodes.map((n) => n.stop())))

      it('publishes from c', async () => {
        let msgA = new Promise((resolve) => a.once('Z', resolve))
        let msgB = new Promise((resolve) => b.once('Z', resolve))
        let msgD = new Promise((resolve) => d.once('Z', resolve))
        let msgE = new Promise((resolve) => e.once('Z', resolve))

        const msg = 'hey from c'
        c.publish('Z', Buffer.from(msg))

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

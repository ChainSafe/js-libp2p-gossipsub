/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect

const {
  createNode,
  startNode,
  stopNode
} = require('./utils')

const shouldNotHappen = (_) => expect.fail()

// Emit to the node itself
describe('emit self', () => {
  const topic = 'Z'

  describe('enabled', () => {
    let nodeA

    before(async () => {
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0', { emitSelf: true })
      await startNode(nodeA)
      await startNode(nodeA.gs)

      nodeA.gs.subscribe(topic)
    })

    after(async function () {
      if (nodeA.gs.started) {
        await stopNode(nodeA.gs)
      }
      await stopNode(nodeA)
    })

    it('should emit to self on publish', async () => {
      const promise = new Promise((resolve) => nodeA.gs.once(topic, resolve))

      nodeA.gs.publish(topic, Buffer.from('hey'))

      await promise
    })
  })

  describe('disabled', () => {
    let nodeA

    before(async () => {
      nodeA = await createNode('/ip4/127.0.0.1/tcp/0', { emitSelf: false })
      await startNode(nodeA)
      await startNode(nodeA.gs)

      nodeA.gs.subscribe(topic)
    })

    after(async function () {
      if (nodeA.gs.started) {
        await stopNode(nodeA.gs)
      }
      await stopNode(nodeA)
    })

    it('should emit to self on publish', async () => {
      nodeA.gs.once(topic, (m) => shouldNotHappen)

      nodeA.gs.publish(topic, Buffer.from('hey'))

      // Wait 1 second to guarantee that self is not noticed
      await new Promise((resolve) => setTimeout(() => resolve(), 1000))
    })
  })
})

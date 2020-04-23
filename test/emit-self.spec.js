/* eslint-env mocha */
'use strict'
const { Buffer } = require('buffer')
const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-spies'))
const expect = chai.expect

const {
  createGossipsub,
  mockRegistrar
} = require('./utils')

const shouldNotHappen = (_) => expect.fail()

// Emit to the node itself
describe('emit self', () => {
  let gossipsub
  const topic = 'Z'

  describe('enabled', () => {
    before(async () => {
      gossipsub = await createGossipsub(mockRegistrar, true, { emitSelf: true })
      gossipsub.subscribe(topic)
    })

    after(() => gossipsub.stop())

    it('should emit to self on publish', async () => {
      const promise = new Promise((resolve) => gossipsub.once(topic, resolve))

      gossipsub.publish(topic, Buffer.from('hey'))

      await promise
    })
  })

  describe('disabled', () => {
    before(async () => {
      gossipsub = await createGossipsub(mockRegistrar, true, { emitSelf: false })
      gossipsub.subscribe(topic)
    })

    after(() => gossipsub.stop())

    it('should emit to self on publish', async () => {
      gossipsub.once(topic, (m) => shouldNotHappen)

      gossipsub.publish(topic, Buffer.from('hey'))

      // Wait 1 second to guarantee that self is not noticed
      await new Promise((resolve) => setTimeout(() => resolve(), 1000))
    })
  })
})

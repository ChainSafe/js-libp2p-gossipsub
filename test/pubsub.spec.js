'use strict'
/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
const { Buffer } = require('buffer')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const sinon = require('sinon')
const pWaitFor = require('p-wait-for')

const { utils } = require('libp2p-pubsub')
const {
  createGossipsub,
  createPeerId,
  mockRegistrar
} = require('./utils')

describe('Pubsub', () => {
  let gossipsub

  before(async () => {
    gossipsub = await createGossipsub(mockRegistrar, true)
  })

  after(() => gossipsub.stop())

  afterEach(() => {
    sinon.restore()
  })

  describe('publish', () => {
    it('should sign messages on publish', async () => {
      sinon.spy(gossipsub, '_publish')

      await gossipsub.publish('signing-topic', Buffer.from('hello'))

      // Get the first message sent to _publish, and validate it
      const signedMessage = gossipsub._publish.getCall(0).lastArg[0]
      const isValid = await gossipsub.validate({}, signedMessage)

      expect(isValid).to.eql(true)
    })
  })

  describe('validate', () => {
    it('should drop unsigned messages', () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const rpc = {
        subscriptions: [],
        msgs: [{
          from: gossipsub.peerId.id,
          data: Buffer.from('an unsigned message'),
          seqno: utils.randomSeqno(),
          topicIDs: [topic]
        }]
      }

      gossipsub._processRpc('QmAnotherPeer', {}, rpc)

      return new Promise(resolve => setTimeout(() => {
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(gossipsub._processRpcMessage.called).to.eql(false)
        resolve()
      }, 500))
    })

    it('should not drop signed messages', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const signedMessage = await gossipsub._buildMessage({
        from: gossipsub.peerId.id,
        data: Buffer.from('an unsigned message'),
        seqno: utils.randomSeqno(),
        topicIDs: [topic]
      })

      const rpc = {
        subscriptions: [],
        msgs: [signedMessage]
      }

      gossipsub._processRpc('QmAnotherPeer', {}, rpc)

      return new Promise(resolve => setTimeout(() => {
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(gossipsub._processRpcMessage.callCount).to.eql(1)
        resolve()
      }, 500))
    })

    it('should not drop unsigned messages if strict signing is disabled', () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.stub(gossipsub.peers, 'get').returns({})
      // Disable strict signing
      sinon.stub(gossipsub, 'strictSigning').value(false)

      const topic = 'my-topic'
      const rpc = {
        subscriptions: [],
        msgs: [{
          from: gossipsub.peerId.id,
          data: Buffer.from('an unsigned message'),
          seqno: utils.randomSeqno(),
          topicIDs: [topic]
        }]
      }

      gossipsub._processRpc('QmAnotherPeer', {}, rpc)

      return new Promise(resolve => setTimeout(() => {
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(gossipsub._processRpcMessage.callCount).to.eql(1)
        resolve()
      }, 500))
    })
  })

  describe('process', () => {
    it('should disconnect peer on stream error', async () => {
      sinon.spy(gossipsub, '_onPeerDisconnected')

      const peerId = await createPeerId()
      const mockConn = {
        newStream () {
          return {
            stream: {
              sink: async source => {
                for await (const _ of source) { // eslint-disable-line no-unused-vars
                  // mock stream just swallows any data sent
                }
              },
              source: (async function * () { // eslint-disable-line require-yield
                // throw in a bit
                await new Promise(resolve => setTimeout(resolve, 100))
                throw new Error('boom')
              })()
            }
          }
        }
      }

      gossipsub._onPeerConnected(peerId, mockConn)

      await pWaitFor(() => gossipsub._onPeerDisconnected.calledWith(peerId), { timeout: 1000 })
    })
  })

  describe('topic validators', () => {
    it('should filter messages by topic validator', async () => {
      // use processRpcMessage.callCount to see if a message is valid or not
      // a valid message will trigger processRpcMessage
      sinon.stub(gossipsub, '_processRpcMessage')
      // Disable strict signing
      sinon.stub(gossipsub, 'strictSigning').value(false)
      const filteredTopic = 't'
      const peerStr = 'QmAnotherPeer'
      gossipsub.peers.set(peerStr, {})

      // Set a trivial topic validator
      gossipsub.topicValidators.set(filteredTopic, (topic, peer, message) => {
        return message.data.equals(Buffer.from('a message'))
      })

      // valid case
      const validRpc = {
        subscriptions: [],
        msgs: [{
          from: gossipsub.peerId.id,
          data: Buffer.from('a message'),
          seqno: utils.randomSeqno(),
          topicIDs: [filteredTopic]
        }]
      }

      // process valid message
      gossipsub._processRpc(peerStr, {}, validRpc)
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(gossipsub._processRpcMessage.callCount).to.eql(1)

      // invalid case
      const invalidRpc = {
        subscriptions: [],
        msgs: [{
          from: gossipsub.peerId.id,
          data: Buffer.from('a different message'),
          seqno: utils.randomSeqno(),
          topicIDs: [filteredTopic]
        }]
      }

      // process invalid message
      gossipsub._processRpc(peerStr, {}, invalidRpc)
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(gossipsub._processRpcMessage.callCount).to.eql(1)

      // remove topic validator
      gossipsub.topicValidators.delete(filteredTopic)

      // another invalid case
      const invalidRpc2 = {
        subscriptions: [],
        msgs: [{
          from: gossipsub.peerId.id,
          data: Buffer.from('a different message'),
          seqno: utils.randomSeqno(),
          topicIDs: [filteredTopic]
        }]
      }

      // process previously invalid message, now is valid
      gossipsub._processRpc(peerStr, {}, invalidRpc2)
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(gossipsub._processRpcMessage.callCount).to.eql(2)
      // cleanup
      gossipsub.peers.delete(peerStr)
    })
  })
})

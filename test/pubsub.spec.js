'use strict'
/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
const { Buffer } = require('buffer')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const sinon = require('sinon')

const { utils } = require('libp2p-pubsub')
const Peer = require('libp2p-pubsub/src/peer')
const { signMessage } = require('libp2p-pubsub/src/message/sign')
const PeerId = require('peer-id')
const {
  createGossipsub,
  mockRegistrar,
  mockConnectionManager
} = require('./utils')

describe('Pubsub', () => {
  let gossipsub

  before(async () => {
    gossipsub = await createGossipsub(mockRegistrar, mockConnectionManager, true)
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
      const isValid = await gossipsub.validate(signedMessage)

      expect(isValid).to.eql(true)
    })
  })

  describe('validate', () => {
    it('should drop unsigned messages', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const peer = new Peer({ id: await PeerId.create() })
      const rpc = {
        subscriptions: [],
        msgs: [{
          from: peer.id.toBytes(),
          data: Buffer.from('an unsigned message'),
          seqno: utils.randomSeqno(),
          topicIDs: [topic]
        }]
      }

      gossipsub._processRpc(peer.id.toB58String(), peer, rpc)

      return new Promise(resolve => setTimeout(async () => {
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(await gossipsub.validate.getCall(0).returnValue).to.eql(false)
        resolve()
      }, 500))
    })

    it('should not drop signed messages', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const peer = new Peer({ id: await PeerId.create() })
      let signedMessage = {
        from: peer.id.toBytes(),
        data: Buffer.from('a signed message'),
        seqno: utils.randomSeqno(),
        topicIDs: [topic]
      }
      signedMessage = await signMessage(peer.id, signedMessage)

      const rpc = {
        subscriptions: [],
        msgs: [signedMessage]
      }

      gossipsub._processRpc(peer.id.toB58String(), peer, rpc)

      return new Promise(resolve => setTimeout(async () => {
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(await gossipsub.validate.getCall(0).returnValue).to.be.eql(true)
        resolve()
      }, 500))
    })

    it('should not drop unsigned messages if strict signing is disabled', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.stub(gossipsub.peers, 'get').returns({})
      // Disable strict signing
      sinon.stub(gossipsub, 'strictSigning').value(false)

      const topic = 'my-topic'
      const peer = new Peer({ id: await PeerId.create() })
      const rpc = {
        subscriptions: [],
        msgs: [{
          from: peer.id.toBytes(),
          data: Buffer.from('an unsigned message'),
          seqno: utils.randomSeqno(),
          topicIDs: [topic]
        }]
      }

      gossipsub._processRpc(peer.id.toB58String(), peer, rpc)

      return new Promise(resolve => setTimeout(async () => {
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(await gossipsub.validate.getCall(0).returnValue).to.eql(true)
        resolve()
      }, 500))
    })
  })

  describe('topic validators', () => {
    it('should filter messages by topic validator', async () => {
      // use validate.getCall(0).returnValue to see if a message is valid or not
      sinon.spy(gossipsub, 'validate')
      // Disable strict signing
      sinon.stub(gossipsub, 'strictSigning').value(false)
      sinon.stub(gossipsub.peers, 'get').returns({})
      const filteredTopic = 't'
      const peer = new Peer({ id: await PeerId.create() })
      //gossipsub.peers.set(peer.id.toB58String(), peer)

      // Set a trivial topic validator
      gossipsub.topicValidators.set(filteredTopic, (topic, peer, message) => {
        return message.data.equals(Buffer.from('a message'))
      })

      // valid case
      const validRpc = {
        subscriptions: [],
        msgs: [{
          from: peer.id.toBytes(),
          data: Buffer.from('a message'),
          seqno: utils.randomSeqno(),
          topicIDs: [filteredTopic]
        }]
      }

      // process valid message
      gossipsub._processRpc(peer.id.toB58String(), peer, validRpc)
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(gossipsub.validate.callCount).to.eql(1)
      expect(await gossipsub.validate.getCall(0).returnValue).to.eql(true)

      // invalid case
      const invalidRpc = {
        subscriptions: [],
        msgs: [{
          from: peer.id.toBytes(),
          data: Buffer.from('a different message'),
          seqno: utils.randomSeqno(),
          topicIDs: [filteredTopic]
        }]
      }

      // process invalid message
      gossipsub._processRpc(peer.id.toB58String(), peer, invalidRpc)
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(gossipsub.validate.callCount).to.eql(2)
      expect(await gossipsub.validate.getCall(1).returnValue).to.eql(false)

      // remove topic validator
      gossipsub.topicValidators.delete(filteredTopic)

      // another invalid case
      const invalidRpc2 = {
        subscriptions: [],
        msgs: [{
          from: peer.id.toB58String(),
          data: Buffer.from('a different message'),
          seqno: utils.randomSeqno(),
          topicIDs: [filteredTopic]
        }]
      }

      // process previously invalid message, now is valid
      gossipsub._processRpc(peer.id.toB58String(), peer, invalidRpc2)
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(gossipsub.validate.callCount).to.eql(3)
      expect(await gossipsub.validate.getCall(2).returnValue).to.eql(true)
    })
  })
})

'use strict'
/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
const { Buffer } = require('buffer')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const sinon = require('sinon')
const delay = require('delay')
const errcode = require('err-code')

const { utils } = require('libp2p-pubsub')
const PeerStreams = require('libp2p-pubsub/src/peerStreams')
const { signMessage } = require('libp2p-pubsub/src/message/sign')
const PeerId = require('peer-id')

const Gossipsub = require('../src')
const { ERR_TOPIC_VALIDATOR_REJECT } = require('../src/constants')
const {
  createPeer,
  startNode,
  stopNode
} = require('./utils')

describe('Pubsub', () => {
  let gossipsub

  before(async () => {
    gossipsub = new Gossipsub(await createPeer({ started: false }))
    await startNode(gossipsub)
  })

  after(() => stopNode(gossipsub))

  afterEach(() => {
    sinon.restore()
  })

  describe('publish', () => {
    it('should sign messages on publish', async () => {
      sinon.spy(gossipsub, '_publish')

      await gossipsub.publish('signing-topic', Buffer.from('hello'))

      // Get the first message sent to _publish, and validate it
      const signedMessage = await gossipsub._buildMessage(gossipsub._publish.getCall(0).lastArg)
      try {
        await gossipsub.validate(signedMessage)
      } catch (e) {
        expect.fail("validation should not throw")
      }
    })
  })

  describe('validate', () => {
    it('should drop unsigned messages', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, '_publishFrom')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const peer = new PeerStreams({ id: await PeerId.create() })
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
        expect(gossipsub._publishFrom.callCount).to.eql(0)
        resolve()
      }, 500))
    })

    it('should not drop signed messages', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, '_publishFrom')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const peer = new PeerStreams({ id: await PeerId.create() })
      let signedMessage = {
        from: peer.id.toB58String(),
        data: Buffer.from('a signed message'),
        seqno: utils.randomSeqno(),
        topicIDs: [topic]
      }
      signedMessage = await signMessage(peer.id, utils.normalizeOutRpcMessage(signedMessage))

      const rpc = {
        subscriptions: [],
        msgs: [signedMessage]
      }

      gossipsub._processRpc(peer.id.toB58String(), peer, rpc)

      return new Promise(resolve => setTimeout(async () => {
        expect(gossipsub._publishFrom.callCount).to.eql(1)
        resolve()
      }, 500))
    })

    it('should not drop unsigned messages if strict signing is disabled', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, '_publishFrom')
      sinon.stub(gossipsub.peers, 'get').returns({})
      // Disable strict signing
      sinon.stub(gossipsub, 'strictSigning').value(false)

      const topic = 'my-topic'
      const peer = new PeerStreams({ id: await PeerId.create() })
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
        expect(gossipsub._publishFrom.callCount).to.eql(1)
        resolve()
      }, 500))
    })
  })

  describe('topic validators', () => {
    it('should filter messages by topic validator', async () => {
      // use _publishFrom.callCount() to see if a message is valid or not
      sinon.spy(gossipsub, '_publishFrom')
      // Disable strict signing
      sinon.stub(gossipsub, 'strictSigning').value(false)
      sinon.stub(gossipsub.peers, 'get').returns({})
      const filteredTopic = 't'
      const peer = new PeerStreams({ id: await PeerId.create() })

      // Set a trivial topic validator
      gossipsub.topicValidators.set(filteredTopic, (topic, message) => {
        if (!message.data.equals(Buffer.from('a message'))) {
          throw errcode(new Error(), ERR_TOPIC_VALIDATOR_REJECT)
        }
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
      await delay(500)
      expect(gossipsub._publishFrom.callCount).to.eql(1)

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
      await delay(500)
      expect(gossipsub._publishFrom.callCount).to.eql(1)

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
      await delay(500)
      expect(gossipsub._publishFrom.callCount).to.eql(2)
    })
  })
})

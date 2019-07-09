'use strict'
/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const sinon = require('sinon')
const { utils } = require('libp2p-pubsub')
const promisify = require('promisify-es6')
const {
  createNode,
  startNode,
  stopNode
} = require('./utils')

describe('Pubsub', () => {
  let nodeA
  let gossipsub
  before(async () => {
    nodeA = await createNode('/ip4/127.0.0.1/tcp/0')
    gossipsub = nodeA.gs
    await startNode(nodeA)
    await startNode(gossipsub)
  })
  after(async () => {
    await stopNode(gossipsub)
    await stopNode(nodeA)
  })
  afterEach(() => {
    sinon.restore()
  })

  describe('publish', () => {
    it('should sign messages on publish', (done) => {
      sinon.spy(nodeA.gs, '_publish')

      gossipsub.publish('signing-topic', Buffer.from('hello'), (err) => {
        expect(err).to.not.exist()

        // Get the first message sent to _publish, and validate it
        const signedMessage = gossipsub._publish.getCall(0).lastArg[0]
        gossipsub.validate(signedMessage, (err, isValid) => {
          expect(err).to.not.exist()
          expect(isValid).to.eql(true)
          done()
        })
      })
    })
  })

  describe('validate', () => {
    it('should drop unsigned messages', () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.spy(gossipsub, 'log')
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

      gossipsub._onRpc('QmAnotherPeer', rpc)

      return new Promise(resolve => setTimeout(() => {
        const dropLogs = gossipsub.log.getCalls().filter((call) => call.args[0].match(/dropping it/gi))
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(gossipsub._processRpcMessage.called).to.eql(false)
        expect(dropLogs).to.have.length(1)
        resolve()
      }, 0))
    })

    it('should not drop signed messages', async () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.spy(gossipsub, 'log')
      sinon.stub(gossipsub.peers, 'get').returns({})

      const topic = 'my-topic'
      const signedMessage = await promisify(gossipsub._buildMessage, {
        context: gossipsub
      })({
        from: gossipsub.peerId.id,
        data: Buffer.from('an unsigned message'),
        seqno: utils.randomSeqno(),
        topicIDs: [topic]
      })

      const rpc = {
        subscriptions: [],
        msgs: [signedMessage]
      }

      gossipsub._onRpc('QmAnotherPeer', rpc)

      return new Promise(resolve => setTimeout(() => {
        const dropLogs = gossipsub.log.getCalls().filter((call) => call.args[0].match(/dropping it/gi))
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(gossipsub._processRpcMessage.callCount).to.eql(1)
        expect(dropLogs).to.be.empty()
        resolve()
      }, 0))
    })

    it('should not drop unsigned messages if strict signing is disabled', () => {
      sinon.spy(gossipsub, '_processRpcMessage')
      sinon.spy(gossipsub, 'validate')
      sinon.spy(gossipsub, 'log')
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

      gossipsub._onRpc('QmAnotherPeer', rpc)

      return new Promise(resolve => setTimeout(() => {
        const dropLogs = gossipsub.log.getCalls().filter((call) => call.args[0].match(/dropping it/gi))
        expect(gossipsub.validate.callCount).to.eql(1)
        expect(gossipsub._processRpcMessage.callCount).to.eql(1)
        expect(dropLogs).to.be.empty()
        resolve()
      }, 0))
    })
  })
})

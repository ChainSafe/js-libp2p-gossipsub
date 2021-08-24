/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const chaiSpies = require('chai-spies')
chai.use(chaiSpies)
const expect = chai.expect
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string')

const { MessageCache } = require('../src/message-cache')
const { utils } = require('libp2p-interfaces/src/pubsub')
const { getMsgId } = require('./utils')

describe('Testing Message Cache Operations', () => {
  const messageCache = new MessageCache(3, 5, getMsgId)
  const testMessages = []

  before(async () => {
    const makeTestMessage = (n) => {
      return {
        from: 'test',
        data: uint8ArrayFromString(n.toString()),
        seqno: utils.randomSeqno(),
        topicIDs: ['test']
      }
    }

    for (let i = 0; i < 60; i++) {
      testMessages.push(makeTestMessage(i))
    }

    for (let i = 0; i < 10; i++) {
      await messageCache.put(testMessages[i])
    }
  })

  it('Should retrieve correct messages for each test message', () => {
    for (let i = 0; i < 10; i++) {
      const messageId = getMsgId(testMessages[i])
      const message = messageCache.get(messageId)
      expect(message).to.equal(testMessages[i])
    }
  })

  it('Get GossipIDs', () => {
    const gossipIDs = messageCache.getGossipIDs('test')
    expect(gossipIDs.length).to.equal(10)

    for (let i = 0; i < 10; i++) {
      const messageID = getMsgId(testMessages[i])
      expect(messageID).to.deep.equal(gossipIDs[i])
    }
  })

  it('Shift message cache', async () => {
    messageCache.shift()
    for (let i = 10; i < 20; i++) {
      await messageCache.put(testMessages[i])
    }

    for (let i = 0; i < 20; i++) {
      const messageID = getMsgId(testMessages[i])
      const message = messageCache.get(messageID)
      expect(message).to.equal(testMessages[i])
    }

    let gossipIDs = messageCache.getGossipIDs('test')
    expect(gossipIDs.length).to.equal(20)

    for (let i = 0; i < 10; i++) {
      const messageID = getMsgId(testMessages[i])
      expect(messageID).to.deep.equal(gossipIDs[10 + i])
    }

    for (let i = 10; i < 20; i++) {
      const messageID = getMsgId(testMessages[i])
      expect(messageID).to.deep.equal(gossipIDs[i - 10])
    }

    messageCache.shift()
    for (let i = 20; i < 30; i++) {
      await messageCache.put(testMessages[i])
    }

    messageCache.shift()
    for (let i = 30; i < 40; i++) {
      await messageCache.put(testMessages[i])
    }

    messageCache.shift()
    for (let i = 40; i < 50; i++) {
      await messageCache.put(testMessages[i])
    }

    messageCache.shift()
    for (let i = 50; i < 60; i++) {
      await messageCache.put(testMessages[i])
    }

    expect(messageCache.msgs.size).to.equal(50)

    for (let i = 0; i < 10; i++) {
      const messageID = getMsgId(testMessages[i])
      const message = messageCache.get(messageID)
      expect(message).to.be.an('undefined')
    }

    for (let i = 10; i < 60; i++) {
      const messageID = getMsgId(testMessages[i])
      const message = messageCache.get(messageID)
      expect(message).to.equal(testMessages[i])
    }

    gossipIDs = messageCache.getGossipIDs('test')
    expect(gossipIDs.length).to.equal(30)

    for (let i = 0; i < 10; i++) {
      const messageID = getMsgId(testMessages[50 + i])
      expect(messageID).to.deep.equal(gossipIDs[i])
    }

    for (let i = 10; i < 20; i++) {
      const messageID = getMsgId(testMessages[30 + i])
      expect(messageID).to.deep.equal(gossipIDs[i])
    }

    for (let i = 20; i < 30; i++) {
      const messageID = getMsgId(testMessages[10 + i])
      expect(messageID).to.deep.equal(gossipIDs[i])
    }
  })
})

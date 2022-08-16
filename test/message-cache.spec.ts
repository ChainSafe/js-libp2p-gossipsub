import chai from 'chai'
// @ts-ignore
import dirtyChai from 'dirty-chai'
// @ts-ignore
import chaiSpies from 'chai-spies'
import { messageIdToString } from '../ts/utils/messageIdToString'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { MessageCache } from '../ts/message-cache'
import { utils } from 'libp2p-interfaces/src/pubsub'
import { getMsgId } from './utils'
import { GossipsubMessage } from '../ts/types'

/* eslint-disable no-unused-expressions */

chai.use(dirtyChai)
chai.use(chaiSpies)
const expect = chai.expect

describe('Testing Message Cache Operations', () => {
  const messageCache = new MessageCache(3, 5)
  const testMessages: GossipsubMessage[] = []

  before(async () => {
    const makeTestMessage = (n: number): GossipsubMessage => {
      return {
        from: new Uint8Array(0),
        data: uint8ArrayFromString(n.toString()),
        seqno: utils.randomSeqno(),
        topic: 'test'
      }
    }

    for (let i = 0; i < 60; i++) {
      testMessages.push(makeTestMessage(i))
    }

    for (let i = 0; i < 10; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], true)
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
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], true)
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
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], true)
    }

    messageCache.shift()
    for (let i = 30; i < 40; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], true)
    }

    messageCache.shift()
    for (let i = 40; i < 50; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], true)
    }

    messageCache.shift()
    for (let i = 50; i < 60; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], true)
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

  it('should not gossip not-validated message ids', () => {
    let gossipIDs = messageCache.getGossipIDs('test')
    while (gossipIDs.length > 0) {
      messageCache.shift()
      gossipIDs = messageCache.getGossipIDs('test')
    }
    expect(gossipIDs.length).to.be.equal(0)

    for (let i = 10; i < 20; i++) {
      // 5 last messages are not validated
      const validated = i < 15
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i], validated)
    }

    gossipIDs = messageCache.getGossipIDs('test')
    expect(gossipIDs.length).to.be.equal(5)
    // only validate the new gossip ids
    for (let i = 0; i < 5; i++) {
      expect(gossipIDs[i]).to.deep.equal(getMsgId(testMessages[i + 10]), 'incorrect gossip message id ' + i)
    }
  })
})

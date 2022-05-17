import { expect } from 'aegir/utils/chai.js'
import { messageIdToString } from '../src/utils/messageIdToString.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { MessageCache } from '../src/message-cache.js'
import * as utils from '@libp2p/pubsub/utils'
import { getMsgId } from './utils/index.js'
import type { RPC } from '../src/message/rpc.js'

describe('Testing Message Cache Operations', () => {
  const messageCache = new MessageCache(3, 5)
  const testMessages: RPC.Message[] = []

  before(async () => {
    const makeTestMessage = (n: number): RPC.Message => {
      return {
        from: new Uint8Array(0),
        data: uint8ArrayFromString(n.toString()),
        seqno: uint8ArrayFromString(utils.randomSeqno().toString(16).padStart(16, '0'), 'base16'),
        topic: 'test'
      }
    }

    for (let i = 0; i < 60; i++) {
      testMessages.push(makeTestMessage(i))
    }

    for (let i = 0; i < 10; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i])
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
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i])
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
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i])
    }

    messageCache.shift()
    for (let i = 30; i < 40; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i])
    }

    messageCache.shift()
    for (let i = 40; i < 50; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i])
    }

    messageCache.shift()
    for (let i = 50; i < 60; i++) {
      messageCache.put(messageIdToString(getMsgId(testMessages[i])), testMessages[i])
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

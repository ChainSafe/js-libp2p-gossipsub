'use strict'

const chai = require('chai')
const expect = chai.expect
const MessageCache = require('../src/messageCache').MessageCache
const RPC = require('../src/message/').rpc.RPC
const utils = require('../src/utils.js')
const Buffer = require('buffer').Buffer

const getMsgID = (msg) => {
    return utils.msgId(msg.from, msg.seqno)
}

describe('Testing Message Cache Operations', () => {
    let messageCache = new MessageCache(3, 5)
    let testMessages = []

    it('Create message cache', () => {
	const makeTestMessage = (n) => {
	    return {
	        from: 'test' ,
                data: Buffer.from(n.toString()),
		seqno: utils.randomSeqno() ,
		topicIDs:['test']
	    }
	}
	
	for(let i=0; i < 60; i++) {
	    testMessages.push(makeTestMessage(i))
	}
      
	expect(messageCache).to.exist
	expect(testMessages).to.exist
	expect(testMessages).to.be.an('array').not.be.empty
        
    })

    it('Add messages to message cache', () => {
       for(let i=0; i < 10; i++) {
           messageCache.put(testMessages[i])
	   let msgId = getMsgID(testMessages[i])
	   let message = messageCache.get(msgId)
	   expect(message).to.equal(testMessages[i])
       }        
    })

    it('Get GossipIDs', () => {
        let gossipIDs = messageCache.getGossipIDs('test')
	expect(gossipIDs.length).to.equal(10)

	for(let i=0; i< 10; i++) {
	    let messageID = getMsgID(testMessages[i])
            expect(messageID).to.equal(gossipIDs[i])
	}
    })

    it('Shift message cache', () => {
        messageCache.shift()
	for(let i=10; i < 20; i++) {
	    messageCache.put(testMessages[i])
	}

	for(let i=0; i < 20; i++) {
	    let messageID = getMsgID(testMessages[i])
            let message = messageCache.get(messageID)
	    expect(message).to.equal(testMessages[i])
	}

	let gossipIDs = messageCache.getGossipIDs('test')
	expect(gossipIDs.length).to.equal(20)

	for(let i=0; i < 10; i++) {
	    let messageID = getMsgID(testMessages[i])
            expect(messageID).to.equal(gossipIDs[10+i])
	}

	for(let i=10; i < 20; i++) {
	    let messageID = getMsgID(testMessages[i])
            expect(messageID).to.equal(gossipIDs[i-10])
	}

	messageCache.shift()
	for(let i=20; i < 30; i++) {
	    messageCache.put(testMessages[i])
	}

	messageCache.shift()
	for(let i=30; i < 40; i++) {
	    messageCache.put(testMessages[i])
	}

	messageCache.shift()
	for(let i=40; i < 50; i++) {
	    messageCache.put(testMessages[i])
	}

	messageCache.shift()
	for(let i=50; i < 60; i++) {
	    messageCache.put(testMessages[i])
	}

	expect(messageCache.msgs.size).to.equal(50)

	for(let i=0; i < 10; i++) {
	    let messageID = getMsgID(testMessages[i])
            let message = messageCache.get(messageID) 
            expect(message).to.be.an('undefined')
	}

	for(let i=10; i < 60; i++) {
	    let messageID = getMsgID(testMessages[i])
            let message = messageCache.get(messageID)
	    expect(message).to.equal(testMessages[i])
	}

	gossipIDs = messageCache.getGossipIDs('test')
	expect(gossipIDs.length).to.equal(30)

	for(let i=0; i < 10; i++) {
	    let messageID = getMsgID(testMessages[50+i])
            expect(messageID).to.equal(gossipIDs[i])
	}

	for(let i=10; i < 20; i++) {
	    let messageID = getMsgID(testMessages[30+i])
            expect(messageID).to.equal(gossipIDs[i])
	}

	for(let i=20; i < 30; i++) {
	    let messageID = getMsgID(testMessages[10+i])
            expect(messageID).to.equal(gossipIDs[i])
	}
    })
})


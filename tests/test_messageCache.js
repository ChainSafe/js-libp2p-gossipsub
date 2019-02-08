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
    let testMessages = new Array(60)

    it('Create message cache', () => {
	const makeTestMessage = (n) => {
	    return {
	        from: 'test' ,
                data: Buffer.from(n.toString()),
		seqno: utils.randomSeqno() ,
		topicIDs:['test']
	    }
	}
	
	for(let i=0; i < 60; i++){
	    testMessages.push(makeTestMessage(i))
	}
      
	expect(messageCache).to.exist
	expect(testMessages).to.exist
	expect(testMessages).to.be.an('array').not.be.null
        
    })

    it('Add messages to message cache', () => {
       for(let i=0; i < 10; i++) { 
           messageCache.put(testMessages[i])
	   let msgId = getMsgID(testMessages[i])
	   let res = messageCache.get(msgId)
	   let message = res[0]
	   let has = res[1]
           expect(has).to.be.true
	   expect(message).to.be(testMessages[i])
       }        
    })

    it('Get GossipIDs', () => {
        let gossipIDs = messageCache.getGossipIDs("test")
	expect(gossipIDS.length).to.be(10)

	for(let i=0; i< 10; i++) {
	    let messageID = utils.msgId(testMessages[i])
            expect(messageID).to.be(gossipIDs[i])
	}
    })

    it('Shift message cache', () => {
        messageCache.shift()
	for(let i=10; i < 20; i++) {
	    messageCache.put(testMessages[i])
	}

	for(let i=0; i < 20; i++) {
	    let messageID = getMsgID(testMessages[i])
            let res = messageCache.get(messageID)
            let msg = res[0]
            let has = res[1]
            expect(has).to.be(true)
	    expect(msg).to.be(testMessages[i])
	}

	let gossipIDs = messageCache.getGossipIDs("test")
	expect(gossipIDs.length).to.be(20)

	for(let i=0; i < 10; i++) {
	    let messageID = getMsgID(testMessages[i])
            expect(messageID).to.be(gossipIDs[10+i])
	}

	for(let i=10; i < 20; i++) {
	    let messageID = getMsgID(testMessages[i])
            expect(messageID).to.be(gossipIDs[i-10])
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

	expect(messageCache.msgs.length).toBe(50)

	for (let i=0; i < 10; i++) {
	    let messageID = getMsgID(testMessages[i])
            let res = messageCache.get(messageID)
            let has = res[1]
            expect(has).to.be(true)
	}

	for (let i=10; i < 60; i++) {
	    let messageID = getMsgID(testMessages[i])
            let res = messageCache.get(messageID)
            let msg = res[0]
            let has = res[1]
	    expect(has).to.be(true)
	    expect(msg).to.be(testMessages[i])
	}

	gossipIDs = messageCache.getGossipIDs("test")
	expect(gossipIDs.length).to.be(30)

	for (let i=0; i < 10; i++) {
	    let messageID = getMsgID(testMessages[50+i])
            expect(messageID).to.be(gossipIDs[i])
	}

	for (let i=10; i < 20; i++) {
	    let messageID = getMsgID(testMessages[30+i])
            expect(messageID).to.be(gossipIDs[i])
	}

	for (let i=20; i < 30; i++) {
	    let messageID = getMsgID(testMessages[10+i])
            expect(messageID).to.be(gossipIDs[i])
	}
    })
})


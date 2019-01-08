const pb = require('./message')

class CacheEntry {

    /**
     * @param {String}
     * @param {String[]}
     * @constructor
     */
    constructor (mid, topics) {
        this.mid = mid
	this.topics = topics
    }

}

class MessageCache {

    /**
     * @param {Map<String, pb.rpc.RPC.Message>}
     * @param {CacheEntry[][]}
     * @param {Number}
     *
     * @constructor
     */
    constructor (msgs, history, gossip) {
        this.msgs = msgs
	this.history = history
	this.gossip = gossip
    }

    Put (msg) {
    }

    Get () {
    }

    GetGossipIDs () {
    }

    Shift () {
    }
}

module.exports = {
    CacheEntry,
    MessageCache
}

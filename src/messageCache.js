'use strict'

class CacheEntry {
  /**
   * @param {String} msgID
   * @param {Array<String>} topics
   *
   * @constructor
   */
  constructor (msgID, topics) {
    this.msgID = msgID
    this.topics = topics
  }
}

class MessageCache {
  /**
   * @param {Number} gossip
   * @param {Number} history
   * @param {msgIdFn} msgIdFn a function that returns message id from a message
   *
   * @constructor
   */
  constructor (gossip, history, msgIdFn) {
    /**
     * @type {Map<string, RPC.Message>}
     */
    this.msgs = new Map()

    /**
     * @type {Array<Array<CacheEntry>>}
     */
    this.history = []
    for (let i = 0; i < history; i++) {
      this.history[i] = []
    }

    /**
     * @type {Number}
     */
    this.gossip = gossip

    /**
     * @type {Function}
     */
    this.msgIdFn = msgIdFn
  }

  /**
   * Adds a message to the current window and the cache
   *
   * @param {RPC.Message} msg
   * @returns {void}
   */
  put (msg) {
    const msgID = this.getMsgId(msg)
    this.msgs.set(msgID, msg)
    this.history[0].push(new CacheEntry(msgID, msg.topicIDs))
  }

  /**
   * Get message id of message.
   * @param {RPC.Message} msg
   * @returns {string}
   */
  getMsgId (msg) {
    return this.msgIdFn(msg)
  }

  /**
   * Retrieves a message from the cache by its ID, if it is still present
   *
   * @param {String} msgID
   * @returns {RPC.Message}
   */
  get (msgID) {
    return this.msgs.get(msgID)
  }

  /**
   * Retrieves a list of message IDs for a given topic
   *
   * @param {String} topic
   *
   * @returns {Array<String>}
   */
  getGossipIDs (topic) {
    const msgIDs = []
    for (let i = 0; i < this.gossip; i++) {
      this.history[i].forEach((entry) => {
        for (const t of entry.topics) {
          if (t === topic) {
            msgIDs.push(entry.msgID)
            break
          }
        }
      })
    }

    return msgIDs
  }

  /**
   * Shifts the current window, discarding messages older than this.history.length of the cache
   *
   * @returns {void}
   */
  shift () {
    const last = this.history[this.history.length - 1]
    last.forEach((entry) => {
      this.msgs.delete(entry.msgID)
    })

    this.history.pop()
    this.history.unshift([])
  }
}

module.exports = {
  CacheEntry,
  MessageCache
}

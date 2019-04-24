/* eslint-disable valid-jsdoc */
'use strict'
const { utils } = require('libp2p-pubsub')

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
   *
   * @constructor
   */
  constructor (gossip, history) {
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
  }

  /**
   * Adds a message to the current window and the cache
   *
   * @param {RPC.Message Object} msg
   *
   * @returns {void}
   */
  put (msg) {
    let msgID = utils.msgId(msg.from, msg.seqno)
    this.msgs.set(msgID, msg)
    this.history[0].push(new CacheEntry(msgID, msg.topicIDs))
  }

  /**
   * Retrieves a message from the cache by its ID, if it is still present
   *
   * @param {String} msgID
   *
   * @returns {RPC.Message Object}
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
    let msgIDs = []
    for (let i = 0; i < this.gossip; i++) {
      this.history[i].forEach((entry) => {
        for (let t of entry.topics) {
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
    let last = this.history[this.history.length - 1]
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

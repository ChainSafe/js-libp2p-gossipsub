import { InMessage } from 'libp2p-interfaces/src/pubsub'
import { MessageIdFunction } from './interfaces'
import { messageIdToString } from './utils'

export interface CacheEntry {
  msgID: Uint8Array
  topics: string[]
}

export class MessageCache {
  msgs: Map<string, InMessage>
  peertx: Map<string, Map<string, number>>
  history: CacheEntry[][]
  gossip: number
  msgIdFn: MessageIdFunction

  /**
   * @param {Number} gossip
   * @param {Number} history
   * @param {msgIdFn} msgIdFn a function that returns message id from a message
   *
   * @constructor
   */
  constructor (gossip: number, history: number, msgIdFn: MessageIdFunction) {
    /**
     * @type {Map<string, RPC.Message>}
     */
    this.msgs = new Map()

    this.peertx = new Map()

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
  put (msg: InMessage): void {
    const msgID = this.getMsgId(msg)
    const msgIdStr = messageIdToString(msgID)
    this.msgs.set(msgIdStr, msg)
    this.history[0].push({ msgID, topics: msg.topicIDs })
  }

  /**
   * Get message id of message.
   * @param {RPC.Message} msg
   * @returns {Uint8Array}
   */
  getMsgId (msg: InMessage): Uint8Array {
    return this.msgIdFn(msg)
  }

  /**
   * Retrieves a message from the cache by its ID, if it is still present
   *
   * @param {Uint8Array} msgID
   * @returns {Message}
   */
  get (msgID: Uint8Array): InMessage | undefined {
    return this.msgs.get(messageIdToString(msgID))
  }

  /**
   * Retrieves a message from the cache by its ID, if it is present
   * for a specific peer.
   * Returns the message and the number of times the peer has requested the message
   *
   * @param {string} msgID
   * @param {string} p
   * @returns {[InMessage | undefined, number]}
   */
  getForPeer (msgID: Uint8Array, p: string): [InMessage | undefined, number] {
    const msgIdStr = messageIdToString(msgID)
    const msg = this.msgs.get(msgIdStr)
    if (!msg) {
      return [undefined, 0]
    }

    let peertx = this.peertx.get(msgIdStr)
    if (!peertx) {
      peertx = new Map()
      this.peertx.set(msgIdStr, peertx)
    }
    const count = (peertx.get(p) || 0) + 1
    peertx.set(p, count)

    return [msg, count]
  }

  /**
   * Retrieves a list of message IDs for a given topic
   *
   * @param {String} topic
   *
   * @returns {Array<Uint8Array>}
   */
  getGossipIDs (topic: string): Uint8Array[] {
    const msgIDs: Uint8Array[] = []
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
  shift (): void {
    const last = this.history[this.history.length - 1]
    last.forEach((entry) => {
      const msgIdStr = messageIdToString(entry.msgID)
      this.msgs.delete(msgIdStr)
      this.peertx.delete(msgIdStr)
    })

    this.history.pop()
    this.history.unshift([])
  }
}

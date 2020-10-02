import { InMessage } from 'libp2p-interfaces/src/pubsub'

export interface CacheEntry {
  msgID: string
  topics: string[]
}

export class MessageCache {
  msgs: Map<string, InMessage>
  peertx: Map<string, Map<string, number>>
  history: CacheEntry[][]
  gossip: number
  msgIdFn: (msg: InMessage) => string

  /**
   * @param {Number} gossip
   * @param {Number} history
   * @param {msgIdFn} msgIdFn a function that returns message id from a message
   *
   * @constructor
   */
  constructor (gossip: number, history: number, msgIdFn: (msg: InMessage) => string) {
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
    this.msgs.set(msgID, msg)
    this.history[0].push({ msgID, topics: msg.topicIDs })
  }

  /**
   * Get message id of message.
   * @param {RPC.Message} msg
   * @returns {string}
   */
  getMsgId (msg: InMessage): string {
    return this.msgIdFn(msg)
  }

  /**
   * Retrieves a message from the cache by its ID, if it is still present
   *
   * @param {String} msgID
   * @returns {Message}
   */
  get (msgID: string): InMessage | undefined {
    return this.msgs.get(msgID)
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
  getForPeer (msgID: string, p: string): [InMessage | undefined, number] {
    const msg = this.msgs.get(msgID)
    if (!msg) {
      return [undefined, 0]
    }

    let peertx = this.peertx.get(msgID)
    if (!peertx) {
      peertx = new Map()
      this.peertx.set(msgID, peertx)
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
   * @returns {Array<String>}
   */
  getGossipIDs (topic: string): string[] {
    const msgIDs: string[] = []
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
      this.msgs.delete(entry.msgID)
      this.peertx.delete(entry.msgID)
    })

    this.history.pop()
    this.history.unshift([])
  }
}

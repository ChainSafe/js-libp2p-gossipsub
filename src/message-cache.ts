import type { RPC } from './message/rpc.js'
import type { MessageId, MsgIdStr, PeerIdStr, TopicStr, MsgIdToStrFn } from './types.js'

export type CacheEntry = MessageId & {
  topic: TopicStr
}

interface MessageCacheEntry {
  message: RPC.Message
  /**
   * Tracks if the message has been validated by the app layer and thus forwarded
   */
  validated: boolean
  /**
   * Tracks peers that sent this message before it has been validated by the app layer
   */
  originatingPeers: Set<PeerIdStr>
  /**
   * For every message and peer the number of times this peer asked for the message
   */
  iwantCounts: Map<PeerIdStr, number>
}

export class MessageCache {
  msgs = new Map<MsgIdStr, MessageCacheEntry>()

  msgIdToStrFn: MsgIdToStrFn

  history: CacheEntry[][] = []

  /**
   * Holds history of messages in timebounded history arrays
   */
  constructor(
    /**
     * The number of indices in the cache history used for gossiping. That means that a message
     * won't get gossiped anymore when shift got called `gossip` many times after inserting the
     * message in the cache.
     */
    private readonly gossip: number,
    historyCapacity: number,
    msgIdToStrFn: MsgIdToStrFn
  ) {
    this.msgIdToStrFn = msgIdToStrFn
    for (let i = 0; i < historyCapacity; i++) {
      this.history[i] = []
    }
  }

  get size(): number {
    return this.msgs.size
  }

  /**
   * Adds a message to the current window and the cache
   * Returns true if the message is not known and is inserted in the cache
   */
  put(messageId: MessageId, msg: RPC.Message): boolean {
    const { msgIdStr } = messageId
    // Don't add duplicate entries to the cache.
    if (this.msgs.has(msgIdStr)) {
      return false
    }

    this.msgs.set(msgIdStr, {
      message: msg,
      validated: false,
      originatingPeers: new Set(),
      iwantCounts: new Map()
    })

    this.history[0].push({ ...messageId, topic: msg.topic })

    return true
  }

  observeDuplicate(msgId: MsgIdStr, fromPeerIdStr: PeerIdStr): void {
    const entry = this.msgs.get(msgId)

    if (
      entry &&
      // if the message is already validated, we don't need to store extra peers sending us
      // duplicates as the message has already been forwarded
      !entry.validated
    ) {
      entry.originatingPeers.add(fromPeerIdStr)
    }
  }

  /**
   * Retrieves a message from the cache by its ID, if it is still present
   */
  get(msgId: Uint8Array): RPC.Message | undefined {
    return this.msgs.get(this.msgIdToStrFn(msgId))?.message
  }

  /**
   * Increases the iwant count for the given message by one and returns the message together
   * with the iwant if the message exists.
   */
  getWithIWantCount(msgIdStr: string, p: string): { msg: RPC.Message; count: number } | null {
    const msg = this.msgs.get(msgIdStr)
    if (!msg) {
      return null
    }

    const count = (msg.iwantCounts.get(p) ?? 0) + 1
    msg.iwantCounts.set(p, count)

    return { msg: msg.message, count }
  }

  /**
   * Retrieves a list of message IDs for a set of topics
   */
  getGossipIDs(topics: Set<string>): Map<string, Uint8Array[]> {
    const msgIdsByTopic = new Map<string, Uint8Array[]>()
    for (let i = 0; i < this.gossip; i++) {
      this.history[i].forEach((entry) => {
        // TODO: no need to convert to string again
        // see https://github.com/ChainSafe/js-libp2p-gossipsub/pull/274
        const msg = this.msgs.get(this.msgIdToStrFn(entry.msgId))
        if (msg && msg.validated && topics.has(entry.topic)) {
          let msgIds = msgIdsByTopic.get(entry.topic)
          if (!msgIds) {
            msgIds = []
            msgIdsByTopic.set(entry.topic, msgIds)
          }
          msgIds.push(entry.msgId)
        }
      })
    }

    return msgIdsByTopic
  }

  /**
   * Gets a message with msgId and tags it as validated.
   * This function also returns the known peers that have sent us this message. This is used to
   * prevent us sending redundant messages to peers who have already propagated it.
   */
  validate(msgId: MsgIdStr): { message: RPC.Message; originatingPeers: Set<PeerIdStr> } | null {
    const entry = this.msgs.get(msgId)
    if (!entry) {
      return null
    }

    const { message, originatingPeers } = entry
    entry.validated = true
    // Clear the known peers list (after a message is validated, it is forwarded and we no
    // longer need to store the originating peers).
    entry.originatingPeers = new Set()
    return { message, originatingPeers }
  }

  /**
   * Shifts the current window, discarding messages older than this.history.length of the cache
   */
  shift(): void {
    const last = this.history[this.history.length - 1]
    last.forEach((entry) => {
      this.msgs.delete(entry.msgIdStr)
    })

    this.history.pop()
    this.history.unshift([])
  }

  remove(msgId: MsgIdStr): MessageCacheEntry | null {
    const entry = this.msgs.get(msgId)
    if (!entry) {
      return null
    }

    // Keep the message on the history vector, it will be dropped on a shift()
    this.msgs.delete(msgId)
    return entry
  }
}

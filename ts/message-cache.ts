import { InMessage } from 'libp2p-interfaces/src/pubsub'
import { MessageIdFunction } from './interfaces'
import { messageIdFromString, messageIdToString } from './utils'

export interface CacheEntry {
  msgId: Uint8Array
  topics: string[]
}

export class MessageCache {
  msgs = new Map<string, InMessage>()
  peertx = new Map<string, Map<string, number>>()
  history: CacheEntry[][] = []
  gossip: number
  msgIdFn: MessageIdFunction

  constructor(gossip: number, history: number) {
    for (let i = 0; i < history; i++) {
      this.history[i] = []
    }

    this.gossip = gossip
  }

  /**
   * Adds a message to the current window and the cache
   */
  async put(msg: InMessage, msgIdStr: string): Promise<void> {
    this.msgs.set(msgIdStr, msg)
    const msgId = messageIdFromString(msgIdStr)
    this.history[0].push({ msgId: msgId, topics: msg.topicIDs })
  }

  /**
   * Retrieves a message from the cache by its ID, if it is still present
   */
  get(msgId: Uint8Array): InMessage | undefined {
    return this.msgs.get(messageIdToString(msgId))
  }

  /**
   * Retrieves a message from the cache by its ID, if it is present
   * for a specific peer.
   * Returns the message and the number of times the peer has requested the message
   */
  getForPeer(msgIdStr: string, p: string): [InMessage | undefined, number] {
    const msg = this.msgs.get(msgIdStr)
    if (!msg) {
      return [undefined, 0]
    }

    let peertx = this.peertx.get(msgIdStr)
    if (!peertx) {
      peertx = new Map()
      this.peertx.set(msgIdStr, peertx)
    }
    const count = (peertx.get(p) ?? 0) + 1
    peertx.set(p, count)

    return [msg, count]
  }

  /**
   * Retrieves a list of message IDs for a given topic
   */
  getGossipIDs(topic: string): Uint8Array[] {
    const msgIds: Uint8Array[] = []
    for (let i = 0; i < this.gossip; i++) {
      this.history[i].forEach((entry) => {
        for (const t of entry.topics) {
          if (t === topic) {
            msgIds.push(entry.msgId)
            break
          }
        }
      })
    }

    return msgIds
  }

  /**
   * Shifts the current window, discarding messages older than this.history.length of the cache
   */
  shift(): void {
    const last = this.history[this.history.length - 1]
    last.forEach((entry) => {
      const msgIdStr = messageIdToString(entry.msgId)
      this.msgs.delete(msgIdStr)
      this.peertx.delete(msgIdStr)
    })

    this.history.pop()
    this.history.unshift([])
  }
}

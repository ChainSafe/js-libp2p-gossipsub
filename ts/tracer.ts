import { GossipsubIWantFollowupTime } from './constants'
import { messageIdToString } from './utils'
import pubsubErrors = require('libp2p-interfaces/src/pubsub/errors')

const { ERR_INVALID_SIGNATURE, ERR_MISSING_SIGNATURE } = pubsubErrors.codes

/**
 * IWantTracer is an internal tracer that tracks IWANT requests in order to penalize
 * peers who don't follow up on IWANT requests after an IHAVE advertisement.
 * The tracking of promises is probabilistic to avoid using too much memory.
 *
 * Note: Do not confuse these 'promises' with JS Promise objects.
 * These 'promises' are merely expectations of a peer's behavior.
 */
export class IWantTracer {
  /**
   * Promises to deliver a message
   * Map per message id, per peer, promise expiration time
   */
  promises = new Map<string, Map<string, number>>()

  /**
   * Track a promise to deliver a message from a list of msgIds we are requesting
   */
  addPromise(p: string, msgIds: Uint8Array[]): void {
    // pick msgId randomly from the list
    const ix = Math.floor(Math.random() * msgIds.length)
    const msgId = msgIds[ix]
    const msgIdStr = messageIdToString(msgId)

    let peers = this.promises.get(msgIdStr)
    if (!peers) {
      peers = new Map()
      this.promises.set(msgIdStr, peers)
    }

    if (!peers.has(p)) {
      peers.set(p, Date.now() + GossipsubIWantFollowupTime)
    }
  }

  /**
   * Returns the number of broken promises for each peer who didn't follow up on an IWANT request.
   */
  getBrokenPromises(): Map<string, number> {
    const now = Date.now()
    const result = new Map<string, number>()

    this.promises.forEach((peers, msgId) => {
      peers.forEach((expire, p) => {
        // the promise has been broken
        if (expire < now) {
          // add 1 to result
          result.set(p, (result.get(p) ?? 0) + 1)
          // delete from tracked promises
          peers.delete(p)
        }
      })
      // clean up empty promises for a msgId
      if (!peers.size) {
        this.promises.delete(msgId)
      }
    })

    return result
  }

  /**
   * Someone delivered a message, stop tracking promises for it
   */
  async deliverMessage(msgIdStr: string): Promise<void> {
    this.promises.delete(msgIdStr)
  }

  /**
   * A message got rejected, so we can stop tracking promises and let the score penalty apply from invalid message delivery,
   * unless its an obviously invalid message.
   */
  async rejectMessage(msgIdStr: string, reason: string): Promise<void> {
    switch (reason) {
      case ERR_INVALID_SIGNATURE:
      case ERR_MISSING_SIGNATURE:
        return
    }

    this.promises.delete(msgIdStr)
  }

  clear(): void {
    this.promises.clear()
  }
}

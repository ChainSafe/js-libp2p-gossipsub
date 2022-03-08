import { GossipsubIWantFollowupTime } from './constants'
import { messageIdToString } from './utils'
import { MsgIdStr, PeerIdStr, RejectReason } from './types'
import { PromiseDeliveredStats } from './metrics'

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
  private readonly promises = new Map<MsgIdStr, Map<PeerIdStr, number>>()

  get size(): number {
    return this.promises.size
  }

  /**
   * Track a promise to deliver a message from a list of msgIds we are requesting
   */
  addPromise(from: PeerIdStr, msgIds: Uint8Array[]): void {
    // pick msgId randomly from the list
    const ix = Math.floor(Math.random() * msgIds.length)
    const msgId = msgIds[ix]
    const msgIdStr = messageIdToString(msgId)

    let peers = this.promises.get(msgIdStr)
    if (!peers) {
      peers = new Map()
      this.promises.set(msgIdStr, peers)
    }

    // If a promise for this message id and peer already exists we don't update the expiry
    if (!peers.has(from)) {
      peers.set(from, Date.now() + GossipsubIWantFollowupTime)
    }
  }

  /**
   * Returns the number of broken promises for each peer who didn't follow up on an IWANT request.
   *
   * This should be called not too often relative to the expire times, since it iterates over the whole data.
   */
  getBrokenPromises(): Map<PeerIdStr, number> {
    const now = Date.now()
    const result = new Map<PeerIdStr, number>()

    this.promises.forEach((peers, msgId) => {
      peers.forEach((expire, p) => {
        // the promise has been broken
        if (expire < now) {
          // add 1 to result
          result.set(p, (result.get(p) || 0) + 1)
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
  deliverMessage(msgIdStr: MsgIdStr): PromiseDeliveredStats | null {
    const expireByPeer = this.promises.get(msgIdStr)
    if (!expireByPeer) {
      return null
    }

    this.promises.delete(msgIdStr)

    const now = Date.now()
    const deliversMs: number[] = []

    for (const expire of expireByPeer.values()) {
      // time_requested = expire - GossipsubIWantFollowupTime
      // time_elapsed = now - time_requested
      deliversMs.push(now - expire - GossipsubIWantFollowupTime)
    }

    return { requestedCount: expireByPeer.size, deliversMs }
  }

  /**
   * A message got rejected, so we can stop tracking promises and let the score penalty apply from invalid message delivery,
   * unless its an obviously invalid message.
   */
  rejectMessage(msgIdStr: MsgIdStr, reason: RejectReason): void {
    // A message got rejected, so we can stop tracking promises and let the score penalty apply.
    // With the expection of obvious invalid messages
    switch (reason) {
      case RejectReason.Error:
        return
    }

    this.promises.delete(msgIdStr)
  }

  clear(): void {
    this.promises.clear()
  }
}

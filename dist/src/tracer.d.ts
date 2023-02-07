import { MsgIdStr, MsgIdToStrFn, PeerIdStr, RejectReason } from './types.js';
import type { Metrics } from './metrics.js';
/**
 * IWantTracer is an internal tracer that tracks IWANT requests in order to penalize
 * peers who don't follow up on IWANT requests after an IHAVE advertisement.
 * The tracking of promises is probabilistic to avoid using too much memory.
 *
 * Note: Do not confuse these 'promises' with JS Promise objects.
 * These 'promises' are merely expectations of a peer's behavior.
 */
export declare class IWantTracer {
    private readonly gossipsubIWantFollowupMs;
    private readonly msgIdToStrFn;
    private readonly metrics;
    /**
     * Promises to deliver a message
     * Map per message id, per peer, promise expiration time
     */
    private readonly promises;
    /**
     * First request time by msgId. Used for metrics to track expire times.
     * Necessary to know if peers are actually breaking promises or simply sending them a bit later
     */
    private readonly requestMsByMsg;
    private readonly requestMsByMsgExpire;
    constructor(gossipsubIWantFollowupMs: number, msgIdToStrFn: MsgIdToStrFn, metrics: Metrics | null);
    get size(): number;
    get requestMsByMsgSize(): number;
    /**
     * Track a promise to deliver a message from a list of msgIds we are requesting
     */
    addPromise(from: PeerIdStr, msgIds: Uint8Array[]): void;
    /**
     * Returns the number of broken promises for each peer who didn't follow up on an IWANT request.
     *
     * This should be called not too often relative to the expire times, since it iterates over the whole data.
     */
    getBrokenPromises(): Map<PeerIdStr, number>;
    /**
     * Someone delivered a message, stop tracking promises for it
     */
    deliverMessage(msgIdStr: MsgIdStr, isDuplicate?: boolean): void;
    /**
     * A message got rejected, so we can stop tracking promises and let the score penalty apply from invalid message delivery,
     * unless its an obviously invalid message.
     */
    rejectMessage(msgIdStr: MsgIdStr, reason: RejectReason): void;
    clear(): void;
    prune(): void;
    private trackMessage;
}
//# sourceMappingURL=tracer.d.ts.map
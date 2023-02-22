import { PeerScoreParams } from './peer-score-params.js';
import type { PeerStats } from './peer-stats.js';
import { computeScore } from './compute-score.js';
import { MessageDeliveries } from './message-deliveries.js';
import { MsgIdStr, PeerIdStr, RejectReason, TopicStr } from '../types.js';
import type { Metrics, ScorePenalty } from '../metrics.js';
import { MapDef } from '../utils/set.js';
interface PeerScoreOpts {
    /**
     * Miliseconds to cache computed score per peer
     */
    scoreCacheValidityMs: number;
    computeScore?: typeof computeScore;
}
interface ScoreCacheEntry {
    /** The cached score */
    score: number;
    /** Unix timestamp in miliseconds, the time after which the cached score for a peer is no longer valid */
    cacheUntil: number;
}
export type PeerScoreStatsDump = Record<PeerIdStr, PeerStats>;
export declare class PeerScore {
    readonly params: PeerScoreParams;
    private readonly metrics;
    /**
     * Per-peer stats for score calculation
     */
    readonly peerStats: Map<string, PeerStats>;
    /**
     * IP colocation tracking; maps IP => set of peers.
     */
    readonly peerIPs: MapDef<string, Set<string>>;
    /**
     * Cache score up to decayInterval if topic stats are unchanged.
     */
    readonly scoreCache: Map<string, ScoreCacheEntry>;
    /**
     * Recent message delivery timing/participants
     */
    readonly deliveryRecords: MessageDeliveries;
    _backgroundInterval?: ReturnType<typeof setInterval>;
    private readonly scoreCacheValidityMs;
    private readonly computeScore;
    constructor(params: PeerScoreParams, metrics: Metrics | null, opts: PeerScoreOpts);
    get size(): number;
    /**
     * Start PeerScore instance
     */
    start(): void;
    /**
     * Stop PeerScore instance
     */
    stop(): void;
    /**
     * Periodic maintenance
     */
    background(): void;
    dumpPeerScoreStats(): PeerScoreStatsDump;
    /**
     * Decays scores, and purges score records for disconnected peers once their expiry has elapsed.
     */
    refreshScores(): void;
    /**
     * Return the score for a peer
     */
    score(id: PeerIdStr): number;
    /**
     * Apply a behavioural penalty to a peer
     */
    addPenalty(id: PeerIdStr, penalty: number, penaltyLabel: ScorePenalty): void;
    addPeer(id: PeerIdStr): void;
    /** Adds a new IP to a peer, if the peer is not known the update is ignored */
    addIP(id: PeerIdStr, ip: string): void;
    /** Remove peer association with IP */
    removeIP(id: PeerIdStr, ip: string): void;
    removePeer(id: PeerIdStr): void;
    /** Handles scoring functionality as a peer GRAFTs to a topic. */
    graft(id: PeerIdStr, topic: TopicStr): void;
    /** Handles scoring functionality as a peer PRUNEs from a topic. */
    prune(id: PeerIdStr, topic: TopicStr): void;
    validateMessage(msgIdStr: MsgIdStr): void;
    deliverMessage(from: PeerIdStr, msgIdStr: MsgIdStr, topic: TopicStr): void;
    /**
     * Similar to `rejectMessage` except does not require the message id or reason for an invalid message.
     */
    rejectInvalidMessage(from: PeerIdStr, topic: TopicStr): void;
    rejectMessage(from: PeerIdStr, msgIdStr: MsgIdStr, topic: TopicStr, reason: RejectReason): void;
    duplicateMessage(from: PeerIdStr, msgIdStr: MsgIdStr, topic: TopicStr): void;
    /**
     * Increments the "invalid message deliveries" counter for all scored topics the message is published in.
     */
    markInvalidMessageDelivery(from: PeerIdStr, topic: TopicStr): void;
    /**
     * Increments the "first message deliveries" counter for all scored topics the message is published in,
     * as well as the "mesh message deliveries" counter, if the peer is in the mesh for the topic.
     * Messages already known (with the seenCache) are counted with markDuplicateMessageDelivery()
     */
    markFirstMessageDelivery(from: PeerIdStr, topic: TopicStr): void;
    /**
     * Increments the "mesh message deliveries" counter for messages we've seen before,
     * as long the message was received within the P3 window.
     */
    markDuplicateMessageDelivery(from: PeerIdStr, topic: TopicStr, validatedTime?: number): void;
    /**
     * Removes an IP list from the tracking list for a peer.
     */
    private removeIPsForPeer;
    /**
     * Returns topic stats if they exist, otherwise if the supplied parameters score the
     * topic, inserts the default stats and returns a reference to those. If neither apply, returns None.
     */
    private getPtopicStats;
}
export {};
//# sourceMappingURL=peer-score.d.ts.map
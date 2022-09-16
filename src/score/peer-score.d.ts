/// <reference types="node" />
import { PeerScoreParams } from './peer-score-params';
import { PeerStats } from './peer-stats';
import { MessageDeliveries } from './message-deliveries';
import ConnectionManager from 'libp2p/src/connection-manager';
import { MsgIdStr, PeerIdStr, RejectReason, TopicStr } from '../types';
import { Metrics, ScorePenalty } from '../metrics';
declare type PeerScoreOpts = {
    /**
     * Miliseconds to cache computed score per peer
     */
    scoreCacheValidityMs: number;
};
interface ScoreCacheEntry {
    /** The cached score */
    score: number;
    /** Unix timestamp in miliseconds, the time after which the cached score for a peer is no longer valid */
    cacheUntil: number;
}
export declare type PeerScoreStatsDump = Record<PeerIdStr, PeerStats>;
export declare class PeerScore {
    readonly params: PeerScoreParams;
    private readonly connectionManager;
    private readonly metrics;
    /**
     * Per-peer stats for score calculation
     */
    readonly peerStats: Map<string, PeerStats>;
    /**
     * IP colocation tracking; maps IP => set of peers.
     */
    readonly peerIPs: Map<string, Set<string>>;
    /**
     * Cache score up to decayInterval if topic stats are unchanged.
     */
    readonly scoreCache: Map<string, ScoreCacheEntry>;
    /**
     * Recent message delivery timing/participants
     */
    readonly deliveryRecords: MessageDeliveries;
    _backgroundInterval?: NodeJS.Timeout;
    private readonly scoreCacheValidityMs;
    constructor(params: PeerScoreParams, connectionManager: ConnectionManager, metrics: Metrics | null, opts: PeerScoreOpts);
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
    private refreshScores;
    /**
     * Return the score for a peer
     */
    score(id: PeerIdStr): number;
    /**
     * Apply a behavioural penalty to a peer
     */
    addPenalty(id: PeerIdStr, penalty: number, penaltyLabel: ScorePenalty): void;
    addPeer(id: PeerIdStr): void;
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
    private markInvalidMessageDelivery;
    /**
     * Increments the "first message deliveries" counter for all scored topics the message is published in,
     * as well as the "mesh message deliveries" counter, if the peer is in the mesh for the topic.
     * Messages already known (with the seenCache) are counted with markDuplicateMessageDelivery()
     */
    private markFirstMessageDelivery;
    /**
     * Increments the "mesh message deliveries" counter for messages we've seen before,
     * as long the message was received within the P3 window.
     */
    private markDuplicateMessageDelivery;
    /**
     * Gets the current IPs for a peer.
     */
    private getIPs;
    /**
     * Adds tracking for the new IPs in the list, and removes tracking from the obsolete IPs.
     */
    private setIPs;
    /**
     * Removes an IP list from the tracking list for a peer.
     */
    private removeIPs;
    /**
     * Update all peer IPs to currently open connections
     */
    private updateIPs;
    /**
     * Returns topic stats if they exist, otherwise if the supplied parameters score the
     * topic, inserts the default stats and returns a reference to those. If neither apply, returns None.
     */
    private getPtopicStats;
}
export {};

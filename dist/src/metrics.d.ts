import { TopicValidatorResult } from '@libp2p/interface-pubsub';
import type { IRPC } from './message/rpc.js';
import type { PeerScoreThresholds } from './score/peer-score-thresholds.js';
import { MessageStatus, PeerIdStr, RejectReason, RejectReasonObj, TopicStr, ValidateError } from './types.js';
/** Topic label as provided in `topicStrToLabel` */
export type TopicLabel = string;
export type TopicStrToLabel = Map<TopicStr, TopicLabel>;
export declare enum MessageSource {
    forward = "forward",
    publish = "publish"
}
type LabelsGeneric = Record<string, string | undefined>;
type CollectFn<Labels extends LabelsGeneric> = (metric: Gauge<Labels>) => void;
interface Gauge<Labels extends LabelsGeneric = never> {
    inc(value?: number): void;
    inc(labels: Labels, value?: number): void;
    inc(arg1?: Labels | number, arg2?: number): void;
    set(value: number): void;
    set(labels: Labels, value: number): void;
    set(arg1?: Labels | number, arg2?: number): void;
    addCollect(collectFn: CollectFn<Labels>): void;
}
interface Histogram<Labels extends LabelsGeneric = never> {
    startTimer(): () => void;
    observe(value: number): void;
    observe(labels: Labels, values: number): void;
    observe(arg1: Labels | number, arg2?: number): void;
    reset(): void;
}
interface AvgMinMax<Labels extends LabelsGeneric = never> {
    set(values: number[]): void;
    set(labels: Labels, values: number[]): void;
    set(arg1?: Labels | number[], arg2?: number[]): void;
}
type GaugeConfig<Labels extends LabelsGeneric> = {
    name: string;
    help: string;
    labelNames?: keyof Labels extends string ? (keyof Labels)[] : undefined;
};
type HistogramConfig<Labels extends LabelsGeneric> = {
    name: string;
    help: string;
    labelNames?: (keyof Labels)[];
    buckets?: number[];
};
type AvgMinMaxConfig<Labels extends LabelsGeneric> = GaugeConfig<Labels>;
export interface MetricsRegister {
    gauge<T extends LabelsGeneric>(config: GaugeConfig<T>): Gauge<T>;
    histogram<T extends LabelsGeneric>(config: HistogramConfig<T>): Histogram<T>;
    avgMinMax<T extends LabelsGeneric>(config: AvgMinMaxConfig<T>): AvgMinMax<T>;
}
export declare enum InclusionReason {
    /** Peer was a fanaout peer. */
    Fanout = "fanout",
    /** Included from random selection. */
    Random = "random",
    /** Peer subscribed. */
    Subscribed = "subscribed",
    /** On heartbeat, peer was included to fill the outbound quota. */
    Outbound = "outbound",
    /** On heartbeat, not enough peers in mesh */
    NotEnough = "not_enough",
    /** On heartbeat opportunistic grafting due to low mesh score */
    Opportunistic = "opportunistic"
}
export declare enum ChurnReason {
    Dc = "disconnected",
    BadScore = "bad_score",
    Prune = "prune",
    Unsub = "unsubscribed",
    Excess = "excess"
}
export declare enum ScorePenalty {
    GraftBackoff = "graft_backoff",
    BrokenPromise = "broken_promise",
    MessageDeficit = "message_deficit",
    IPColocation = "IP_colocation"
}
export declare enum IHaveIgnoreReason {
    LowScore = "low_score",
    MaxIhave = "max_ihave",
    MaxIasked = "max_iasked"
}
export declare enum ScoreThreshold {
    graylist = "graylist",
    publish = "publish",
    gossip = "gossip",
    mesh = "mesh"
}
export type PeersByScoreThreshold = Record<ScoreThreshold, number>;
export type ToSendGroupCount = {
    direct: number;
    floodsub: number;
    mesh: number;
    fanout: number;
};
export type ToAddGroupCount = {
    fanout: number;
    random: number;
};
export type PromiseDeliveredStats = {
    expired: false;
    requestedCount: number;
    maxDeliverMs: number;
} | {
    expired: true;
    maxDeliverMs: number;
};
export type TopicScoreWeights<T> = {
    p1w: T;
    p2w: T;
    p3w: T;
    p3bw: T;
    p4w: T;
};
export type ScoreWeights<T> = {
    byTopic: Map<TopicLabel, TopicScoreWeights<T>>;
    p5w: T;
    p6w: T;
    p7w: T;
    score: T;
};
export type Metrics = ReturnType<typeof getMetrics>;
/**
 * A collection of metrics used throughout the Gossipsub behaviour.
 */
export declare function getMetrics(register: MetricsRegister, topicStrToLabel: TopicStrToLabel, opts: {
    gossipPromiseExpireSec: number;
    behaviourPenaltyThreshold: number;
    maxMeshMessageDeliveriesWindowSec: number;
}): {
    protocolsEnabled: Gauge<{
        protocol: string;
    }>;
    /** Status of our subscription to this topic. This metric allows analyzing other topic metrics
     *  filtered by our current subscription status.
     *  = rust-libp2p `topic_subscription_status` */
    topicSubscriptionStatus: Gauge<{
        topicStr: TopicStr;
    }>;
    /** Number of peers subscribed to each topic. This allows us to analyze a topic's behaviour
     * regardless of our subscription status. */
    topicPeersCount: Gauge<{
        topicStr: TopicStr;
    }>;
    /** Number of peers in our mesh. This metric should be updated with the count of peers for a
     *  topic in the mesh regardless of inclusion and churn events.
     *  = rust-libp2p `mesh_peer_counts` */
    meshPeerCounts: Gauge<{
        topicStr: TopicStr;
    }>;
    /** Number of times we include peers in a topic mesh for different reasons.
     *  = rust-libp2p `mesh_peer_inclusion_events` */
    meshPeerInclusionEvents: Gauge<{
        topic: TopicLabel;
        reason: InclusionReason;
    }>;
    /** Number of times we remove peers in a topic mesh for different reasons.
     *  = rust-libp2p `mesh_peer_churn_events` */
    meshPeerChurnEvents: Gauge<{
        topic: TopicLabel;
        reason: ChurnReason;
    }>;
    /** Gossipsub supports floodsub, gossipsub v1.0 and gossipsub v1.1. Peers are classified based
     *  on which protocol they support. This metric keeps track of the number of peers that are
     *  connected of each type. */
    peersPerProtocol: Gauge<{
        protocol: string;
    }>;
    /** The time it takes to complete one iteration of the heartbeat. */
    heartbeatDuration: Histogram<LabelsGeneric>;
    /** Heartbeat run took longer than heartbeat interval so next is skipped */
    heartbeatSkipped: Gauge<LabelsGeneric>;
    /** Message validation results for each topic.
     *  Invalid == Reject?
     *  = rust-libp2p `invalid_messages`, `accepted_messages`, `ignored_messages`, `rejected_messages` */
    asyncValidationResult: Gauge<{
        topic: TopicLabel;
        acceptance: TopicValidatorResult;
    }>;
    /** When the user validates a message, it tries to re propagate it to its mesh peers. If the
     *  message expires from the memcache before it can be validated, we count this a cache miss
     *  and it is an indicator that the memcache size should be increased.
     *  = rust-libp2p `mcache_misses` */
    asyncValidationMcacheHit: Gauge<{
        hit: 'hit' | 'miss';
    }>;
    peerReadStreamError: Gauge<LabelsGeneric>;
    rpcRecvBytes: Gauge<LabelsGeneric>;
    rpcRecvCount: Gauge<LabelsGeneric>;
    rpcRecvSubscription: Gauge<LabelsGeneric>;
    rpcRecvMessage: Gauge<LabelsGeneric>;
    rpcRecvControl: Gauge<LabelsGeneric>;
    rpcRecvIHave: Gauge<LabelsGeneric>;
    rpcRecvIWant: Gauge<LabelsGeneric>;
    rpcRecvGraft: Gauge<LabelsGeneric>;
    rpcRecvPrune: Gauge<LabelsGeneric>;
    rpcDataError: Gauge<LabelsGeneric>;
    rpcRecvError: Gauge<LabelsGeneric>;
    /** Total count of RPC dropped because acceptFrom() == false */
    rpcRecvNotAccepted: Gauge<LabelsGeneric>;
    rpcSentBytes: Gauge<LabelsGeneric>;
    rpcSentCount: Gauge<LabelsGeneric>;
    rpcSentSubscription: Gauge<LabelsGeneric>;
    rpcSentMessage: Gauge<LabelsGeneric>;
    rpcSentControl: Gauge<LabelsGeneric>;
    rpcSentIHave: Gauge<LabelsGeneric>;
    rpcSentIWant: Gauge<LabelsGeneric>;
    rpcSentGraft: Gauge<LabelsGeneric>;
    rpcSentPrune: Gauge<LabelsGeneric>;
    /** Total count of msg published by topic */
    msgPublishCount: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total count of peers that we publish a msg to */
    msgPublishPeers: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total count of peers (by group) that we publish a msg to */
    msgPublishPeersByGroup: Gauge<{
        topic: TopicLabel;
        peerGroup: keyof ToSendGroupCount;
    }>;
    /** Total count of msg publish data.length bytes */
    msgPublishBytes: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total count of msg forwarded by topic */
    msgForwardCount: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total count of peers that we forward a msg to */
    msgForwardPeers: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total count of recv msgs before any validation */
    msgReceivedPreValidation: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total count of recv msgs error */
    msgReceivedError: Gauge<{
        topic: TopicLabel;
    }>;
    /** Tracks distribution of recv msgs by duplicate, invalid, valid */
    msgReceivedStatus: Gauge<{
        topic: TopicLabel;
        status: MessageStatus;
    }>;
    /** Tracks specific reason of invalid */
    msgReceivedInvalid: Gauge<{
        topic: TopicLabel;
        error: RejectReason | ValidateError;
    }>;
    /** Track duplicate message delivery time */
    duplicateMsgDeliveryDelay: Histogram<LabelsGeneric>;
    /** Total count of late msg delivery total by topic */
    duplicateMsgLateDelivery: Gauge<{
        topic: TopicLabel;
    }>;
    duplicateMsgIgnored: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total times score() is called */
    scoreFnCalls: Gauge<LabelsGeneric>;
    /** Total times score() call actually computed computeScore(), no cache */
    scoreFnRuns: Gauge<LabelsGeneric>;
    scoreCachedDelta: Histogram<LabelsGeneric>;
    /** Current count of peers by score threshold */
    peersByScoreThreshold: Gauge<{
        threshold: ScoreThreshold;
    }>;
    score: AvgMinMax<LabelsGeneric>;
    /** Separate score weights */
    scoreWeights: AvgMinMax<{
        topic?: string | undefined;
        p: string;
    }>;
    /** Histogram of the scores for each mesh topic. */
    scorePerMesh: AvgMinMax<{
        topic: TopicLabel;
    }>;
    /** A counter of the kind of penalties being applied to peers. */
    scoringPenalties: Gauge<{
        penalty: ScorePenalty;
    }>;
    behaviourPenalty: Histogram<LabelsGeneric>;
    /** Total received IHAVE messages that we ignore for some reason */
    ihaveRcvIgnored: Gauge<{
        reason: IHaveIgnoreReason;
    }>;
    /** Total received IHAVE messages by topic */
    ihaveRcvMsgids: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total messages per topic we don't have. Not actual requests.
     *  The number of times we have decided that an IWANT control message is required for this
     *  topic. A very high metric might indicate an underperforming network.
     *  = rust-libp2p `topic_iwant_msgs` */
    ihaveRcvNotSeenMsgids: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total received IWANT messages by topic */
    iwantRcvMsgids: Gauge<{
        topic: TopicLabel;
    }>;
    /** Total requested messageIDs that we don't have */
    iwantRcvDonthaveMsgids: Gauge<LabelsGeneric>;
    iwantPromiseStarted: Gauge<LabelsGeneric>;
    /** Total count of resolved IWANT promises */
    iwantPromiseResolved: Gauge<LabelsGeneric>;
    /** Total count of resolved IWANT promises from duplicate messages */
    iwantPromiseResolvedFromDuplicate: Gauge<LabelsGeneric>;
    /** Total count of peers we have asked IWANT promises that are resolved */
    iwantPromiseResolvedPeers: Gauge<LabelsGeneric>;
    iwantPromiseBroken: Gauge<LabelsGeneric>;
    iwantMessagePruned: Gauge<LabelsGeneric>;
    /** Histogram of delivery time of resolved IWANT promises */
    iwantPromiseDeliveryTime: Histogram<LabelsGeneric>;
    iwantPromiseUntracked: Gauge<LabelsGeneric>;
    /** Unbounded cache sizes */
    cacheSize: Gauge<{
        cache: string;
    }>;
    /** Current mcache msg count */
    mcacheSize: Gauge<LabelsGeneric>;
    mcacheNotValidatedCount: Gauge<LabelsGeneric>;
    fastMsgIdCacheCollision: Gauge<LabelsGeneric>;
    newConnectionCount: Gauge<{
        status: string;
    }>;
    topicStrToLabel: TopicStrToLabel;
    toTopic(topicStr: TopicStr): TopicLabel;
    /** We joined a topic */
    onJoin(topicStr: TopicStr): void;
    /** We left a topic */
    onLeave(topicStr: TopicStr): void;
    /** Register the inclusion of peers in our mesh due to some reason. */
    onAddToMesh(topicStr: TopicStr, reason: InclusionReason, count: number): void;
    /** Register the removal of peers in our mesh due to some reason */
    onRemoveFromMesh(topicStr: TopicStr, reason: ChurnReason, count: number): void;
    onReportValidationMcacheHit(hit: boolean): void;
    onReportValidation(topicStr: TopicStr, acceptance: TopicValidatorResult): void;
    /**
     * - in handle_graft() Penalty::GraftBackoff
     * - in apply_iwant_penalties() Penalty::BrokenPromise
     * - in metric_score() P3 Penalty::MessageDeficit
     * - in metric_score() P6 Penalty::IPColocation
     */
    onScorePenalty(penalty: ScorePenalty): void;
    onIhaveRcv(topicStr: TopicStr, ihave: number, idonthave: number): void;
    onIwantRcv(iwantByTopic: Map<TopicStr, number>, iwantDonthave: number): void;
    onForwardMsg(topicStr: TopicStr, tosendCount: number): void;
    onPublishMsg(topicStr: TopicStr, tosendGroupCount: ToSendGroupCount, tosendCount: number, dataLen: number): void;
    onMsgRecvPreValidation(topicStr: TopicStr): void;
    onMsgRecvError(topicStr: TopicStr): void;
    onMsgRecvResult(topicStr: TopicStr, status: MessageStatus): void;
    onMsgRecvInvalid(topicStr: TopicStr, reason: RejectReasonObj): void;
    onDuplicateMsgDelivery(topicStr: TopicStr, deliveryDelayMs: number, isLateDelivery: boolean): void;
    onPublishDuplicateMsg(topicStr: TopicStr): void;
    onPeerReadStreamError(): void;
    onRpcRecvError(): void;
    onRpcDataError(): void;
    onRpcRecv(rpc: IRPC, rpcBytes: number): void;
    onRpcSent(rpc: IRPC, rpcBytes: number): void;
    registerScores(scores: number[], scoreThresholds: PeerScoreThresholds): void;
    registerScoreWeights(sw: ScoreWeights<number[]>): void;
    registerScorePerMesh(mesh: Map<TopicStr, Set<PeerIdStr>>, scoreByPeer: Map<PeerIdStr, number>): void;
};
export {};
//# sourceMappingURL=metrics.d.ts.map
import { IRPC } from './message/rpc'
import { PeerScoreThresholds } from './score/peer-score-thresholds'
import { MessageAcceptance, MessageStatus, RejectReason, RejectReasonObj, TopicStr, ValidateError } from './types'

/** Topic label as provided in `topicStrToLabel` */
export type TopicLabel = string
export type TopicStrToLabel = Map<TopicStr, TopicLabel>

export enum MessageSource {
  forward = 'forward',
  publish = 'publish',
}

type LabelsGeneric = Record<string, string | undefined>
type CollectFn<Labels extends LabelsGeneric> = (metric: Gauge<Labels>) => void

interface Gauge<Labels extends LabelsGeneric = never> {
  // Sorry for this mess, `prom-client` API choices are not great
  // If the function signature was `inc(value: number, labels?: Labels)`, this would be simpler
  inc(value?: number): void
  inc(labels: Labels, value?: number): void
  inc(arg1?: Labels | number, arg2?: number): void

  set(value: number): void
  set(labels: Labels, value: number): void
  set(arg1?: Labels | number, arg2?: number): void

  addCollect(collectFn: CollectFn<Labels>): void
}

interface Histogram<Labels extends LabelsGeneric = never> {
  startTimer(): () => void

  observe(value: number): void
  observe(labels: Labels, values: number): void
  observe(arg1: Labels | number, arg2?: number): void
}

interface AvgMinMax<Labels extends LabelsGeneric = never> {
  set(values: number[]): void
  set(labels: Labels, values: number[]): void
  set(arg1?: Labels | number[], arg2?: number[]): void
}

type GaugeConfig<Labels extends LabelsGeneric> = {
  name: string
  help: string
  labelNames?: keyof Labels extends string ? (keyof Labels)[] : undefined
}

type HistogramConfig<Labels extends LabelsGeneric> = {
  name: string
  help: string
  labelNames?: (keyof Labels)[]
  buckets?: number[]
}

type AvgMinMaxConfig<Labels extends LabelsGeneric> = GaugeConfig<Labels>

export interface MetricsRegister {
  gauge<T extends LabelsGeneric>(config: GaugeConfig<T>): Gauge<T>
  histogram<T extends LabelsGeneric>(config: HistogramConfig<T>): Histogram<T>
  avgMinMax<T extends LabelsGeneric>(config: AvgMinMaxConfig<T>): AvgMinMax<T>
}

export enum InclusionReason {
  /// Peer was a fanaout peer.
  Fanout = 'fanout',
  /// Included from random selection.
  Random = 'random',
  /// Peer subscribed.
  Subscribed = 'subscribed',
  /// Peer was included to fill the outbound quota.
  Outbound = 'outbound',
}

/// Reasons why a peer was removed from the mesh.
export enum ChurnReason {
  /// Peer disconnected.
  Dc = 'disconnected',
  /// Peer had a bad score.
  BadScore = 'bad_score',
  /// Peer sent a PRUNE.
  Prune = 'prune',
  /// Peer unsubscribed.
  Unsub = 'unsubscribed',
  /// Too many peers.
  Excess = 'excess',
}

/// Kinds of reasons a peer's score has been penalized
export enum ScorePenalty {
  /// A peer grafted before waiting the back-off time.
  GraftBackoff = 'graft_backoff',
  /// A Peer did not respond to an IWANT request in time.
  BrokenPromise = 'broken_promise',
  /// A Peer did not send enough messages as expected.
  MessageDeficit = 'message_deficit',
  /// Too many peers under one IP address.
  IPColocation = 'IP_colocation',
}

enum PeerKind {
  /// A gossipsub 1.1 peer.
  Gossipsubv11 = 'gossipsub_v1.1',
  /// A gossipsub 1.0 peer.
  Gossipsub = 'gossipsub_v1.0',
  /// A floodsub peer.
  Floodsub = 'floodsub',
  /// The peer doesn't support any of the protocols.
  NotSupported = 'not_supported',
}

export enum IHaveIgnoreReason {
  LowScore = 'low_score',
  MaxIhave = 'max_ihave',
  MaxIasked = 'max_iasked',
}

export enum ScoreThreshold {
  graylist = 'graylist',
  publish = 'publish',
  gossip = 'gossip',
  mesh = 'mesh',
}

export type PeersByScoreThreshold = Record<ScoreThreshold, number>

export type ToSendGroupCount = {
  direct: number
  floodsub: number
  mesh: number
  fanout: number
}

export type ToAddGroupCount = {
  fanout: number
  random: number
}

export type PromiseDeliveredStats = {
  requestedCount: number
  deliversMs: number[]
}

export type TopicScoreWeights<T> = { p1w: T; p2w: T; p3w: T; p3bw: T; p4w: T }
export type ScoreWeights<T> = {
  byTopic: Map<TopicLabel, TopicScoreWeights<T>>
  p5w: T
  p6w: T
  p7w: T
  score: T
}

export type Metrics = ReturnType<typeof getMetrics>

/**
 * A collection of metrics used throughout the Gossipsub behaviour.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getMetrics(register: MetricsRegister, topicStrToLabel: TopicStrToLabel) {
  // Using function style instead of class to prevent having to re-declare all MetricsPrometheus types.

  return {
    /* Metrics for static config */
    protocolsEnabled: register.gauge<{ protocol: string }>({
      name: 'gossipsub_protocol',
      help: 'Status of enabled protocols',
      labelNames: ['protocol'],
    }),

    /* Metrics per known topic */
    /** Status of our subscription to this topic. This metric allows analyzing other topic metrics
     *  filtered by our current subscription status.
     *  = rust-libp2p `topic_subscription_status` */
    topicSubscriptionStatus: register.gauge<{ topicStr: TopicStr }>({
      name: 'gossipsub_topic_subscription_status',
      help: 'Status of our subscription to this topic',
      labelNames: ['topicStr'],
    }),
    /** Number of peers subscribed to each topic. This allows us to analyze a topic's behaviour
     * regardless of our subscription status. */
    topicPeersCount: register.gauge<{ topicStr: TopicStr }>({
      name: 'gossipsub_topic_peer_count',
      help: 'Number of peers subscribed to each topic',
      labelNames: ['topicStr'],
    }),

    /* Metrics regarding mesh state */
    /** Number of peers in our mesh. This metric should be updated with the count of peers for a
     *  topic in the mesh regardless of inclusion and churn events.
     *  = rust-libp2p `mesh_peer_counts` */
    meshPeerCounts: register.gauge<{ topicStr: TopicStr }>({
      name: 'gossipsub_mesh_peer_count',
      help: 'Number of peers in our mesh',
      labelNames: ['topicStr'],
    }),
    /** Number of times we include peers in a topic mesh for different reasons.
     *  = rust-libp2p `mesh_peer_inclusion_events` */
    meshPeerInclusionEvents: register.gauge<{ topic: TopicLabel; reason: InclusionReason }>({
      name: 'gossipsub_mesh_peer_inclusion_events_total',
      help: 'Number of times we include peers in a topic mesh for different reasons',
      labelNames: ['topic', 'reason'],
    }),
    /** Number of times we remove peers in a topic mesh for different reasons.
     *  = rust-libp2p `mesh_peer_churn_events` */
    meshPeerChurnEvents: register.gauge<{ topic: TopicLabel; reason: ChurnReason }>({
      name: 'gossipsub_peer_churn_events_total',
      help: 'Number of times we remove peers in a topic mesh for different reasons',
      labelNames: ['topic', 'reason'],
    }),

    /* General Metrics */
    /// Gossipsub supports floodsub, gossipsub v1.0 and gossipsub v1.1. Peers are classified based
    /// on which protocol they support. This metric keeps track of the number of peers that are
    /// connected of each type.
    peersPerProtocol: register.gauge<{ protocol: PeerKind }>({
      name: 'gossipsub_peers_per_protocol_count',
      help: 'Peers connected for each topic',
      labelNames: ['protocol'],
    }),
    /// The time it takes to complete one iteration of the heartbeat.
    heartbeatDuration: register.histogram({
      name: 'gossipsub_heartbeat_duration',
      help: 'The time it takes to complete one iteration of the heartbeat',
    }),

    /** Message validation results for each topic.
     *  Invalid == Reject?
     *  = rust-libp2p `invalid_messages`, `accepted_messages`, `ignored_messages`, `rejected_messages` */
    asyncValidationResult: register.gauge<{ topic: TopicLabel; acceptance: MessageAcceptance }>({
      name: 'gossipsub_async_validation_result_total',
      help: 'Message validation result for each topic',
      labelNames: ['topic', 'acceptance'],
    }),
    /** When the user validates a message, it tries to re propagate it to its mesh peers. If the
     *  message expires from the memcache before it can be validated, we count this a cache miss
     *  and it is an indicator that the memcache size should be increased.
     *  = rust-libp2p `mcache_misses` */
    asyncValidationMcacheHit: register.gauge<{ hit: 'hit' | 'miss' }>({
      name: 'gossipsub_async_validation_mcache_hit_total',
      help: 'Async validation result reported by the user layer',
      labelNames: ['hit'],
    }),

    // RPC outgoing. Track byte length + data structure sizes
    rpcRecvBytes: register.gauge({ name: 'gossipsub_rpc_recv_bytes_total', help: 'RPC recv' }),
    rpcRecvCount: register.gauge({ name: 'gossipsub_rpc_recv_count_total', help: 'RPC recv' }),
    rpcRecvSubscription: register.gauge({ name: 'gossipsub_rcp_recv_subscription_total', help: 'RPC recv' }),
    rpcRecvMessage: register.gauge({ name: 'gossipsub_rcp_recv_message_total', help: 'RPC recv' }),
    rpcRecvControl: register.gauge({ name: 'gossipsub_rcp_recv_control_total', help: 'RPC recv' }),
    rpcRecvIHave: register.gauge({ name: 'gossipsub_rcp_recv_ihave_total', help: 'RPC recv' }),
    rpcRecvIWant: register.gauge({ name: 'gossipsub_rcp_recv_iwant_total', help: 'RPC recv' }),
    rpcRecvGraft: register.gauge({ name: 'gossipsub_rcp_recv_graft_total', help: 'RPC recv' }),
    rpcRecvPrune: register.gauge({ name: 'gossipsub_rcp_recv_prune_total', help: 'RPC recv' }),

    /** Total count of RPC dropped because acceptFrom() == false */
    rpcRecvNotAccepted: register.gauge({
      name: 'gossipsub_rpc_rcv_not_accepted_total',
      help: 'Total count of RPC dropped because acceptFrom() == false',
    }),

    // RPC incoming. Track byte length + data structure sizes
    rpcSentBytes: register.gauge({ name: 'gossipsub_rpc_sent_bytes_total', help: 'RPC sent' }),
    rpcSentCount: register.gauge({ name: 'gossipsub_rpc_sent_count_total', help: 'RPC sent' }),
    rpcSentSubscription: register.gauge({ name: 'gossipsub_rcp_sent_subscription_total', help: 'RPC sent' }),
    rpcSentMessage: register.gauge({ name: 'gossipsub_rcp_sent_message_total', help: 'RPC sent' }),
    rpcSentControl: register.gauge({ name: 'gossipsub_rcp_sent_control_total', help: 'RPC sent' }),
    rpcSentIHave: register.gauge({ name: 'gossipsub_rcp_sent_ihave_total', help: 'RPC sent' }),
    rpcSentIWant: register.gauge({ name: 'gossipsub_rcp_sent_iwant_total', help: 'RPC sent' }),
    rpcSentGraft: register.gauge({ name: 'gossipsub_rcp_sent_graft_total', help: 'RPC sent' }),
    rpcSentPrune: register.gauge({ name: 'gossipsub_rcp_sent_prune_total', help: 'RPC sent' }),

    // publish message. Track peers sent to and bytes
    /** Total count of msg published by topic */
    msgPublishCount: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_publish_count_total',
      help: 'Total count of msg published by topic',
      labelNames: ['topic'],
    }),
    /** Total count of peers that we publish a msg to */
    msgPublishPeers: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_publish_peers_total',
      help: 'Total count of peers that we publish a msg to',
      labelNames: ['topic'],
    }),
    /** Total count of peers (by group) that we publish a msg to */
    msgPublishPeersByGroup: register.gauge<{ topic: TopicLabel; group: keyof ToSendGroupCount }>({
      name: 'gossipsub_msg_publish_peers_by_group',
      help: 'Total count of peers (by group) that we publish a msg to',
      labelNames: ['topic', 'group'],
    }),
    /** Total count of msg publish data.length bytes */
    msgPublishBytes: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_publish_bytes_total',
      help: 'Total count of msg publish data.length bytes',
      labelNames: ['topic'],
    }),

    /** Total count of msg forwarded by topic */
    msgForwardCount: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_forward_count_total',
      help: 'Total count of msg forwarded by topic',
      labelNames: ['topic'],
    }),
    /** Total count of peers that we forward a msg to */
    msgForwardPeers: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_forward_peers_total',
      help: 'Total count of peers that we forward a msg to',
      labelNames: ['topic'],
    }),

    /** Total count of recv msgs before any validation */
    msgReceivedPreValidation: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_received_prevalidation_total',
      help: 'Total count of recv msgs before any validation',
      labelNames: ['topic'],
    }),
    /** Tracks distribution of recv msgs by duplicate, invalid, valid */
    msgReceivedStatus: register.gauge<{ topic: TopicLabel; status: MessageStatus }>({
      name: 'gossipsub_msg_received_status_total',
      help: 'Tracks distribution of recv msgs by duplicate, invalid, valid',
      labelNames: ['topic', 'status'],
    }),
    /** Tracks specific reason of invalid */
    msgReceivedInvalid: register.gauge<{ topic: TopicLabel; error: RejectReason | ValidateError }>({
      name: 'gossipsub_msg_received_invalid_total',
      help: 'Tracks specific reason of invalid',
      labelNames: ['topic', 'error'],
    }),

    /* Metrics related to scoring */
    /** Total times score() is called */
    scoreFnCalls: register.gauge({
      name: 'gossipsub_score_fn_calls_total',
      help: 'Total times score() is called',
    }),
    /** Total times score() call actually computed computeScore(), no cache */
    scoreFnRuns: register.gauge({
      name: 'gossipsub_score_fn_runs_total',
      help: 'Total times score() call actually computed computeScore(), no cache',
    }),
    /** Current count of peers by score threshold */
    peersByScoreThreshold: register.gauge<{ threshold: ScoreThreshold }>({
      name: 'gossipsub_peers_by_score_threshold_count',
      help: 'Current count of peers by score threshold',
      labelNames: ['threshold'],
    }),
    score: register.avgMinMax({
      name: 'gossipsub_score',
      help: 'Avg min max of gossip scores',
      labelNames: ['topic', 'p'],
    }),
    /** Separate score weights */
    scoreWeights: register.avgMinMax<{ topic?: TopicLabel; p: string }>({
      name: 'gossipsub_score_weights',
      help: 'Separate score weights',
      labelNames: ['topic', 'p'],
    }),
    /** Histogram of the scores for each mesh topic. */
    // TODO: Not implemented
    scorePerMesh: register.histogram<{ topic: TopicLabel }>({
      name: 'gossipsub_score_per_mesh',
      help: 'Histogram of the scores for each mesh topic',
      labelNames: ['topic'],
    }),
    /** A counter of the kind of penalties being applied to peers. */
    // TODO: Not fully implemented
    scoringPenalties: register.gauge<{ penalty: ScorePenalty }>({
      name: 'gossipsub_scoring_penalties_total',
      help: 'A counter of the kind of penalties being applied to peers',
      labelNames: ['penalty'],
    }),

    // TODO:
    // - iasked per peer (on heartbeat)
    // - when promise is resolved, track messages from promises

    /** Total received IHAVE messages that we ignore for some reason */
    ihaveRcvIgnored: register.gauge<{ reason: IHaveIgnoreReason }>({
      name: 'gossipsub_ihave_rcv_ignored_total',
      help: 'Total received IHAVE messages that we ignore for some reason',
      labelNames: ['reason'],
    }),
    /** Total received IHAVE messages by topic */
    ihaveRcv: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_ihave_rcv_total',
      help: 'Total received IHAVE messages by topic',
      labelNames: ['topic'],
    }),
    /** Total messages per topic we don't have. Not actual requests.
     *  The number of times we have decided that an IWANT control message is required for this
     *  topic. A very high metric might indicate an underperforming network.
     *  = rust-libp2p `topic_iwant_msgs` */
    ihaveRcvNotSeenMsg: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_ihave_rcv_not_seen_msg_total',
      help: 'Total messages per topic we do not have, not actual requests',
      labelNames: ['topic'],
    }),

    /** Total received IWANT messages by topic */
    iwantRcv: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_iwant_rcv_total',
      help: 'Total received IWANT messages by topic',
      labelNames: ['topic'],
    }),
    /** Total requested messageIDs that we don't have */
    iwantRcvDonthave: register.gauge({
      name: 'gossipsub_iwant_rcv_dont_have_total',
      help: 'Total requested messageIDs that we do not have',
    }),
    /** Total count of resolved IWANT promises */
    iwantPromiseResolved: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_iwant_promise_resolved_total',
      help: 'Total count of resolved IWANT promises',
      labelNames: ['topic'],
    }),
    /** Total count of peers we have asked IWANT promises that are resolved */
    iwantPromiseResolvedPeers: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_iwant_promise_resolved_peers',
      help: 'Total count of peers we have asked IWANT promises that are resolved',
      labelNames: ['topic'],
    }),
    /** Histogram of delivery time of resolved IWANT promises */
    iwantPromiseResolvedDeliveryTime: register.histogram<{ topic: TopicLabel }>({
      name: 'gossipsub_iwant_promise_resolved_delivery_time',
      help: 'Histogram of delivery time of resolved IWANT promises',
      labelNames: ['topic'],
    }),

    /* Data structure sizes */
    /** Unbounded cache sizes */
    cacheSize: register.gauge<{ cache: string }>({
      name: 'gossipsub_cache_size',
      help: 'Unbounded cache sizes',
      labelNames: ['cache'],
    }),
    /** Current mcache msg count */
    mcacheSize: register.gauge({
      name: 'gossipsub_mcache_size',
      help: 'Current mcache msg count',
    }),

    topicStrToLabel: topicStrToLabel,

    toTopic(topicStr: TopicStr): TopicLabel {
      return this.topicStrToLabel.get(topicStr) ?? topicStr
    },

    /** We joined a topic */
    onJoin(topicStr: TopicStr): void {
      this.topicSubscriptionStatus.set({ topicStr }, 1)
      this.meshPeerCounts.set({ topicStr }, 0) // Reset count
    },

    /** We left a topic */
    onLeave(topicStr: TopicStr): void {
      this.topicSubscriptionStatus.set({ topicStr }, 0)
      this.meshPeerCounts.set({ topicStr }, 0) // Reset count
    },

    /** Register the inclusion of peers in our mesh due to some reason. */
    onAddToMesh(topicStr: TopicStr, reason: InclusionReason, count: number): void {
      const topic = this.toTopic(topicStr)
      this.meshPeerInclusionEvents.inc({ topic, reason }, count)
    },

    /** Register the removal of peers in our mesh due to some reason */
    // - remove_peer_from_mesh()
    // - heartbeat() Churn::BadScore
    // - heartbeat() Churn::Excess
    // - on_disconnect() Churn::Ds
    onRemoveFromMesh(topicStr: TopicStr, reason: ChurnReason, count: number): void {
      const topic = this.toTopic(topicStr)
      this.meshPeerChurnEvents.inc({ topic, reason }, count)
    },

    onResolvedPromise(topicStr: string, stats: PromiseDeliveredStats): void {
      const topic = this.toTopic(topicStr)
      this.iwantPromiseResolved.inc({ topic }, 1)
      this.iwantPromiseResolvedPeers.inc({ topic }, stats.requestedCount)
      for (const deliverMs of stats.deliversMs) {
        this.iwantPromiseResolvedDeliveryTime.observe({ topic }, deliverMs)
      }
    },

    onReportValidationMcacheHit(hit: boolean): void {
      this.asyncValidationMcacheHit.inc({ hit: hit ? 'hit' : 'miss' })
    },

    onReportValidation(topicStr: TopicStr, acceptance: MessageAcceptance): void {
      const topic = this.toTopic(topicStr)
      this.asyncValidationResult.inc({ topic: topic, acceptance })
    },

    /**
     * - in handle_graft() Penalty::GraftBackoff
     * - in apply_iwant_penalties() Penalty::BrokenPromise
     * - in metric_score() P3 Penalty::MessageDeficit
     * - in metric_score() P6 Penalty::IPColocation
     */
    onScorePenalty(penalty: ScorePenalty): void {
      // Can this be labeled by topic too?
      this.scoringPenalties.inc({ penalty }, 1)
    },

    onIhaveRcv(topicStr: TopicStr, ihave: number, idonthave: number): void {
      const topic = this.toTopic(topicStr)
      this.ihaveRcv.inc({ topic }, ihave)
      this.ihaveRcvNotSeenMsg.inc({ topic }, idonthave)
    },

    onIwantRcv(iwantByTopic: Map<TopicStr, number>, iwantDonthave: number): void {
      for (const [topicStr, iwant] of iwantByTopic) {
        const topic = this.toTopic(topicStr)
        this.iwantRcv.inc({ topic }, iwant)
      }

      this.iwantRcvDonthave.inc(iwantDonthave)
    },

    onForwardMsg(topicStr: TopicStr, tosendCount: number): void {
      const topic = this.toTopic(topicStr)
      this.msgForwardCount.inc({ topic }, 1)
      this.msgForwardPeers.inc({ topic }, tosendCount)
    },

    onPublishMsg(topicStr: TopicStr, tosendGroupCount: ToSendGroupCount, tosendCount: number, dataLen: number): void {
      const topic = this.toTopic(topicStr)
      this.msgPublishCount.inc({ topic }, 1)
      this.msgPublishBytes.inc({ topic }, tosendCount * dataLen)
      this.msgPublishPeers.inc({ topic }, tosendCount)
      this.msgPublishPeersByGroup.inc({ topic, group: 'direct' }, tosendGroupCount.direct)
      this.msgPublishPeersByGroup.inc({ topic, group: 'floodsub' }, tosendGroupCount.floodsub)
      this.msgPublishPeersByGroup.inc({ topic, group: 'mesh' }, tosendGroupCount.mesh)
      this.msgPublishPeersByGroup.inc({ topic, group: 'fanout' }, tosendGroupCount.fanout)
    },

    onMsgRecvPreValidation(topicStr: TopicStr): void {
      const topic = this.toTopic(topicStr)
      this.msgReceivedPreValidation.inc({ topic }, 1)
    },

    onMsgRecvResult(topicStr: TopicStr, status: MessageStatus): void {
      const topic = this.toTopic(topicStr)
      this.msgReceivedStatus.inc({ topic, status })
    },

    onMsgRecvInvalid(topicStr: TopicStr, reason: RejectReasonObj): void {
      const topic = this.toTopic(topicStr)

      const error = reason.reason === RejectReason.Error ? reason.error : reason.reason
      this.msgReceivedInvalid.inc({ topic, error }, 1)
    },

    onRpcRecv(rpc: IRPC, rpcBytes: number): void {
      this.rpcRecvBytes.inc(rpcBytes)
      this.rpcRecvCount.inc(1)
      if (rpc.subscriptions) this.rpcRecvSubscription.inc(rpc.subscriptions.length)
      if (rpc.messages) this.rpcRecvMessage.inc(rpc.messages.length)
      if (rpc.control) {
        this.rpcRecvControl.inc(1)
        if (rpc.control.ihave) this.rpcRecvIHave.inc(rpc.control.ihave.length)
        if (rpc.control.iwant) this.rpcRecvIWant.inc(rpc.control.iwant.length)
        if (rpc.control.graft) this.rpcRecvGraft.inc(rpc.control.graft.length)
        if (rpc.control.prune) this.rpcRecvPrune.inc(rpc.control.prune.length)
      }
    },

    onRpcSent(rpc: IRPC, rpcBytes: number): void {
      this.rpcSentBytes.inc(rpcBytes)
      this.rpcSentCount.inc(1)
      if (rpc.subscriptions) this.rpcSentSubscription.inc(rpc.subscriptions.length)
      if (rpc.messages) this.rpcSentMessage.inc(rpc.messages.length)
      if (rpc.control) {
        this.rpcSentControl.inc(1)
        if (rpc.control.ihave) this.rpcSentIHave.inc(rpc.control.ihave.length)
        if (rpc.control.iwant) this.rpcSentIWant.inc(rpc.control.iwant.length)
        if (rpc.control.graft) this.rpcSentGraft.inc(rpc.control.graft.length)
        if (rpc.control.prune) this.rpcSentPrune.inc(rpc.control.prune.length)
      }
    },

    registerScores(scores: number[], scoreThresholds: PeerScoreThresholds): void {
      let graylist = 0
      let publish = 0
      let gossip = 0
      let mesh = 0

      for (const score of scores) {
        if (score >= scoreThresholds.graylistThreshold) graylist++
        if (score >= scoreThresholds.publishThreshold) publish++
        if (score >= scoreThresholds.gossipThreshold) gossip++
        if (score >= 0) mesh++
      }

      this.peersByScoreThreshold.set({ threshold: ScoreThreshold.graylist }, graylist)
      this.peersByScoreThreshold.set({ threshold: ScoreThreshold.publish }, publish)
      this.peersByScoreThreshold.set({ threshold: ScoreThreshold.gossip }, gossip)
      this.peersByScoreThreshold.set({ threshold: ScoreThreshold.mesh }, mesh)

      // Register full score too
      this.score.set(scores)

      // TODO: Register scores per mesh
    },

    registerScoreWeights(sw: ScoreWeights<number[]>): void {
      for (const [topic, wsTopic] of sw.byTopic) {
        this.scoreWeights.set({ topic, p: 'p1' }, wsTopic.p1w)
        this.scoreWeights.set({ topic, p: 'p2' }, wsTopic.p2w)
        this.scoreWeights.set({ topic, p: 'p3' }, wsTopic.p3w)
        this.scoreWeights.set({ topic, p: 'p3b' }, wsTopic.p3bw)
        this.scoreWeights.set({ topic, p: 'p4' }, wsTopic.p4w)
      }

      this.scoreWeights.set({ p: 'p5' }, sw.p5w)
      this.scoreWeights.set({ p: 'p6' }, sw.p6w)
      this.scoreWeights.set({ p: 'p7' }, sw.p7w)
    },
  }
}

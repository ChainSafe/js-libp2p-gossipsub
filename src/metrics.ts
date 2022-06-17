import type { RPC } from './message/rpc.js'
import type { PeerScoreThresholds } from './score/peer-score-thresholds.js'
import {
  MessageAcceptance,
  MessageStatus,
  PeerIdStr,
  RejectReason,
  RejectReasonObj,
  TopicStr,
  ValidateError
} from './types.js'

/** Topic label as provided in `topicStrToLabel` */
export type TopicLabel = string
export type TopicStrToLabel = Map<TopicStr, TopicLabel>

export enum MessageSource {
  forward = 'forward',
  publish = 'publish'
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

  reset(): void
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
  /** Peer was a fanaout peer. */
  Fanout = 'fanout',
  /** Included from random selection. */
  Random = 'random',
  /** Peer subscribed. */
  Subscribed = 'subscribed',
  /** On heartbeat, peer was included to fill the outbound quota. */
  Outbound = 'outbound',
  /** On heartbeat, not enough peers in mesh */
  NotEnough = 'not_enough',
  /** On heartbeat opportunistic grafting due to low mesh score */
  Opportunistic = 'opportunistic'
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
  Excess = 'excess'
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
  IPColocation = 'IP_colocation'
}

export enum IHaveIgnoreReason {
  LowScore = 'low_score',
  MaxIhave = 'max_ihave',
  MaxIasked = 'max_iasked'
}

export enum ScoreThreshold {
  graylist = 'graylist',
  publish = 'publish',
  gossip = 'gossip',
  mesh = 'mesh'
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

export type PromiseDeliveredStats =
  | { expired: false; requestedCount: number; maxDeliverMs: number }
  | { expired: true; maxDeliverMs: number }

export type TopicScoreWeights<T> = { p1w: T; p2w: T; p3w: T; p3bw: T; p4w: T }
export type ScoreWeights<T> = {
  byTopic: Map<TopicLabel, TopicScoreWeights<T>>
  p5w: T
  p6w: T
  p7w: T
  score: T
}

export type Metrics = ReturnType<typeof getMetrics>

type Flushable = { flush(): void }

/**
 * Register cached gauge and flush all of them when needed.
 */
class CachedRegistry {
  private static instance: CachedRegistry | undefined
  private cachedGauges: Flushable[]

  private constructor() {
    this.cachedGauges = []
  }

  static getInstance(): CachedRegistry {
    if (!CachedRegistry.instance) {
      CachedRegistry.instance = new CachedRegistry()
    }
    return CachedRegistry.instance
  }

  createNoLabelCachedGauge(gauge: Gauge): NoLabelCachedGauge {
    const cachedGauge = new NoLabelCachedGauge(gauge)
    this.cachedGauges.push(cachedGauge)
    return cachedGauge
  }

  createOneLabelCachedGauge<Labels extends LabelsGeneric>(
    gauge: Gauge<Labels>,
    label: keyof Labels
  ): OneLabelCachedGauge<Labels> {
    const cachedGauge = new OneLabelCachedGauge(gauge, label)
    this.cachedGauges.push(cachedGauge)
    return cachedGauge
  }

  createTwoLabelCachedGauge<Labels extends LabelsGeneric>(
    gauge: Gauge<Labels>,
    labelKey1: keyof Labels,
    labelKey2: keyof Labels
  ): TwoLabelCachedGauge<Labels> {
    const cachedGauge = new TwoLabelCachedGauge(gauge, labelKey1, labelKey2)
    this.cachedGauges.push(cachedGauge)
    return cachedGauge
  }

  getCachedMetrics(): Flushable[] {
    return this.cachedGauges
  }
}

/**
 * No label cached gauge, an `inc()` call simply increase the counter
 * without pushing to map like in prom-client.
 * It's a 7x improvement compared to prom-client no-label gauge.
 */
class NoLabelCachedGauge {
  private cache = 0
  private gauge: Gauge
  constructor(gauge: Gauge) {
    this.gauge = gauge
  }

  inc(value = 1): void {
    this.cache += value
  }

  set(value: number): void {
    this.cache = value
  }
  // create more methods if needed

  flush(): void {
    this.gauge.inc(this.cache)
    this.cache = 0
  }
}

export class MapDef<K, V> extends Map<K, V> {
  constructor(private readonly getDefault: () => V) {
    super()
  }

  getOrDefault(key: K): V {
    let value = super.get(key)
    if (value === undefined) {
      value = this.getDefault()
      this.set(key, value)
    }
    return value
  }
}

class CounterMap<K> extends MapDef<K, number> {
  inc(key: K, value = 1): void {
    this.set(key, (this.get(key) ?? 0) + value)
  }
}

/**
 * Support caching one label gauge.
 * This saves some hashObject() call in prom-client.
 * This is 1.2x improvement if we flush per 100 times
 */
class OneLabelCachedGauge<Labels extends LabelsGeneric> {
  private cache: CounterMap<string>
  constructor(private readonly gauge: Gauge<Labels>, private readonly labelKey: keyof Labels) {
    this.cache = new CounterMap(() => 0)
  }

  inc(label: string, value = 1): void {
    this.cache.inc(label, value)
  }

  set(label: string, value: number): void {
    this.cache.set(label, value)
  }

  flush(): void {
    for (const [label, count] of this.cache) {
      this.gauge.inc({ [this.labelKey]: label } as Labels, count)
    }
    this.cache.clear()
  }
}

/**
 * Support caching two label gauge.
 * This saves some hashObject() call in prom-client.
 * This is 2.5x improvement if we flush per 100 times
 */
class TwoLabelCachedGauge<Labels extends LabelsGeneric> {
  private cache: MapDef<string, CounterMap<string>>

  constructor(
    private readonly gauge: Gauge<Labels>,
    private readonly label1Key: keyof Labels,
    private readonly label2Key: keyof Labels
  ) {
    this.cache = new MapDef(() => new CounterMap<string>(() => 0))
  }

  // for one-label gauge, may have to pass undefined as 2nd param if value !== 1
  inc(label1: string, label2: string, value = 1): void {
    const label2Cache = this.cache.getOrDefault(label1)
    label2Cache.inc(label2, value)
  }

  set(label1: string, label2: string, value: number): void {
    const label2Cache = this.cache.getOrDefault(label1)
    label2Cache.set(label2, value)
  }

  // create more methods if needed

  flush(): void {
    for (const [label1Value, label2Cache] of this.cache) {
      for (const [label2Value, count] of label2Cache) {
        this.gauge.inc({ [this.label1Key]: label1Value, [this.label2Key]: label2Value } as Labels, count)
      }
    }
    this.cache.clear()
  }
}

/**
 * A collection of metrics used throughout the Gossipsub behaviour.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getMetrics(
  register: MetricsRegister,
  topicStrToLabel: TopicStrToLabel,
  opts: {
    gossipPromiseExpireSec: number
    behaviourPenaltyThreshold: number
    maxMeshMessageDeliveriesWindowSec: number
  },
  cachedRegistry = CachedRegistry.getInstance()
) {
  // Using function style instead of class to prevent having to re-declare all MetricsPrometheus types.

  return {
    /* Metrics for static config */
    protocolsEnabled: register.gauge<{ protocol: string }>({
      name: 'gossipsub_protocol',
      help: 'Status of enabled protocols',
      labelNames: ['protocol']
    }),

    /* Metrics per known topic */
    /** Status of our subscription to this topic. This metric allows analyzing other topic metrics
     *  filtered by our current subscription status.
     *  = rust-libp2p `topic_subscription_status` */
    topicSubscriptionStatus: register.gauge<{ topicStr: TopicStr }>({
      name: 'gossipsub_topic_subscription_status',
      help: 'Status of our subscription to this topic',
      labelNames: ['topicStr']
    }),
    /** Number of peers subscribed to each topic. This allows us to analyze a topic's behaviour
     * regardless of our subscription status. */
    topicPeersCount: register.gauge<{ topicStr: TopicStr }>({
      name: 'gossipsub_topic_peer_count',
      help: 'Number of peers subscribed to each topic',
      labelNames: ['topicStr']
    }),

    /* Metrics regarding mesh state */
    /** Number of peers in our mesh. This metric should be updated with the count of peers for a
     *  topic in the mesh regardless of inclusion and churn events.
     *  = rust-libp2p `mesh_peer_counts` */
    meshPeerCounts: register.gauge<{ topicStr: TopicStr }>({
      name: 'gossipsub_mesh_peer_count',
      help: 'Number of peers in our mesh',
      labelNames: ['topicStr']
    }),
    /** Number of times we include peers in a topic mesh for different reasons.
     *  = rust-libp2p `mesh_peer_inclusion_events` */
    meshPeerInclusionEvents: cachedRegistry.createTwoLabelCachedGauge(
      register.gauge<{ topic: TopicLabel; reason: InclusionReason }>({
        name: 'gossipsub_mesh_peer_inclusion_events_total',
        help: 'Number of times we include peers in a topic mesh for different reasons',
        labelNames: ['topic', 'reason']
      }),
      'topic',
      'reason'
    ),
    /** Number of times we remove peers in a topic mesh for different reasons.
     *  = rust-libp2p `mesh_peer_churn_events` */
    meshPeerChurnEvents: cachedRegistry.createTwoLabelCachedGauge(
      register.gauge<{ topic: TopicLabel; reason: ChurnReason }>({
        name: 'gossipsub_peer_churn_events_total',
        help: 'Number of times we remove peers in a topic mesh for different reasons',
        labelNames: ['topic', 'reason']
      }),
      'topic',
      'reason'
    ),

    /* General Metrics */
    /** Gossipsub supports floodsub, gossipsub v1.0 and gossipsub v1.1. Peers are classified based
     *  on which protocol they support. This metric keeps track of the number of peers that are
     *  connected of each type. */
    peersPerProtocol: register.gauge<{ protocol: string }>({
      name: 'gossipsub_peers_per_protocol_count',
      help: 'Peers connected for each topic',
      labelNames: ['protocol']
    }),
    /** The time it takes to complete one iteration of the heartbeat. */
    heartbeatDuration: register.histogram({
      name: 'gossipsub_heartbeat_duration_seconds',
      help: 'The time it takes to complete one iteration of the heartbeat',
      // Should take <10ms, over 1s it's a huge issue that needs debugging, since a heartbeat will be cancelled
      buckets: [0.01, 0.1, 1]
    }),
    /** Heartbeat run took longer than heartbeat interval so next is skipped */
    heartbeatSkipped: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_heartbeat_skipped',
        help: 'Heartbeat run took longer than heartbeat interval so next is skipped'
      })
    ),
    /** Message validation results for each topic.
     *  Invalid == Reject?
     *  = rust-libp2p `invalid_messages`, `accepted_messages`, `ignored_messages`, `rejected_messages` */
    asyncValidationResult: cachedRegistry.createTwoLabelCachedGauge(
      register.gauge<{ topic: TopicLabel; acceptance: MessageAcceptance }>({
        name: 'gossipsub_async_validation_result_total',
        help: 'Message validation result for each topic',
        labelNames: ['topic', 'acceptance']
      }),
      'topic',
      'acceptance'
    ),
    /** When the user validates a message, it tries to re propagate it to its mesh peers. If the
     *  message expires from the memcache before it can be validated, we count this a cache miss
     *  and it is an indicator that the memcache size should be increased.
     *  = rust-libp2p `mcache_misses` */
    asyncValidationMcacheHit: register.gauge<{ hit: 'hit' | 'miss' }>({
      name: 'gossipsub_async_validation_mcache_hit_total',
      help: 'Async validation result reported by the user layer',
      labelNames: ['hit']
    }),

    // RPC outgoing. Track byte length + data structure sizes
    rpcRecvBytes: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_bytes_total', help: 'RPC recv' })
    ),
    rpcRecvCount: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_count_total', help: 'RPC recv' })
    ),
    rpcRecvSubscription: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_subscription_total', help: 'RPC recv' })
    ),
    rpcRecvMessage: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_message_total', help: 'RPC recv' })
    ),
    rpcRecvControl: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_control_total', help: 'RPC recv' })
    ),
    rpcRecvIHave: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_ihave_total', help: 'RPC recv' })
    ),
    rpcRecvIWant: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_iwant_total', help: 'RPC recv' })
    ),
    rpcRecvGraft: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_graft_total', help: 'RPC recv' })
    ),
    rpcRecvPrune: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_recv_prune_total', help: 'RPC recv' })
    ),

    /** Total count of RPC dropped because acceptFrom() == false */
    rpcRecvNotAccepted: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_rpc_rcv_not_accepted_total',
        help: 'Total count of RPC dropped because acceptFrom() == false'
      })
    ),

    // RPC incoming. Track byte length + data structure sizes
    rpcSentBytes: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_bytes_total', help: 'RPC sent' })
    ),
    rpcSentCount: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_count_total', help: 'RPC sent' })
    ),
    rpcSentSubscription: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_subscription_total', help: 'RPC sent' })
    ),
    rpcSentMessage: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_message_total', help: 'RPC sent' })
    ),
    rpcSentControl: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_control_total', help: 'RPC sent' })
    ),
    rpcSentIHave: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_ihave_total', help: 'RPC sent' })
    ),
    rpcSentIWant: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_iwant_total', help: 'RPC sent' })
    ),
    rpcSentGraft: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_graft_total', help: 'RPC sent' })
    ),
    rpcSentPrune: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({ name: 'gossipsub_rpc_sent_prune_total', help: 'RPC sent' })
    ),

    // publish message. Track peers sent to and bytes
    /** Total count of msg published by topic */
    msgPublishCount: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_publish_count_total',
      help: 'Total count of msg published by topic',
      labelNames: ['topic']
    }),
    /** Total count of peers that we publish a msg to */
    msgPublishPeers: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_publish_peers_total',
      help: 'Total count of peers that we publish a msg to',
      labelNames: ['topic']
    }),
    /** Total count of peers (by group) that we publish a msg to */
    // NOTE: Do not use 'group' label since it's a generic already used by Prometheus to group instances
    msgPublishPeersByGroup: cachedRegistry.createTwoLabelCachedGauge(
      register.gauge<{ topic: TopicLabel; peerGroup: keyof ToSendGroupCount }>({
        name: 'gossipsub_msg_publish_peers_by_group',
        help: 'Total count of peers (by group) that we publish a msg to',
        labelNames: ['topic', 'peerGroup']
      }),
      'topic',
      'peerGroup'
    ),
    /** Total count of msg publish data.length bytes */
    msgPublishBytes: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_publish_bytes_total',
      help: 'Total count of msg publish data.length bytes',
      labelNames: ['topic']
    }),

    /** Total count of msg forwarded by topic */
    msgForwardCount: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_forward_count_total',
      help: 'Total count of msg forwarded by topic',
      labelNames: ['topic']
    }),
    /** Total count of peers that we forward a msg to */
    msgForwardPeers: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_forward_peers_total',
      help: 'Total count of peers that we forward a msg to',
      labelNames: ['topic']
    }),

    /** Total count of recv msgs before any validation */
    msgReceivedPreValidation: register.gauge<{ topic: TopicLabel }>({
      name: 'gossipsub_msg_received_prevalidation_total',
      help: 'Total count of recv msgs before any validation',
      labelNames: ['topic']
    }),
    /** Tracks distribution of recv msgs by duplicate, invalid, valid */
    msgReceivedStatus: cachedRegistry.createTwoLabelCachedGauge(
      register.gauge<{ topic: TopicLabel; status: MessageStatus }>({
        name: 'gossipsub_msg_received_status_total',
        help: 'Tracks distribution of recv msgs by duplicate, invalid, valid',
        labelNames: ['topic', 'status']
      }),
      'topic',
      'status'
    ),
    /** Tracks specific reason of invalid */
    msgReceivedInvalid: register.gauge<{ topic: TopicLabel; error: RejectReason | ValidateError }>({
      name: 'gossipsub_msg_received_invalid_total',
      help: 'Tracks specific reason of invalid',
      labelNames: ['topic', 'error']
    }),
    /** Track duplicate message delivery time */
    duplicateMsgDeliveryDelay: register.histogram({
      name: 'gossisub_duplicate_msg_delivery_delay_seconds',
      help: 'Time since the 1st duplicated message validated',
      labelNames: ['topic'],
      buckets: [
        0.25 * opts.maxMeshMessageDeliveriesWindowSec,
        0.5 * opts.maxMeshMessageDeliveriesWindowSec,
        1 * opts.maxMeshMessageDeliveriesWindowSec,
        2 * opts.maxMeshMessageDeliveriesWindowSec,
        4 * opts.maxMeshMessageDeliveriesWindowSec
      ]
    }),
    /** Total count of late msg delivery total by topic */
    duplicateMsgLateDelivery: cachedRegistry.createOneLabelCachedGauge(
      register.gauge<{ topic: TopicLabel }>({
        name: 'gossisub_duplicate_msg_late_delivery_total',
        help: 'Total count of late duplicate message delivery by topic, which triggers P3 penalty',
        labelNames: ['topic']
      }),
      'topic'
    ),

    /* Metrics related to scoring */
    /** Total times score() is called */
    scoreFnCalls: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_score_fn_calls_total',
        help: 'Total times score() is called'
      })
    ),
    /** Total times score() call actually computed computeScore(), no cache */
    scoreFnRuns: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_score_fn_runs_total',
        help: 'Total times score() call actually computed computeScore(), no cache'
      })
    ),
    scoreCachedDelta: register.histogram({
      name: 'gossipsub_score_cache_delta',
      help: 'Delta of score between cached values that expired',
      buckets: [10, 100, 1000]
    }),
    /** Current count of peers by score threshold */
    peersByScoreThreshold: register.gauge<{ threshold: ScoreThreshold }>({
      name: 'gossipsub_peers_by_score_threshold_count',
      help: 'Current count of peers by score threshold',
      labelNames: ['threshold']
    }),
    score: register.avgMinMax({
      name: 'gossipsub_score',
      help: 'Avg min max of gossip scores',
      labelNames: ['topic', 'p']
    }),
    /** Separate score weights */
    scoreWeights: register.avgMinMax<{ topic?: TopicLabel; p: string }>({
      name: 'gossipsub_score_weights',
      help: 'Separate score weights',
      labelNames: ['topic', 'p']
    }),
    /** Histogram of the scores for each mesh topic. */
    // TODO: Not implemented
    scorePerMesh: register.avgMinMax<{ topic: TopicLabel }>({
      name: 'gossipsub_score_per_mesh',
      help: 'Histogram of the scores for each mesh topic',
      labelNames: ['topic']
    }),
    /** A counter of the kind of penalties being applied to peers. */
    // TODO: Not fully implemented
    scoringPenalties: register.gauge<{ penalty: ScorePenalty }>({
      name: 'gossipsub_scoring_penalties_total',
      help: 'A counter of the kind of penalties being applied to peers',
      labelNames: ['penalty']
    }),
    behaviourPenalty: register.histogram({
      name: 'gossipsub_peer_stat_behaviour_penalty',
      help: 'Current peer stat behaviour_penalty at each scrape',
      buckets: [
        0.25 * opts.behaviourPenaltyThreshold,
        0.5 * opts.behaviourPenaltyThreshold,
        1 * opts.behaviourPenaltyThreshold,
        2 * opts.behaviourPenaltyThreshold,
        4 * opts.behaviourPenaltyThreshold
      ]
    }),

    // TODO:
    // - iasked per peer (on heartbeat)
    // - when promise is resolved, track messages from promises

    /** Total received IHAVE messages that we ignore for some reason */
    ihaveRcvIgnored: cachedRegistry.createOneLabelCachedGauge(
      register.gauge<{ reason: IHaveIgnoreReason }>({
        name: 'gossipsub_ihave_rcv_ignored_total',
        help: 'Total received IHAVE messages that we ignore for some reason',
        labelNames: ['reason']
      }),
      'reason'
    ),
    /** Total received IHAVE messages by topic */
    ihaveRcvMsgids: cachedRegistry.createOneLabelCachedGauge(
      register.gauge<{ topic: TopicLabel }>({
        name: 'gossipsub_ihave_rcv_msgids_total',
        help: 'Total received IHAVE messages by topic',
        labelNames: ['topic']
      }),
      'topic'
    ),
    /** Total messages per topic we don't have. Not actual requests.
     *  The number of times we have decided that an IWANT control message is required for this
     *  topic. A very high metric might indicate an underperforming network.
     *  = rust-libp2p `topic_iwant_msgs` */
    ihaveRcvNotSeenMsgids: cachedRegistry.createOneLabelCachedGauge(
      register.gauge<{ topic: TopicLabel }>({
        name: 'gossipsub_ihave_rcv_not_seen_msgids_total',
        help: 'Total messages per topic we do not have, not actual requests',
        labelNames: ['topic']
      }),
      'topic'
    ),

    /** Total received IWANT messages by topic */
    iwantRcvMsgids: cachedRegistry.createOneLabelCachedGauge(
      register.gauge<{ topic: TopicLabel }>({
        name: 'gossipsub_iwant_rcv_msgids_total',
        help: 'Total received IWANT messages by topic',
        labelNames: ['topic']
      }),
      'topic'
    ),
    /** Total requested messageIDs that we don't have */
    iwantRcvDonthaveMsgids: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_iwant_rcv_dont_have_msgids_total',
        help: 'Total requested messageIDs that we do not have'
      })
    ),
    iwantPromiseStarted: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_iwant_promise_sent_total',
        help: 'Total count of started IWANT promises'
      })
    ),
    /** Total count of resolved IWANT promises */
    iwantPromiseResolved: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_iwant_promise_resolved_total',
        help: 'Total count of resolved IWANT promises'
      })
    ),
    /** Total count of peers we have asked IWANT promises that are resolved */
    iwantPromiseResolvedPeers: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_iwant_promise_resolved_peers',
        help: 'Total count of peers we have asked IWANT promises that are resolved'
      })
    ),
    iwantPromiseBroken: cachedRegistry.createNoLabelCachedGauge(
      register.gauge({
        name: 'gossipsub_iwant_promise_broken',
        help: 'Total count of broken IWANT promises'
      })
    ),
    /** Histogram of delivery time of resolved IWANT promises */
    iwantPromiseDeliveryTime: register.histogram({
      name: 'gossipsub_iwant_promise_delivery_seconds',
      help: 'Histogram of delivery time of resolved IWANT promises',
      buckets: [
        0.5 * opts.gossipPromiseExpireSec,
        1 * opts.gossipPromiseExpireSec,
        2 * opts.gossipPromiseExpireSec,
        4 * opts.gossipPromiseExpireSec
      ]
    }),

    /* Data structure sizes */
    /** Unbounded cache sizes */
    cacheSize: register.gauge<{ cache: string }>({
      name: 'gossipsub_cache_size',
      help: 'Unbounded cache sizes',
      labelNames: ['cache']
    }),
    /** Current mcache msg count */
    mcacheSize: register.gauge({
      name: 'gossipsub_mcache_size',
      help: 'Current mcache msg count'
    }),

    topicStrToLabel: topicStrToLabel,

    // 0.28%
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
      this.meshPeerInclusionEvents.inc(topic, reason, count)
    },

    /** Register the removal of peers in our mesh due to some reason */
    // - remove_peer_from_mesh()
    // - heartbeat() Churn::BadScore
    // - heartbeat() Churn::Excess
    // - on_disconnect() Churn::Ds
    onRemoveFromMesh(topicStr: TopicStr, reason: ChurnReason, count: number): void {
      const topic = this.toTopic(topicStr)
      this.meshPeerChurnEvents.inc(topic, reason, count)
    },

    // 0.04%
    onReportValidationMcacheHit(hit: boolean): void {
      this.asyncValidationMcacheHit.inc({ hit: hit ? 'hit' : 'miss' })
    },

    // 0.05%
    onReportValidation(topicStr: TopicStr, acceptance: MessageAcceptance): void {
      const topic = this.toTopic(topicStr)
      this.asyncValidationResult.inc(topic, acceptance)
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

    // 0.06%
    onIhaveRcv(topicStr: TopicStr, ihave: number, idonthave: number): void {
      const topic = this.toTopic(topicStr)
      this.ihaveRcvMsgids.inc(topic, ihave)
      this.ihaveRcvNotSeenMsgids.inc(topic, idonthave)
    },

    onIwantRcv(iwantByTopic: Map<TopicStr, number>, iwantDonthave: number): void {
      for (const [topicStr, iwant] of iwantByTopic) {
        const topic = this.toTopic(topicStr)
        this.iwantRcvMsgids.inc(topic, iwant)
      }

      this.iwantRcvDonthaveMsgids.inc(iwantDonthave)
    },

    // 0.05%
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
      this.msgPublishPeersByGroup.inc(topic, 'direct', tosendGroupCount.direct)
      this.msgPublishPeersByGroup.inc(topic, 'floodsub', tosendGroupCount.floodsub)
      this.msgPublishPeersByGroup.inc(topic, 'mesh', tosendGroupCount.mesh)
      this.msgPublishPeersByGroup.inc(topic, 'fanout', tosendGroupCount.fanout)
    },

    // 0.9%
    onMsgRecvPreValidation(topicStr: TopicStr): void {
      const topic = this.toTopic(topicStr)
      this.msgReceivedPreValidation.inc({ topic }, 1)
    },

    // 0.93%
    onMsgRecvResult(topicStr: TopicStr, status: MessageStatus): void {
      const topic = this.toTopic(topicStr)
      // Don't call metric.inc() directly to improve performance
      this.msgReceivedStatus.inc(topic, status)
    },

    onMsgRecvInvalid(topicStr: TopicStr, reason: RejectReasonObj): void {
      const topic = this.toTopic(topicStr)

      const error = reason.reason === RejectReason.Error ? reason.error : reason.reason
      this.msgReceivedInvalid.inc({ topic, error }, 1)
    },

    onDuplicateMsgDelivery(topicStr: TopicStr, deliveryDelayMs: number, isLateDelivery: boolean): void {
      this.duplicateMsgDeliveryDelay.observe(deliveryDelayMs / 1000)
      if (isLateDelivery) {
        const topic = this.toTopic(topicStr)
        this.duplicateMsgLateDelivery.inc(topic, 1)
      }
    },

    // 0.48%
    onRpcRecv(rpc: RPC, rpcBytes: number): void {
      this.rpcRecvBytes.inc(rpcBytes)
      this.rpcRecvCount.inc(1)
      this.rpcRecvSubscription.inc(rpc.subscriptions.length)
      this.rpcRecvMessage.inc(rpc.messages.length)
      if (rpc.control) {
        const ihave = rpc.control.ihave.length
        const iwant = rpc.control.iwant.length
        const graft = rpc.control.graft.length
        const prune = rpc.control.prune.length
        if (ihave > 0) this.rpcRecvIHave.inc(rpc.control.ihave.length)
        if (iwant > 0) this.rpcRecvIWant.inc(rpc.control.iwant.length)
        if (graft > 0) this.rpcRecvGraft.inc(rpc.control.graft.length)
        if (prune > 0) this.rpcRecvPrune.inc(rpc.control.prune.length)
        if (ihave > 0 || iwant > 0 || graft > 0 || prune > 0) this.rpcRecvControl.inc(1)
      }
    },

    // 0.06%
    onRpcSent(rpc: RPC, rpcBytes: number): void {
      this.rpcSentBytes.inc(rpcBytes)
      this.rpcSentCount.inc(1)
      this.rpcSentSubscription.inc(rpc.subscriptions.length)
      this.rpcSentMessage.inc(rpc.messages.length)
      if (rpc.control) {
        const ihave = rpc.control.ihave.length
        const iwant = rpc.control.iwant.length
        const graft = rpc.control.graft.length
        const prune = rpc.control.prune.length
        if (ihave > 0) this.rpcSentIHave.inc(ihave)
        if (iwant > 0) this.rpcSentIWant.inc(iwant)
        if (graft > 0) this.rpcSentGraft.inc(graft)
        if (prune > 0) this.rpcSentPrune.inc(prune)
        if (ihave > 0 || iwant > 0 || graft > 0 || prune > 0) this.rpcSentControl.inc(1)
      }
    },

    /**
     * Increasing metrics by 1 all the time is not efficient as it involves:
     *   - hashObject(labels)
     *   - get from the map
     *   - set from the map
     * Instead we cache it and only flushing per scrape
     */
    onScrapeMetrics(): void {
      cachedRegistry.getCachedMetrics().forEach((cachedMetric) => cachedMetric.flush())
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

    registerScorePerMesh(mesh: Map<TopicStr, Set<PeerIdStr>>, scoreByPeer: Map<PeerIdStr, number>): void {
      const peersPerTopicLabel = new Map<TopicLabel, Set<PeerIdStr>>()

      mesh.forEach((peers, topicStr) => {
        // Aggregate by known topicLabel or throw to 'unknown'. This prevent too high cardinality
        const topicLabel = this.topicStrToLabel.get(topicStr) ?? 'unknown'
        let peersInMesh = peersPerTopicLabel.get(topicLabel)
        if (!peersInMesh) {
          peersInMesh = new Set()
          peersPerTopicLabel.set(topicLabel, peersInMesh)
        }
        peers.forEach((p) => peersInMesh?.add(p))
      })

      for (const [topic, peers] of peersPerTopicLabel) {
        const meshScores: number[] = []
        peers.forEach((peer) => {
          meshScores.push(scoreByPeer.get(peer) ?? 0)
        })
        this.scorePerMesh.set({ topic }, meshScores)
      }
    }
  }
}

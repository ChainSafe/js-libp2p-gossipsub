import pipe from 'it-pipe'
import Libp2p, { Connection, EventEmitter } from 'libp2p'
import Envelope from 'libp2p/src/record/envelope'
import Registrar from 'libp2p/src/registrar'
import PeerId, { createFromB58String, createFromBytes } from 'peer-id'
import debug, { Debugger } from 'debug'
import MulticodecTopology from 'libp2p-interfaces/src/topology/multicodec-topology'
import PeerStreams from 'libp2p-interfaces/src/pubsub/peer-streams'

import { MessageCache } from './message-cache'
import { RPC, IRPC } from './message/rpc'
import * as constants from './constants'
import { createGossipRpc, shuffle, hasGossipProtocol, messageIdToString } from './utils'
import {
  PeerScore,
  PeerScoreParams,
  PeerScoreThresholds,
  createPeerScoreParams,
  createPeerScoreThresholds,
  PeerScoreStatsDump
} from './score'
import { IWantTracer } from './tracer'
import { SimpleTimeCache } from './utils/time-cache'
import {
  ACCEPT_FROM_WHITELIST_DURATION_MS,
  ACCEPT_FROM_WHITELIST_MAX_MESSAGES,
  ACCEPT_FROM_WHITELIST_THRESHOLD_SCORE
} from './constants'
import {
  ChurnReason,
  getMetrics,
  IHaveIgnoreReason,
  InclusionReason,
  Metrics,
  MetricsRegister,
  ScorePenalty,
  TopicStrToLabel,
  ToSendGroupCount
} from './metrics'
import {
  GossipsubMessage,
  MessageAcceptance,
  MsgIdFn,
  PublishConfig,
  SignaturePolicy,
  TopicStr,
  MsgIdStr,
  ValidateError,
  PeerIdStr,
  MessageStatus,
  RejectReason,
  RejectReasonObj,
  FastMsgIdFn,
  AddrInfo,
  DataTransform,
  TopicValidatorFn,
  rejectReasonFromAcceptance
} from './types'
import { buildRawMessage, validateToRawMessage } from './utils/buildRawMessage'
import { msgIdFnStrictNoSign, msgIdFnStrictSign } from './utils/msgIdFn'
import { computeAllPeersScoreWeights } from './score/scoreMetrics'
import { getPublishConfigFromPeerId } from './utils/publishConfig'
import { GossipsubOptsSpec } from './config'

// From 'bl' library
interface BufferList {
  slice(): Buffer
}

// Re-export useful utils
// TODO
// export { getPublishConfigFromPeerId } from './utils'

type ConnectionDirection = 'inbound' | 'outbound'

type ReceivedMessageResult =
  | { code: MessageStatus.duplicate; msgId: MsgIdStr }
  | ({ code: MessageStatus.invalid; msgId?: MsgIdStr } & RejectReasonObj)
  | { code: MessageStatus.valid; msgIdStr: MsgIdStr; msg: GossipsubMessage }

export const multicodec: string = constants.GossipsubIDv11

export type GossipsubOpts = GossipsubOptsSpec & {
  // Behaviour
  emitSelf: boolean
  /** if can relay messages not subscribed */
  canRelayMessage: boolean
  /** if incoming messages on a subscribed topic should be automatically gossiped */
  gossipIncoming: boolean
  /** if dial should fallback to floodsub */
  fallbackToFloodsub: boolean
  /** if self-published messages should be sent to all peers */
  floodPublish: boolean
  /** whether PX is enabled; this should be enabled in bootstrappers and other well connected/trusted nodes. */
  doPX: boolean
  /** peers with which we will maintain direct connections */
  directPeers: AddrInfo[]
  /**
   * If true will not forward messages to mesh peers until reportMessageValidationResult() is called.
   * Messages will be cached in mcache for some time after which they are evicted. Calling
   * reportMessageValidationResult() after the message is dropped from mcache won't forward the message.
   */
  asyncValidation: boolean
  /** Do not throw `InsufficientPeers` error if publishing to zero peers */
  allowPublishToZeroPeers: boolean
  /** For a single stream, await processing each RPC before processing the next */
  awaitRpcHandler: boolean
  /** For a single RPC, await processing each message before processing the next */
  awaitRpcMessageHandler: boolean

  // Extra modules, config
  msgIdFn: MsgIdFn
  /** fast message id function */
  fastMsgIdFn: FastMsgIdFn
  /** override the default MessageCache */
  messageCache: MessageCache
  /** signing policy to apply across all messages */
  globalSignaturePolicy: SignaturePolicy | undefined
  /** peer score parameters */
  scoreParams: Partial<PeerScoreParams>
  /** peer score thresholds */
  scoreThresholds: Partial<PeerScoreThresholds>

  dataTransform?: DataTransform
  metricsRegister?: MetricsRegister | null
  metricsTopicStrToLabel?: TopicStrToLabel

  // Debug
  /** Prefix tag for debug logs */
  debugName?: string
}

enum GossipStatusCode {
  started,
  stopped
}

type GossipStatus =
  | {
      code: GossipStatusCode.started
      registrarHandlerId: string
      registrarTopologyId: string
      heartbeatTimeout: NodeJS.Timeout
      hearbeatStartMs: number
    }
  | {
      code: GossipStatusCode.stopped
    }

interface GossipOptions extends GossipsubOpts {
  scoreParams: PeerScoreParams
  scoreThresholds: PeerScoreThresholds
}

interface AcceptFromWhitelistEntry {
  /** number of messages accepted since recomputing the peer's score */
  messagesAccepted: number
  /** have to recompute score after this time */
  acceptUntil: number
}

// TODO: Export this type
type GossipsubEvents = {
  'gossipsub:message': {
    propagationSource: PeerId
    msgId: MsgIdStr
    msg: GossipsubMessage
  }
}

export default class Gossipsub extends EventEmitter {
  /**
   * The signature policy to follow by default
   */
  private readonly globalSignaturePolicy: SignaturePolicy

  private readonly publishConfig: PublishConfig

  private readonly dataTransform: DataTransform | undefined

  // State

  private readonly peers = new Map<PeerIdStr, PeerStreams>()

  /** Direct peers */
  private readonly direct = new Set<PeerIdStr>()

  /** Floodsub peers */
  private readonly floodsubPeers = new Set<PeerIdStr>()

  /** Cache of seen messages */
  private readonly seenCache: SimpleTimeCache<void>

  /**
   * Map of peer id and AcceptRequestWhileListEntry
   */
  private readonly acceptFromWhitelist = new Map<PeerIdStr, AcceptFromWhitelistEntry>()

  /**
   * Map of topics to which peers are subscribed to
   */
  private readonly topics = new Map<TopicStr, Set<PeerIdStr>>()

  /**
   * List of our subscriptions
   */
  private readonly subscriptions = new Set<TopicStr>()

  /**
   * Map of topic meshes
   * topic => peer id set
   */
  private readonly mesh = new Map<TopicStr, Set<PeerIdStr>>()

  /**
   * Map of topics to set of peers. These mesh peers are the ones to which we are publishing without a topic membership
   * topic => peer id set
   */
  private readonly fanout = new Map<TopicStr, Set<PeerIdStr>>()

  /**
   * Map of last publish time for fanout topics
   * topic => last publish time
   */
  private readonly fanoutLastpub = new Map<TopicStr, number>()

  /**
   * Map of pending messages to gossip
   * peer id => control messages
   */
  private readonly gossip = new Map<PeerIdStr, RPC.IControlIHave[]>()

  /**
   * Map of control messages
   * peer id => control message
   */
  private readonly control = new Map<PeerIdStr, RPC.IControlMessage>()

  /**
   * Number of IHAVEs received from peer in the last heartbeat
   */
  private readonly peerhave = new Map<PeerIdStr, number>()

  /** Number of messages we have asked from peer in the last heartbeat */
  private readonly iasked = new Map<PeerIdStr, number>()

  /** Prune backoff map */
  private readonly backoff = new Map<TopicStr, Map<PeerIdStr, number>>()

  /**
   * Connection direction cache, marks peers with outbound connections
   * peer id => direction
   */
  private readonly outbound = new Map<PeerIdStr, boolean>()
  private readonly msgIdFn: MsgIdFn

  /**
   * A fast message id function used for internal message de-duplication
   */
  private readonly fastMsgIdFn: FastMsgIdFn | undefined

  /** Maps fast message-id to canonical message-id */
  private readonly fastMsgIdCache: SimpleTimeCache<MsgIdStr> | undefined

  /**
   * Short term cache for published message ids. This is used for penalizing peers sending
   * our own messages back if the messages are anonymous or use a random author.
   */
  private readonly publishedMessageIds: SimpleTimeCache<void>

  /**
   * A message cache that contains the messages for last few heartbeat ticks
   */
  private readonly mcache: MessageCache

  /** Peer score tracking */
  private readonly score: PeerScore

  private readonly topicValidators = new Map<TopicStr, TopicValidatorFn>()

  /**
   * Number of heartbeats since the beginning of time
   * This allows us to amortize some resource cleanup -- eg: backoff cleanup
   */
  private heartbeatTicks = 0

  /**
   * Tracks IHAVE/IWANT promises broken by peers
   */
  readonly gossipTracer: IWantTracer

  // Public for go-gossipsub tests
  readonly _libp2p: Libp2p
  readonly peerId: PeerId
  readonly multicodecs: string[] = [constants.GossipsubIDv11, constants.GossipsubIDv10]

  private directPeerInitial: NodeJS.Timeout | null = null
  private log: Debugger

  public static multicodec: string = constants.GossipsubIDv11

  readonly opts: GossipOptions
  private readonly registrar: Registrar
  private readonly metrics: Metrics | null
  private status: GossipStatus = { code: GossipStatusCode.stopped }

  private heartbeatTimer: {
    _intervalId: NodeJS.Timeout | undefined
    runPeriodically(fn: () => void, period: number): void
    cancel(): void
  } | null = null

  constructor(libp2p: Libp2p, options: Partial<GossipsubOpts> = {}) {
    super()

    const opts = {
      gossipIncoming: true,
      fallbackToFloodsub: true,
      floodPublish: true,
      doPX: false,
      directPeers: [],
      D: constants.GossipsubD,
      Dlo: constants.GossipsubDlo,
      Dhi: constants.GossipsubDhi,
      Dscore: constants.GossipsubDscore,
      Dout: constants.GossipsubDout,
      Dlazy: constants.GossipsubDlazy,
      heartbeatInterval: constants.GossipsubHeartbeatInterval,
      fanoutTTL: constants.GossipsubFanoutTTL,
      mcacheLength: constants.GossipsubHistoryLength,
      mcacheGossip: constants.GossipsubHistoryGossip,
      seenTTL: constants.GossipsubSeenTTL,
      ...options,
      scoreParams: createPeerScoreParams(options.scoreParams),
      scoreThresholds: createPeerScoreThresholds(options.scoreThresholds)
    } as GossipOptions

    this.globalSignaturePolicy = opts.globalSignaturePolicy ?? SignaturePolicy.StrictSign
    this.publishConfig = getPublishConfigFromPeerId(this.globalSignaturePolicy, libp2p.peerId)
    this.peerId = libp2p.peerId

    // Also wants to get notified of peers connected using floodsub
    if (opts.fallbackToFloodsub) {
      this.multicodecs.push(constants.FloodsubID)
    }

    // From pubsub
    this.log = debug(opts.debugName ?? 'libp2p:gossipsub')

    // Gossipsub

    this.opts = opts

    this.direct = new Set(opts.directPeers.map((p) => p.id.toB58String()))

    // set direct peer addresses in the address book
    opts.directPeers.forEach((p) => {
      libp2p.peerStore.addressBook.add(
        p.id as unknown as Parameters<typeof libp2p.peerStore.addressBook.add>[0],
        p.addrs
      )
    })

    this.seenCache = new SimpleTimeCache<void>({ validityMs: opts.seenTTL })
    this.publishedMessageIds = new SimpleTimeCache<void>({ validityMs: opts.seenTTL })

    this.mcache = options.messageCache || new MessageCache(opts.mcacheGossip, opts.mcacheLength)

    if (options.msgIdFn) {
      // Use custom function
      this.msgIdFn = options.msgIdFn
    } else {
      switch (this.globalSignaturePolicy) {
        case SignaturePolicy.StrictSign:
          this.msgIdFn = msgIdFnStrictSign
          break
        case SignaturePolicy.StrictNoSign:
          this.msgIdFn = msgIdFnStrictNoSign
          break
      }
    }

    if (options.fastMsgIdFn) {
      this.fastMsgIdFn = options.fastMsgIdFn
      this.fastMsgIdCache = new SimpleTimeCache<string>({ validityMs: opts.seenTTL })
    }

    if (options.dataTransform) {
      this.dataTransform = options.dataTransform
    }

    if (options.metricsRegister) {
      if (!options.metricsTopicStrToLabel) {
        throw Error('Must set metricsTopicStrToLabel with metrics')
      }

      const metrics = getMetrics(options.metricsRegister, options.metricsTopicStrToLabel, {
        gossipPromiseExpireSec: constants.GossipsubIWantFollowupTime / 1000,
        behaviourPenaltyThreshold: opts.scoreParams.behaviourPenaltyThreshold,
        // in theory, each topic has its own meshMessageDeliveriesWindow param
        // however in lodestar, we configure it the same so just pick the min one
        minMeshMessageDeliveriesWindow: Math.min(
          ...Object.values(opts.scoreParams.topics).map((topicParam) => topicParam.meshMessageDeliveriesWindow)
        )
      })

      metrics.mcacheSize.addCollect(() => this.onScrapeMetrics(metrics))
      for (const protocol of this.multicodecs) {
        metrics.protocolsEnabled.set({ protocol }, 1)
      }

      this.metrics = metrics
    } else {
      this.metrics = null
    }

    this.gossipTracer = new IWantTracer(this.metrics)

    /**
     * libp2p
     */
    this._libp2p = libp2p
    this.registrar = libp2p.registrar
    this.score = new PeerScore(this.opts.scoreParams, libp2p.connectionManager, this.metrics, {
      scoreCacheValidityMs: opts.heartbeatInterval
    })
  }

  // LIFECYCLE METHODS

  /**
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   */
  async start(): Promise<void> {
    // From pubsub
    if (this.status.code === GossipStatusCode.started) {
      return
    }

    this.log('starting')

    // Incoming streams
    // Called after a peer dials us
    // TODO
    // const registrarHandlerId = this.registrar.handle(this.multicodecs, this.onIncomingStream.bind(this))
    this.registrar.handle(this.multicodecs, this.onIncomingStream.bind(this))

    // # How does Gossipsub interact with libp2p? Rough guide from Mar 2022
    //
    // ## Setup:
    // Gossipsub requests libp2p to callback, TBD
    //
    // `this.libp2p.handle()` registers a handler for `/meshsub/1.1.0` and other Gossipsub protocols
    // The handler callback is registered in libp2p Upgrader.protocols map.
    //
    // Upgrader receives an inbound connection from some transport and (`Upgrader.upgradeInbound`):
    // - Adds encryption (NOISE in our case)
    // - Multiplex stream
    // - Create a muxer and register that for each new stream call Upgrader.protocols handler
    //
    // ## Topology
    // - new instance of Topology (unlinked to libp2p) with handlers
    // - registar.register(topology)

    // register protocol with topology
    // Topology callbacks called on connection manager changes
    const topology = new MulticodecTopology({
      multicodecs: this.multicodecs,
      handlers: {
        onConnect: this.onPeerConnected.bind(this),
        onDisconnect: this.onPeerDisconnected.bind(this)
      }
    })
    const registrarTopologyId = await this.registrar.register(topology)

    // Schedule to start heartbeat after `GossipsubHeartbeatInitialDelay`
    const heartbeatTimeout = setTimeout(this.runHeartbeat, constants.GossipsubHeartbeatInitialDelay)
    // Then, run heartbeat every `heartbeatInterval` offset by `GossipsubHeartbeatInitialDelay`

    this.status = {
      code: GossipStatusCode.started,
      registrarHandlerId: 'TODO',
      registrarTopologyId,
      heartbeatTimeout: heartbeatTimeout,
      hearbeatStartMs: Date.now() + constants.GossipsubHeartbeatInitialDelay
    }

    this.log('started')

    this.score.start()
    // connect to direct peers
    this.directPeerInitial = setTimeout(() => {
      this.direct.forEach((id) => {
        this.connect(id)
      })
    }, constants.GossipsubDirectConnectInitialDelay)
  }

  /**
   * Unmounts the gossipsub protocol and shuts down every connection
   */
  async stop(): Promise<void> {
    // From pubsub

    if (this.status.code !== GossipStatusCode.started) {
      return
    }

    const { registrarTopologyId } = this.status
    this.status = { code: GossipStatusCode.stopped }

    // unregister protocol and handlers
    this.registrar.unregister(registrarTopologyId)
    // TODO: Uncomment on new libp2p version
    // this.registrar.unregister(registrarHandlerId)

    this.log('stopping')
    for (const peerStreams of this.peers.values()) {
      peerStreams.close()
    }

    this.peers.clear()
    this.subscriptions.clear()
    this.log('stopped')

    // Gossipsub

    if (this.heartbeatTimer) {
      this.heartbeatTimer.cancel()
      this.heartbeatTimer = null
    }

    this.score.stop()

    this.mesh.clear()
    this.fanout.clear()
    this.fanoutLastpub.clear()
    this.gossip.clear()
    this.control.clear()
    this.peerhave.clear()
    this.iasked.clear()
    this.backoff.clear()
    this.outbound.clear()
    this.gossipTracer.clear()
    this.seenCache.clear()
    if (this.fastMsgIdCache) this.fastMsgIdCache.clear()
    if (this.directPeerInitial) clearTimeout(this.directPeerInitial)
  }

  /** FOR DEBUG ONLY - Dump peer stats for all peers. Data is cloned, safe to mutate */
  dumpPeerScoreStats(): PeerScoreStatsDump {
    return this.score.dumpPeerScoreStats()
  }

  /**
   * On an inbound stream opened
   */
  private onIncomingStream({ protocol, stream, connection }: any) {
    const peerId = connection.remotePeer
    const peer = this.addPeer(peerId, protocol, connection.stat.direction)
    const inboundStream = peer.attachInboundStream(stream)

    this.pipePeerReadStream(peerId, inboundStream).catch((err) => this.log(err))
  }

  /**
   * Registrar notifies an established connection with pubsub protocol
   */
  protected async onPeerConnected(peerId: PeerId, conn: Connection): Promise<void> {
    this.log('connected %s %s', peerId.toB58String(), conn.stat.direction)

    try {
      const { stream, protocol } = await conn.newStream(this.multicodecs)
      const peer = this.addPeer(peerId, protocol, conn.stat.direction)
      await peer.attachOutboundStream(stream)
    } catch (err) {
      this.log(err)
    }

    // Immediately send my own subscriptions to the newly established conn
    if (this.subscriptions.size > 0) {
      this.sendSubscriptions(peerId.toB58String(), Array.from(this.subscriptions), true)
    }
  }

  /**
   * Registrar notifies a closing connection with pubsub protocol
   */
  protected onPeerDisconnected(peerId: PeerId, err?: Error): void {
    const idB58Str = peerId.toB58String()

    this.log('connection ended', idB58Str, err)
    this.removePeer(peerId)
  }

  /**
   * Add a peer to the router
   */
  private addPeer(peerId: PeerId, protocol: string, direction: ConnectionDirection): PeerStreams {
    const peerIdStr = peerId.toB58String()
    let peerStreams = this.peers.get(peerIdStr)

    // If peer streams already exists, do nothing
    if (peerStreams === undefined) {
      // else create a new peer streams
      this.log('new peer %s', peerIdStr)

      peerStreams = new PeerStreams({
        id: peerId,
        protocol
      })

      this.peers.set(peerIdStr, peerStreams)
      peerStreams.addListener('close', () => this.removePeer(peerId))
    }

    // Add to peer scoring
    this.score.addPeer(peerIdStr)
    if (protocol === constants.FloodsubID) {
      this.floodsubPeers.add(peerIdStr)
    }
    this.metrics?.peersPerProtocol.inc({ protocol }, 1)

    // track the connection direction. Don't allow to unset outbound
    if (!this.outbound.get(peerIdStr)) {
      this.outbound.set(peerIdStr, direction === 'outbound')
    }

    return peerStreams
  }

  /**
   * Removes a peer from the router
   */
  private removePeer(peerId: PeerId): PeerStreams | undefined {
    const id = peerId.toB58String()
    const peerStreams = this.peers.get(id)

    if (peerStreams != null) {
      this.metrics?.peersPerProtocol.inc({ protocol: peerStreams.protocol }, -1)

      // delete peer streams. Must delete first to prevent re-entracy loop in .close()
      this.log('delete peer %s', id)
      this.peers.delete(id)

      // close peer streams
      peerStreams.close()

      // remove peer from topics map
      for (const peers of this.topics.values()) {
        peers.delete(id)
      }
    }

    // Remove this peer from the mesh
    // eslint-disable-next-line no-unused-vars
    for (const [topicStr, peers] of this.mesh) {
      if (peers.delete(id) === true) {
        this.metrics?.onRemoveFromMesh(topicStr, ChurnReason.Dc, 1)
      }
    }

    // Remove this peer from the fanout
    // eslint-disable-next-line no-unused-vars
    for (const peers of this.fanout.values()) {
      peers.delete(id)
    }

    // Remove from floodsubPeers
    this.floodsubPeers.delete(id)
    // Remove from gossip mapping
    this.gossip.delete(id)
    // Remove from control mapping
    this.control.delete(id)
    // Remove from backoff mapping
    this.outbound.delete(id)

    // Remove from peer scoring
    this.score.removePeer(id)

    this.acceptFromWhitelist.delete(id)

    return peerStreams
  }

  // API METHODS

  get started(): boolean {
    return this.status.code === GossipStatusCode.started
  }

  /**
   * Get a the peer-ids in a topic mesh
   */
  getMeshPeers(topic: TopicStr): PeerIdStr[] {
    const peersInTopic = this.mesh.get(topic)
    return peersInTopic ? Array.from(peersInTopic) : []
  }

  /**
   * Get a list of the peer-ids that are subscribed to one topic.
   */
  getSubscribers(topic: TopicStr): PeerIdStr[] {
    const peersInTopic = this.topics.get(topic)
    return peersInTopic ? Array.from(peersInTopic) : []
  }

  /**
   * Get the list of topics which the peer is subscribed to.
   */
  getTopics(): TopicStr[] {
    return Array.from(this.subscriptions)
  }

  // TODO: Reviewing Pubsub API

  // MESSAGE METHODS

  /**
   * Responsible for processing each RPC message received by other peers.
   */
  async pipePeerReadStream(peerId: PeerId, stream: AsyncIterable<Uint8Array | BufferList>): Promise<void> {
    try {
      await pipe(stream, async (source) => {
        for await (const data of source) {
          try {
            // TODO: Check max gossip message size, before decodeRpc()

            // Note: `stream` maybe a BufferList which requires calling .slice to concat all the chunks into
            // a single Buffer instance that protobuf js can deal with.
            // Otherwise it will throw:
            // ```
            // Error: illegal buffer
            //   at create_typed_array (js-libp2p-gossipsub/node_modules/protobufjs/src/reader.js:47:15)
            const rpcBytes = data instanceof Uint8Array ? data : data.slice()

            // Note: This function may throw, it must be wrapped in a try {} catch {} to prevent closing the stream.
            // TODO: What should we do if the entire RPC is invalid?
            const rpc = RPC.decode(rpcBytes)

            this.metrics?.onRpcRecv(rpc, rpcBytes.length)

            // Since processRpc may be overridden entirely in unsafe ways,
            // the simplest/safest option here is to wrap in a function and capture all errors
            // to prevent a top-level unhandled exception
            // This processing of rpc messages should happen without awaiting full validation/execution of prior messages
            if (this.opts.awaitRpcHandler) {
              await this.handleReceivedRpc(peerId, rpc)
            } else {
              this.handleReceivedRpc(peerId, rpc).catch((err) => this.log(err))
            }
          } catch (e) {
            this.log(e as Error)
          }
        }
      })
    } catch (err) {
      this.onPeerDisconnected(peerId, err as Error)
    }
  }

  /**
   * Handles an rpc request from a peer
   */
  async handleReceivedRpc(from: PeerId, rpc: IRPC): Promise<void> {
    // Check if peer is graylisted in which case we ignore the event
    if (!this.acceptFrom(from.toB58String())) {
      this.log('received message from unacceptable peer %s', from.toB58String())
      this.metrics?.rpcRecvNotAccepted.inc()
      return
    }

    this.log('rpc from %s', from.toB58String())

    // Handle received subscriptions
    if (rpc.subscriptions && rpc.subscriptions.length > 0) {
      // update peer subscriptions
      rpc.subscriptions.forEach((subOpt) => {
        this.handleReceivedSubscription(from, subOpt)
      })

      this.emit('pubsub:subscription-change', from, rpc.subscriptions)
    }

    // Handle messages
    // TODO: (up to limit)
    if (rpc.messages) {
      for (const message of rpc.messages) {
        const handleReceivedMessagePromise = this.handleReceivedMessage(from, message)
          // Should never throw, but handle just in case
          .catch((err) => this.log(err))

        if (this.opts.awaitRpcMessageHandler) {
          await handleReceivedMessagePromise
        }
      }
    }

    // Handle control messages
    if (rpc.control) {
      await this.handleControlMessage(from.toB58String(), rpc.control)
    }
  }

  /**
   * Handles a subscription change from a peer
   */
  handleReceivedSubscription(from: PeerId, subOpt: RPC.ISubOpts): void {
    if (subOpt.topicID == null) {
      return
    }

    this.log('subscription update from %s topic %s', from.toB58String(), subOpt.topicID)

    let topicSet = this.topics.get(subOpt.topicID)
    if (topicSet == null) {
      topicSet = new Set()
      this.topics.set(subOpt.topicID, topicSet)
    }

    if (subOpt.subscribe) {
      // subscribe peer to new topic
      topicSet.add(from.toB58String())
    } else {
      // unsubscribe from existing topic
      topicSet.delete(from.toB58String())
    }

    // TODO: rust-libp2p has A LOT more logic here
  }

  /**
   * Handles a newly received message from an RPC.
   * May forward to all peers in the mesh.
   */
  async handleReceivedMessage(from: PeerId, rpcMsg: RPC.IMessage): Promise<void> {
    this.metrics?.onMsgRecvPreValidation(rpcMsg.topic)

    const validationResult = await this.validateReceivedMessage(from, rpcMsg)

    this.metrics?.onMsgRecvResult(rpcMsg.topic, validationResult.code)

    switch (validationResult.code) {
      case MessageStatus.duplicate:
        // Report the duplicate
        this.score.duplicateMessage(from.toB58String(), validationResult.msgId, rpcMsg.topic)
        this.mcache.observeDuplicate(validationResult.msgId, from.toB58String())
        return

      case MessageStatus.invalid:
        // invalid messages received
        // metrics.register_invalid_message(&raw_message.topic)
        // Tell peer_score about reject
        // Reject the original source, and any duplicates we've seen from other peers.
        if (validationResult.msgId) {
          this.score.rejectMessage(from.toB58String(), validationResult.msgId, rpcMsg.topic, validationResult.reason)
          this.gossipTracer.rejectMessage(validationResult.msgId, validationResult.reason)
        } else {
          this.score.rejectInvalidMessage(from.toB58String(), rpcMsg.topic)
        }

        this.metrics?.onMsgRecvInvalid(rpcMsg.topic, validationResult)
        return

      case MessageStatus.valid: {
        const { msgIdStr, msg } = validationResult
        // Tells score that message arrived (but is maybe not fully validated yet).
        // Consider the message as delivered for gossip promises.
        this.score.validateMessage(msgIdStr)
        this.gossipTracer.deliverMessage(msgIdStr)

        // Add the message to our memcache
        this.mcache.put(msgIdStr, rpcMsg)

        // Dispatch the message to the user if we are subscribed to the topic
        if (this.subscriptions.has(rpcMsg.topic)) {
          const isFromSelf = this.peerId && this.peerId.equals(from)

          if (!isFromSelf || this.opts.emitSelf) {
            super.emit('gossipsub:message', {
              propagationSource: from,
              msgId: msgIdStr,
              msg
            })
            // TODO: Add option to switch between emit per topic or all messages in one
            super.emit(rpcMsg.topic, msg)
          }
        }

        // Forward the message to mesh peers, if no validation is required
        // If asyncValidation is ON, expect the app layer to call reportMessageValidationResult(), then forward
        if (!this.opts.asyncValidation) {
          // TODO: in rust-libp2p
          // .forward_msg(&msg_id, raw_message, Some(propagation_source))
          this.forwardMessage(msgIdStr, rpcMsg, from.toB58String())
        }
      }
    }
  }

  // # Ethereum consensus message-id function
  //
  // ## phase0
  //
  // The message-id of a gossipsub message MUST be the following 20 byte value computed from the message data:
  //
  // - If message.data has a valid snappy decompression, set message-id to the first 20 bytes of the SHA256 hash of
  //   the concatenation of MESSAGE_DOMAIN_VALID_SNAPPY with the snappy decompressed message data,
  //   i.e. SHA256(MESSAGE_DOMAIN_VALID_SNAPPY + snappy_decompress(message.data))[:20].
  //
  // - Otherwise, set message-id to the first 20 bytes of the SHA256 hash of the concatenation of
  //   MESSAGE_DOMAIN_INVALID_SNAPPY with the raw message data,
  //   i.e. SHA256(MESSAGE_DOMAIN_INVALID_SNAPPY + message.data)[:20].
  //
  // ## altair
  //
  // The derivation of the message-id has changed starting with Altair to incorporate the message topic along with the
  // message data. These are fields of the Message Protobuf, and interpreted as empty byte strings if missing. The
  // message-id MUST be the following 20 byte value computed from the message:
  //
  // - If message.data has a valid snappy decompression, set message-id to the first 20 bytes of the SHA256 hash of
  //   the concatenation of the following data: MESSAGE_DOMAIN_VALID_SNAPPY, the length of the topic byte string
  //   (encoded as little-endian uint64), the topic byte string, and the snappy decompressed message data:
  //   i.e. SHA256(MESSAGE_DOMAIN_VALID_SNAPPY + uint_to_bytes(uint64(len(message.topic))) + message.topic + snappy_decompress(message.data))[:20].
  //
  // - Otherwise, set message-id to the first 20 bytes of the SHA256 hash of the concatenation of the following data:
  //   MESSAGE_DOMAIN_INVALID_SNAPPY, the length of the topic byte string (encoded as little-endian uint64),the topic
  //   byte string, and the raw message data:
  //   i.e. SHA256(MESSAGE_DOMAIN_INVALID_SNAPPY + uint_to_bytes(uint64(len(message.topic))) + message.topic + message.data)[:20].

  /**
   * Handles a newly received message from an RPC.
   * May forward to all peers in the mesh.
   */
  async validateReceivedMessage(propagationSource: PeerId, rpcMsg: RPC.IMessage): Promise<ReceivedMessageResult> {
    this.metrics?.onMsgRecvPreValidation(rpcMsg.topic)

    // Perform basic validation on message and convert to RawGossipsubMessage for fastMsgIdFn()
    const validationResult = await validateToRawMessage(this.globalSignaturePolicy, rpcMsg)

    if (!validationResult.valid) {
      return { code: MessageStatus.invalid, reason: RejectReason.Error, error: validationResult.error }
    }

    // Fast message ID stuff
    const fastMsgIdStr = this.fastMsgIdFn?.(rpcMsg)
    const msgIdCached = fastMsgIdStr && this.fastMsgIdCache?.get(fastMsgIdStr)

    if (msgIdCached) {
      // This message has been seen previously. Ignore it
      return { code: MessageStatus.duplicate, msgId: msgIdCached }
    }

    // Try and perform the data transform to the message. If it fails, consider it invalid.
    let data: Uint8Array
    try {
      const transformedData = rpcMsg.data ?? new Uint8Array(0)
      data = this.dataTransform ? this.dataTransform.inboundTransform(rpcMsg.topic, transformedData) : transformedData
    } catch (e) {
      this.log('Invalid message, transform failed', e)
      return { code: MessageStatus.invalid, reason: RejectReason.Error, error: ValidateError.TransformFailed }
    }

    const msg: GossipsubMessage = {
      from: rpcMsg.from === null ? undefined : rpcMsg.from,
      data: data,
      seqno: rpcMsg.seqno === null ? undefined : rpcMsg.seqno,
      topic: rpcMsg.topic
    }

    // TODO: Check if message is from a blacklisted source or propagation origin
    // - Reject any message from a blacklisted peer
    // - Also reject any message that originated from a blacklisted peer
    // - reject messages claiming to be from ourselves but not locally published

    // Calculate the message id on the transformed data.
    const msgIdStr = msgIdCached ?? messageIdToString(await this.msgIdFn(msg))

    // Add the message to the duplicate caches
    if (fastMsgIdStr) this.fastMsgIdCache?.put(fastMsgIdStr, msgIdStr)

    if (this.seenCache.has(msgIdStr)) {
      return { code: MessageStatus.duplicate, msgId: msgIdStr }
    } else {
      this.seenCache.put(msgIdStr)
    }

    // (Optional) Provide custom validation here with dynamic validators per topic
    // NOTE: This custom topicValidator() must resolve fast (< 100ms) to allow scores
    // to not penalize peers for long validation times.
    const topicValidator = this.topicValidators.get(rpcMsg.topic)
    if (topicValidator != null) {
      let acceptance: MessageAcceptance
      // Use try {} catch {} in case topicValidator() is syncronous
      try {
        acceptance = await topicValidator(msg.topic, msg, propagationSource)
      } catch (e) {
        // TODO: Handle error for backwards compatibility
        const errCode = (e as { code: string }).code
        if (errCode === constants.ERR_TOPIC_VALIDATOR_IGNORE) acceptance = MessageAcceptance.Ignore
        if (errCode === constants.ERR_TOPIC_VALIDATOR_REJECT) acceptance = MessageAcceptance.Reject
        else acceptance = MessageAcceptance.Ignore
      }

      if (acceptance !== MessageAcceptance.Accept) {
        return { code: MessageStatus.invalid, reason: rejectReasonFromAcceptance(acceptance), msgId: msgIdStr }
      }
    }

    return { code: MessageStatus.valid, msgIdStr, msg }
  }

  /**
   * Send an rpc object to a peer with subscriptions
   */
  private sendSubscriptions(toPeer: PeerIdStr, topics: string[], subscribe: boolean): void {
    this.sendRpc(toPeer, {
      subscriptions: topics.map((topic) => ({ topicID: topic, subscribe })),
      messages: []
    })
  }

  /**
   * Handles an rpc control message from a peer
   */
  private async handleControlMessage(id: PeerIdStr, controlMsg: RPC.IControlMessage): Promise<void> {
    if (!controlMsg) {
      return
    }

    const iwant = controlMsg.ihave ? this.handleIHave(id, controlMsg.ihave) : []
    const ihave = controlMsg.iwant ? this.handleIWant(id, controlMsg.iwant) : []
    const prune = controlMsg.graft ? await this.handleGraft(id, controlMsg.graft) : []
    controlMsg.prune && this.handlePrune(id, controlMsg.prune)

    if (!iwant.length && !ihave.length && !prune.length) {
      return
    }

    this.sendRpc(id, createGossipRpc(ihave, { iwant, prune }))
  }

  /**
   * Whether to accept a message from a peer
   */
  private acceptFrom(id: PeerIdStr): boolean {
    if (this.direct.has(id)) {
      return true
    }

    const now = Date.now()
    const entry = this.acceptFromWhitelist.get(id)

    if (entry && entry.messagesAccepted < ACCEPT_FROM_WHITELIST_MAX_MESSAGES && entry.acceptUntil >= now) {
      entry.messagesAccepted += 1
      return true
    }

    const score = this.score.score(id)
    if (score >= ACCEPT_FROM_WHITELIST_THRESHOLD_SCORE) {
      // peer is unlikely to be able to drop its score to `graylistThreshold`
      // after 128 messages or 1s
      this.acceptFromWhitelist.set(id, {
        messagesAccepted: 0,
        acceptUntil: now + ACCEPT_FROM_WHITELIST_DURATION_MS
      })
    } else {
      this.acceptFromWhitelist.delete(id)
    }

    return score >= this.opts.scoreThresholds.graylistThreshold
  }

  /**
   * Handles IHAVE messages
   */
  private handleIHave(id: PeerIdStr, ihave: RPC.IControlIHave[]): RPC.IControlIWant[] {
    if (!ihave.length) {
      return []
    }

    // we ignore IHAVE gossip from any peer whose score is below the gossips threshold
    const score = this.score.score(id)
    if (score < this.opts.scoreThresholds.gossipThreshold) {
      this.log('IHAVE: ignoring peer %s with score below threshold [ score = %d ]', id, score)
      this.metrics?.ihaveRcvIgnored.inc({ reason: IHaveIgnoreReason.LowScore })
      return []
    }

    // IHAVE flood protection
    const peerhave = (this.peerhave.get(id) || 0) + 1
    this.peerhave.set(id, peerhave)
    if (peerhave > constants.GossipsubMaxIHaveMessages) {
      this.log(
        'IHAVE: peer %s has advertised too many times (%d) within this heartbeat interval; ignoring',
        id,
        peerhave
      )
      this.metrics?.ihaveRcvIgnored.inc({ reason: IHaveIgnoreReason.MaxIhave })
      return []
    }

    const iasked = this.iasked.get(id) || 0
    if (iasked >= constants.GossipsubMaxIHaveLength) {
      this.log('IHAVE: peer %s has already advertised too many messages (%d); ignoring', id, iasked)
      this.metrics?.ihaveRcvIgnored.inc({ reason: IHaveIgnoreReason.MaxIasked })
      return []
    }

    // string msgId => msgId
    const iwant = new Map<MsgIdStr, Uint8Array>()

    ihave.forEach(({ topicID, messageIDs }) => {
      if (!topicID || !messageIDs || !this.mesh.has(topicID)) {
        return
      }

      let idonthave = 0

      messageIDs.forEach((msgId) => {
        const msgIdStr = messageIdToString(msgId)
        if (!this.seenCache.has(msgIdStr)) {
          iwant.set(msgIdStr, msgId)
          idonthave++
        }
      })

      this.metrics?.onIhaveRcv(topicID, messageIDs.length, idonthave)
    })

    if (!iwant.size) {
      return []
    }

    let iask = iwant.size
    if (iask + iasked > constants.GossipsubMaxIHaveLength) {
      iask = constants.GossipsubMaxIHaveLength - iasked
    }

    this.log('IHAVE: Asking for %d out of %d messages from %s', iask, iwant.size, id)

    let iwantList = Array.from(iwant.values())
    // ask in random order
    shuffle(iwantList)

    // truncate to the messages we are actually asking for and update the iasked counter
    iwantList = iwantList.slice(0, iask)
    this.iasked.set(id, iasked + iask)

    this.gossipTracer.addPromise(id, iwantList)

    return [
      {
        messageIDs: iwantList
      }
    ]
  }

  /**
   * Handles IWANT messages
   * Returns messages to send back to peer
   */
  private handleIWant(id: PeerIdStr, iwant: RPC.IControlIWant[]): RPC.IMessage[] {
    if (!iwant.length) {
      return []
    }

    // we don't respond to IWANT requests from any per whose score is below the gossip threshold
    const score = this.score.score(id)
    if (score < this.opts.scoreThresholds.gossipThreshold) {
      this.log('IWANT: ignoring peer %s with score below threshold [score = %d]', id, score)
      return []
    }

    const ihave = new Map<MsgIdStr, RPC.IMessage>()
    const iwantByTopic = new Map<TopicStr, number>()
    let iwantDonthave = 0

    iwant.forEach(({ messageIDs }) => {
      messageIDs &&
        messageIDs.forEach((msgId) => {
          const msgIdStr = messageIdToString(msgId)
          const entry = this.mcache.getWithIWantCount(msgIdStr, id)
          if (!entry) {
            iwantDonthave++
            return
          }

          iwantByTopic.set(entry.msg.topic, 1 + (iwantByTopic.get(entry.msg.topic) ?? 0))

          if (entry.count > constants.GossipsubGossipRetransmission) {
            this.log('IWANT: Peer %s has asked for message %s too many times: ignoring request', id, msgId)
            return
          }

          ihave.set(msgIdStr, entry.msg)
        })
    })

    this.metrics?.onIwantRcv(iwantByTopic, iwantDonthave)

    if (!ihave.size) {
      return []
    }

    this.log('IWANT: Sending %d messages to %s', ihave.size, id)

    return Array.from(ihave.values())
  }

  /**
   * Handles Graft messages
   */
  private async handleGraft(id: PeerIdStr, graft: RPC.IControlGraft[]): Promise<RPC.IControlPrune[]> {
    const prune: TopicStr[] = []
    const score = this.score.score(id)
    const now = this._now()
    let doPX = this.opts.doPX

    graft.forEach(({ topicID }) => {
      if (!topicID) {
        return
      }
      const peersInMesh = this.mesh.get(topicID)
      if (!peersInMesh) {
        // don't do PX when there is an unknown topic to avoid leaking our peers
        doPX = false
        // spam hardening: ignore GRAFTs for unknown topics
        return
      }

      // check if peer is already in the mesh; if so do nothing
      if (peersInMesh.has(id)) {
        return
      }

      // we don't GRAFT to/from direct peers; complain loudly if this happens
      if (this.direct.has(id)) {
        this.log('GRAFT: ignoring request from direct peer %s', id)
        // this is possibly a bug from a non-reciprical configuration; send a PRUNE
        prune.push(topicID)
        // but don't px
        doPX = false
        return
      }

      // make sure we are not backing off that peer
      const expire = this.backoff.get(topicID)?.get(id)
      if (typeof expire === 'number' && now < expire) {
        this.log('GRAFT: ignoring backed off peer %s', id)
        // add behavioral penalty
        this.score.addPenalty(id, 1, ScorePenalty.GraftBackoff)
        // no PX
        doPX = false
        // check the flood cutoff -- is the GRAFT coming too fast?
        const floodCutoff = expire + constants.GossipsubGraftFloodThreshold - constants.GossipsubPruneBackoff
        if (now < floodCutoff) {
          // extra penalty
          this.score.addPenalty(id, 1, ScorePenalty.GraftBackoff)
        }
        // refresh the backoff
        this.addBackoff(id, topicID)
        prune.push(topicID)
        return
      }

      // check the score
      if (score < 0) {
        // we don't GRAFT peers with negative score
        this.log('GRAFT: ignoring peer %s with negative score: score=%d, topic=%s', id, score, topicID)
        // we do send them PRUNE however, because it's a matter of protocol correctness
        prune.push(topicID)
        // but we won't PX to them
        doPX = false
        // add/refresh backoff so that we don't reGRAFT too early even if the score decays
        this.addBackoff(id, topicID)
        return
      }

      // check the number of mesh peers; if it is at (or over) Dhi, we only accept grafts
      // from peers with outbound connections; this is a defensive check to restrict potential
      // mesh takeover attacks combined with love bombing
      if (peersInMesh.size >= this.opts.Dhi && !this.outbound.get(id)) {
        prune.push(topicID)
        this.addBackoff(id, topicID)
        return
      }

      this.log('GRAFT: Add mesh link from %s in %s', id, topicID)
      this.score.graft(id, topicID)
      peersInMesh.add(id)

      this.metrics?.onAddToMesh(topicID, InclusionReason.Subscribed, 1)
    })

    if (!prune.length) {
      return []
    }

    return Promise.all(prune.map((topic) => this.makePrune(id, topic, doPX)))
  }

  /**
   * Handles Prune messages
   */
  private handlePrune(id: PeerIdStr, prune: RPC.IControlPrune[]): void {
    const score = this.score.score(id)
    prune.forEach(({ topicID, backoff, peers }) => {
      if (!topicID) {
        return
      }

      const peersInMesh = this.mesh.get(topicID)
      if (!peersInMesh) {
        return
      }

      this.log('PRUNE: Remove mesh link to %s in %s', id, topicID)
      this.score.prune(id, topicID)
      if (peersInMesh.delete(id) === true) {
        this.metrics?.onRemoveFromMesh(topicID, ChurnReason.Unsub, 1)
      }

      // is there a backoff specified by the peer? if so obey it
      if (typeof backoff === 'number' && backoff > 0) {
        this.doAddBackoff(id, topicID, backoff * 1000)
      } else {
        this.addBackoff(id, topicID)
      }

      // PX
      if (peers && peers.length) {
        // we ignore PX from peers with insufficient scores
        if (score < this.opts.scoreThresholds.acceptPXThreshold) {
          this.log(
            'PRUNE: ignoring PX from peer %s with insufficient score [score = %d, topic = %s]',
            id,
            score,
            topicID
          )
          return
        }
        this.pxConnect(peers)
      }
    })
  }

  /**
   * Add standard backoff log for a peer in a topic
   */
  private addBackoff(id: PeerIdStr, topic: TopicStr): void {
    this.doAddBackoff(id, topic, constants.GossipsubPruneBackoff)
  }

  /**
   * Add backoff expiry interval for a peer in a topic
   * @param interval backoff duration in milliseconds
   */
  private doAddBackoff(id: PeerIdStr, topic: TopicStr, interval: number): void {
    let backoff = this.backoff.get(topic)
    if (!backoff) {
      backoff = new Map()
      this.backoff.set(topic, backoff)
    }
    const expire = this._now() + interval
    const existingExpire = backoff.get(id) || 0
    if (existingExpire < expire) {
      backoff.set(id, expire)
    }
  }

  /**
   * Apply penalties from broken IHAVE/IWANT promises
   */
  private applyIwantPenalties(): void {
    this.gossipTracer.getBrokenPromises().forEach((count, p) => {
      this.log("peer %s didn't follow up in %d IWANT requests; adding penalty", p, count)
      this.score.addPenalty(p, count, ScorePenalty.BrokenPromise)
    })
  }

  /**
   * Clear expired backoff expiries
   */
  private clearBackoff(): void {
    // we only clear once every GossipsubPruneBackoffTicks ticks to avoid iterating over the maps too much
    if (this.heartbeatTicks % constants.GossipsubPruneBackoffTicks !== 0) {
      return
    }

    const now = this._now()
    this.backoff.forEach((backoff, topic) => {
      backoff.forEach((expire, id) => {
        if (expire < now) {
          backoff.delete(id)
        }
      })
      if (backoff.size === 0) {
        this.backoff.delete(topic)
      }
    })
  }

  /**
   * Maybe reconnect to direct peers
   */
  private directConnect(): void {
    const toconnect: PeerIdStr[] = []
    this.direct.forEach((id) => {
      const peer = this.peers.get(id)
      if (!peer || !peer.isWritable) {
        toconnect.push(id)
      }
    })

    if (toconnect.length) {
      toconnect.forEach((id) => {
        this.connect(id)
      })
    }
  }

  /**
   * Maybe attempt connection given signed peer records
   */
  private async pxConnect(peers: RPC.IPeerInfo[]): Promise<void> {
    if (peers.length > constants.GossipsubPrunePeers) {
      shuffle(peers)
      peers = peers.slice(0, constants.GossipsubPrunePeers)
    }
    const toconnect: PeerIdStr[] = []

    await Promise.all(
      peers.map(async (pi) => {
        if (!pi.peerID) {
          return
        }

        const p = createFromBytes(pi.peerID)
        const id = p.toB58String()

        if (this.peers.has(id)) {
          return
        }

        if (!pi.signedPeerRecord) {
          toconnect.push(id)
          return
        }

        // The peer sent us a signed record
        // This is not a record from the peer who sent the record, but another peer who is connected with it
        // Ensure that it is valid
        try {
          const envelope = await Envelope.openAndCertify(pi.signedPeerRecord, 'libp2p-peer-record')
          const eid = envelope.peerId.toB58String()
          if (id !== eid) {
            this.log("bogus peer record obtained through px: peer ID %s doesn't match expected peer %s", eid, id)
            return
          }
          if (!this._libp2p.peerStore.addressBook.consumePeerRecord(envelope)) {
            this.log('bogus peer record obtained through px: could not add peer record to address book')
            return
          }
          toconnect.push(id)
        } catch (e) {
          this.log('bogus peer record obtained through px: invalid signature or not a peer record')
        }
      })
    )

    if (!toconnect.length) {
      return
    }

    toconnect.forEach((id) => this.connect(id))
  }

  /**
   * Connect to a peer using the gossipsub protocol
   */
  private connect(id: PeerIdStr): void {
    this.log('Initiating connection with %s', id)
    this._libp2p.dialProtocol(createFromB58String(id), this.multicodecs)
  }

  /**
   * Subscribes to a topic
   */
  subscribe(topic: TopicStr): void {
    if (this.status.code !== GossipStatusCode.started) {
      throw new Error('Pubsub has not started')
    }

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.add(topic)

      for (const peerId of this.peers.keys()) {
        this.sendSubscriptions(peerId, [topic], true)
      }
    }

    this.join(topic)
  }

  /**
   * Unsubscribe to a topic
   */
  unsubscribe(topic: TopicStr): void {
    if (this.status.code !== GossipStatusCode.started) {
      throw new Error('Pubsub is not started')
    }

    const wasSubscribed = this.subscriptions.delete(topic)

    this.log('unsubscribe from %s - am subscribed %s', topic, wasSubscribed)

    if (wasSubscribed) {
      for (const peerId of this.peers.keys()) {
        this.sendSubscriptions(peerId, [topic], false)
      }
    }

    this.leave(topic)
  }

  /**
   * Join topic
   */
  join(topic: TopicStr): void {
    if (this.status.code !== GossipStatusCode.started) {
      throw new Error('Gossipsub has not started')
    }

    // if we are already in the mesh, return
    if (this.mesh.has(topic)) {
      return
    }

    this.log('JOIN %s', topic)
    this.metrics?.onJoin(topic)

    const toAdd = new Set<PeerIdStr>()

    // check if we have mesh_n peers in fanout[topic] and add them to the mesh if we do,
    // removing the fanout entry.
    const fanoutPeers = this.fanout.get(topic)
    if (fanoutPeers) {
      // Remove fanout entry and the last published time
      this.fanout.delete(topic)
      this.fanoutLastpub.delete(topic)

      // remove explicit peers, peers with negative scores, and backoffed peers
      fanoutPeers.forEach((id) => {
        // TODO:rust-libp2p checks `self.backoffs.is_backoff_with_slack()`
        if (!this.direct.has(id) && this.score.score(id) >= 0) {
          toAdd.add(id)
        }
      })

      this.metrics?.onAddToMesh(topic, InclusionReason.Fanout, toAdd.size)
    }

    // check if we need to get more peers, which we randomly select
    if (toAdd.size < this.opts.D) {
      const fanoutCount = toAdd.size
      const newPeers = this.getRandomGossipPeers(
        topic,
        this.opts.D,
        (id: PeerIdStr): boolean =>
          // filter direct peers and peers with negative score
          !toAdd.has(id) && !this.direct.has(id) && this.score.score(id) >= 0
      )

      newPeers.forEach((peer) => {
        toAdd.add(peer)
      })

      this.metrics?.onAddToMesh(topic, InclusionReason.Random, toAdd.size - fanoutCount)
    }

    this.mesh.set(topic, toAdd)

    this.mesh.get(topic)!.forEach((id) => {
      this.log('JOIN: Add mesh link to %s in %s', id, topic)
      this.sendGraft(id, topic)

      // rust-libp2p
      // - peer_score.graft()
      // - Self::control_pool_add()
      // - peer_added_to_mesh()
    })
  }

  /**
   * Leave topic
   */
  leave(topic: TopicStr): void {
    if (this.status.code !== GossipStatusCode.started) {
      throw new Error('Gossipsub has not started')
    }

    this.log('LEAVE %s', topic)
    this.metrics?.onLeave(topic)

    // Send PRUNE to mesh peers
    const meshPeers = this.mesh.get(topic)
    if (meshPeers) {
      meshPeers.forEach((id) => {
        this.log('LEAVE: Remove mesh link to %s in %s', id, topic)
        this.sendPrune(id, topic)
      })
      this.mesh.delete(topic)
    }
  }

  private selectPeersToForward(topic: TopicStr, propagationSource?: PeerIdStr, excludePeers?: Set<PeerIdStr>) {
    const tosend = new Set<PeerIdStr>()

    // Add explicit peers
    const peersInTopic = this.topics.get(topic)
    if (peersInTopic) {
      this.direct.forEach((peer) => {
        if (peersInTopic.has(peer) && propagationSource !== peer && !excludePeers?.has(peer)) {
          tosend.add(peer)
        }
      })

      // As of Mar 2022, spec + golang-libp2p include this while rust-libp2p does not
      // rust-libp2p: https://github.com/libp2p/rust-libp2p/blob/6cc3b4ec52c922bfcf562a29b5805c3150e37c75/protocols/gossipsub/src/behaviour.rs#L2693
      // spec: https://github.com/libp2p/specs/blob/10712c55ab309086a52eec7d25f294df4fa96528/pubsub/gossipsub/gossipsub-v1.0.md?plain=1#L361
      this.floodsubPeers.forEach((peer) => {
        if (
          peersInTopic.has(peer) &&
          propagationSource !== peer &&
          !excludePeers?.has(peer) &&
          this.score.score(peer) >= this.opts.scoreThresholds.publishThreshold
        ) {
          tosend.add(peer)
        }
      })
    }

    // add mesh peers
    const meshPeers = this.mesh.get(topic)
    if (meshPeers && meshPeers.size > 0) {
      meshPeers.forEach((peer) => {
        if (propagationSource !== peer && !excludePeers?.has(peer)) {
          tosend.add(peer)
        }
      })
    }

    return tosend
  }

  private selectPeersToPublish(topic: TopicStr): {
    tosend: Set<PeerIdStr>
    tosendCount: ToSendGroupCount
  } {
    const tosend = new Set<PeerIdStr>()
    const tosendCount: ToSendGroupCount = {
      direct: 0,
      floodsub: 0,
      mesh: 0,
      fanout: 0
    }

    const peersInTopic = this.topics.get(topic)
    if (peersInTopic) {
      // flood-publish behavior
      // send to direct peers and _all_ peers meeting the publishThreshold
      if (this.opts.floodPublish) {
        peersInTopic.forEach((id) => {
          if (this.direct.has(id)) {
            tosend.add(id)
            tosendCount.direct++
          } else if (this.score.score(id) >= this.opts.scoreThresholds.publishThreshold) {
            tosend.add(id)
            tosendCount.floodsub++
          }
        })
      }

      // non-flood-publish behavior
      // send to direct peers, subscribed floodsub peers
      // and some mesh peers above publishThreshold
      else {
        // direct peers (if subscribed)
        this.direct.forEach((id) => {
          if (peersInTopic.has(id)) {
            tosend.add(id)
            tosendCount.direct++
          }
        })

        // floodsub peers
        // Note: if there are no floodsub peers, we save a loop through peersInTopic Map
        this.floodsubPeers.forEach((id) => {
          if (peersInTopic.has(id) && this.score.score(id) >= this.opts.scoreThresholds.publishThreshold) {
            tosend.add(id)
            tosendCount.floodsub++
          }
        })

        // Gossipsub peers handling
        const meshPeers = this.mesh.get(topic)
        if (meshPeers && meshPeers.size > 0) {
          meshPeers.forEach((peer) => {
            tosend.add(peer)
            tosendCount.mesh++
          })
        }

        // We are not in the mesh for topic, use fanout peers
        else {
          const fanoutPeers = this.fanout.get(topic)
          if (fanoutPeers && fanoutPeers.size > 0) {
            fanoutPeers.forEach((peer) => {
              tosend.add(peer)
              tosendCount.fanout++
            })
          }

          // We have no fanout peers, select mesh_n of them and add them to the fanout
          else {
            // If we are not in the fanout, then pick peers in topic above the publishThreshold
            const newFanoutPeers = this.getRandomGossipPeers(topic, this.opts.D, (id) => {
              return this.score.score(id) >= this.opts.scoreThresholds.publishThreshold
            })

            // TODO: Should we check for > 0 here? libp2p-rust does not
            if (newFanoutPeers.size > 0) {
              this.fanout.set(topic, newFanoutPeers)

              newFanoutPeers.forEach((peer) => {
                tosend.add(peer)
                tosendCount.fanout++
              })
            }
          }

          // We are publishing to fanout peers - update the time we published
          this.fanoutLastpub.set(topic, this._now())
        }
      }
    }

    return { tosend, tosendCount }
  }

  /**
   * Forwards a message from our peers.
   *
   * For messages published by us (the app layer), this class uses `publish`
   */
  private forwardMessage(
    msgIdStr: string,
    rawMsg: RPC.IMessage,
    propagationSource?: PeerIdStr,
    excludePeers?: Set<PeerIdStr>
  ): void {
    // message is fully validated inform peer_score
    if (propagationSource) {
      this.score.deliverMessage(propagationSource, msgIdStr, rawMsg.topic)
    }

    const tosend = this.selectPeersToForward(rawMsg.topic, propagationSource, excludePeers)

    // Note: Don't throw if tosend is empty, we can have a mesh with a single peer

    // forward the message to peers
    const rpc = createGossipRpc([rawMsg])
    tosend.forEach((id) => {
      // self.send_message(*peer_id, event.clone())?;
      this.sendRpc(id, rpc)
    })

    this.metrics?.onForwardMsg(rawMsg.topic, tosend.size)
  }

  /**
   * App layer publishes a message to peers.
   * Note: `async` due to crypto only if `StrictSign`, otherwise it's a sync fn.
   *
   * For messages not from us, this class uses `forwardMessage`.
   */
  async publish(topic: TopicStr, data: Uint8Array): Promise<void> {
    const transformedData = this.dataTransform ? this.dataTransform.outboundTransform(topic, data) : data

    // Prepare raw message with user's publishConfig
    const rawMsg = await buildRawMessage(this.publishConfig, topic, transformedData)

    // calculate the message id from the un-transformed data
    const msg: GossipsubMessage = {
      from: rawMsg.from === null ? undefined : rawMsg.from,
      data, // the uncompressed form
      seqno: rawMsg.seqno === null ? undefined : rawMsg.seqno,
      topic
    }
    const msgId = await this.msgIdFn(msg)
    const msgIdStr = messageIdToString(msgId)

    if (this.seenCache.has(msgIdStr)) {
      // This message has already been seen. We don't re-publish messages that have already
      // been published on the network.
      throw Error('PublishError.Duplicate')
    }

    const { tosend, tosendCount } = this.selectPeersToPublish(rawMsg.topic)

    if (tosend.size === 0 && !this.opts.allowPublishToZeroPeers) {
      throw Error('PublishError.InsufficientPeers')
    }

    // If the message isn't a duplicate and we have sent it to some peers add it to the
    // duplicate cache and memcache.
    this.seenCache.put(msgIdStr)
    this.mcache.put(msgIdStr, rawMsg)

    // If the message is anonymous or has a random author add it to the published message ids cache.
    this.publishedMessageIds.put(msgIdStr)

    // Send to set of peers aggregated from direct, mesh, fanout
    const rpc = createGossipRpc([rawMsg])
    tosend.forEach((id) => {
      // self.send_message(*peer_id, event.clone())?;
      this.sendRpc(id, rpc)
    })

    this.metrics?.onPublishMsg(topic, tosendCount, tosend.size, rawMsg.data ? rawMsg.data.length : 0)

    // Dispatch the message to the user if we are subscribed to the topic
    if (this.opts.emitSelf && this.subscriptions.has(topic)) {
      super.emit('gossipsub:message', {
        propagationSource: this.peerId.toB58String(),
        msgId: msgIdStr,
        msg
      })
      // TODO: Add option to switch between emit per topic or all messages in one
      super.emit(topic, msg)
    }
  }

  /// This function should be called when [`GossipsubConfig::validate_messages()`] is `true` after
  /// the message got validated by the caller. Messages are stored in the ['Memcache'] and
  /// validation is expected to be fast enough that the messages should still exist in the cache.
  /// There are three possible validation outcomes and the outcome is given in acceptance.
  ///
  /// If acceptance = [`MessageAcceptance::Accept`] the message will get propagated to the
  /// network. The `propagation_source` parameter indicates who the message was received by and
  /// will not be forwarded back to that peer.
  ///
  /// If acceptance = [`MessageAcceptance::Reject`] the message will be deleted from the memcache
  /// and the P₄ penalty will be applied to the `propagation_source`.
  //
  /// If acceptance = [`MessageAcceptance::Ignore`] the message will be deleted from the memcache
  /// but no P₄ penalty will be applied.
  ///
  /// This function will return true if the message was found in the cache and false if was not
  /// in the cache anymore.
  ///
  /// This should only be called once per message.
  reportMessageValidationResult(msgId: MsgIdStr, propagationSource: PeerId, acceptance: MessageAcceptance): void {
    if (acceptance === MessageAcceptance.Accept) {
      const cacheEntry = this.mcache.validate(msgId)
      this.metrics?.onReportValidationMcacheHit(cacheEntry !== null)

      if (cacheEntry) {
        const { message: rawMsg, originatingPeers } = cacheEntry
        // message is fully validated inform peer_score
        this.score.deliverMessage(propagationSource.toB58String(), msgId, rawMsg.topic)

        // TODO: Don't forward to `originatingPeers`
        this.forwardMessage(msgId, cacheEntry.message, propagationSource.toB58String(), originatingPeers)
        this.metrics?.onReportValidation(rawMsg.topic, acceptance)
      }
      // else, Message not in cache. Ignoring forwarding
    }

    // Not valid
    else {
      const cacheEntry = this.mcache.remove(msgId)
      this.metrics?.onReportValidationMcacheHit(cacheEntry !== null)

      if (cacheEntry) {
        const rejectReason = rejectReasonFromAcceptance(acceptance)
        const { message: rawMsg, originatingPeers } = cacheEntry

        // Tell peer_score about reject
        // Reject the original source, and any duplicates we've seen from other peers.
        this.score.rejectMessage(propagationSource.toB58String(), msgId, rawMsg.topic, rejectReason)
        for (const peer of originatingPeers) {
          this.score.rejectMessage(peer, msgId, rawMsg.topic, rejectReason)
        }

        this.metrics?.onReportValidation(rawMsg.topic, acceptance)
      }
      // else, Message not in cache. Ignoring forwarding
    }
  }

  /**
   * Sends a GRAFT message to a peer
   */
  private sendGraft(id: PeerIdStr, topic: string): void {
    const graft = [
      {
        topicID: topic
      }
    ]

    const out = createGossipRpc([], { graft })
    this.sendRpc(id, out)
  }

  /**
   * Sends a PRUNE message to a peer
   */
  private async sendPrune(id: PeerIdStr, topic: string): Promise<void> {
    const prune = [await this.makePrune(id, topic, this.opts.doPX)]

    const out = createGossipRpc([], { prune })
    this.sendRpc(id, out)
  }

  /**
   * Send an rpc object to a peer
   */
  private sendRpc(id: PeerIdStr, rpc: IRPC): void {
    const peerStreams = this.peers.get(id)
    if (!peerStreams || !peerStreams.isWritable) {
      this.log(`Cannot send RPC to ${id} as there is no open stream to it available`)
      return
    }

    // piggyback control message retries
    const ctrl = this.control.get(id)
    if (ctrl) {
      this.piggybackControl(id, rpc, ctrl)
      this.control.delete(id)
    }

    // piggyback gossip
    const ihave = this.gossip.get(id)
    if (ihave) {
      this.piggybackGossip(id, rpc, ihave)
      this.gossip.delete(id)
    }

    const rpcBytes = RPC.encode(rpc).finish()
    peerStreams.write(rpcBytes)

    this.metrics?.onRpcSent(rpc, rpcBytes.length)
  }

  private piggybackControl(id: PeerIdStr, outRpc: IRPC, ctrl: RPC.IControlMessage): void {
    const tograft = (ctrl.graft || []).filter(({ topicID }) =>
      ((topicID && this.mesh.get(topicID)) || new Set()).has(id)
    )
    const toprune = (ctrl.prune || []).filter(
      ({ topicID }) => !((topicID && this.mesh.get(topicID)) || new Set()).has(id)
    )

    if (!tograft.length && !toprune.length) {
      return
    }

    if (outRpc.control) {
      outRpc.control.graft = outRpc.control.graft && outRpc.control.graft.concat(tograft)
      outRpc.control.prune = outRpc.control.prune && outRpc.control.prune.concat(toprune)
    } else {
      outRpc.control = { ihave: [], iwant: [], graft: tograft, prune: toprune }
    }
  }

  private piggybackGossip(id: PeerIdStr, outRpc: IRPC, ihave: RPC.IControlIHave[]): void {
    if (!outRpc.control) {
      outRpc.control = { ihave: [], iwant: [], graft: [], prune: [] }
    }
    outRpc.control.ihave = ihave
  }

  /**
   * Send graft and prune messages
   * @param tograft peer id => topic[]
   * @param toprune peer id => topic[]
   */
  private async sendGraftPrune(
    tograft: Map<string, string[]>,
    toprune: Map<string, string[]>,
    noPX: Map<string, boolean>
  ): Promise<void> {
    const doPX = this.opts.doPX
    for (const [id, topics] of tograft) {
      const graft = topics.map((topicID) => ({ topicID }))
      let prune: RPC.IControlPrune[] = []
      // If a peer also has prunes, process them now
      const pruning = toprune.get(id)
      if (pruning) {
        prune = await Promise.all(pruning.map((topicID) => this.makePrune(id, topicID, doPX && !noPX.get(id))))
        toprune.delete(id)
      }

      const outRpc = createGossipRpc([], { graft, prune })
      this.sendRpc(id, outRpc)
    }
    for (const [id, topics] of toprune) {
      const prune = await Promise.all(topics.map((topicID) => this.makePrune(id, topicID, doPX && !noPX.get(id))))
      const outRpc = createGossipRpc([], { prune })
      this.sendRpc(id, outRpc)
    }
  }

  /**
   * Emits gossip to peers in a particular topic
   * @param exclude peers to exclude
   */
  private emitGossip(topic: string, exclude: Set<string>): void {
    const messageIDs = this.mcache.getGossipIDs(topic)
    if (!messageIDs.length) {
      return
    }

    // shuffle to emit in random order
    shuffle(messageIDs)

    // if we are emitting more than GossipsubMaxIHaveLength ids, truncate the list
    if (messageIDs.length > constants.GossipsubMaxIHaveLength) {
      // we do the truncation (with shuffling) per peer below
      this.log('too many messages for gossip; will truncate IHAVE list (%d messages)', messageIDs.length)
    }

    // Send gossip to GossipFactor peers above threshold with a minimum of D_lazy
    // First we collect the peers above gossipThreshold that are not in the exclude set
    // and then randomly select from that set
    // We also exclude direct peers, as there is no reason to emit gossip to them
    const peersToGossip: string[] = []
    const topicPeers = this.topics.get(topic)
    if (!topicPeers) {
      // no topic peers, no gossip
      return
    }
    topicPeers.forEach((id) => {
      const peerStreams = this.peers.get(id)
      if (!peerStreams) {
        return
      }
      if (
        !exclude.has(id) &&
        !this.direct.has(id) &&
        hasGossipProtocol(peerStreams.protocol) &&
        this.score.score(id) >= this.opts.scoreThresholds.gossipThreshold
      ) {
        peersToGossip.push(id)
      }
    })

    let target = this.opts.Dlazy
    const factor = constants.GossipsubGossipFactor * peersToGossip.length
    if (factor > target) {
      target = factor
    }
    if (target > peersToGossip.length) {
      target = peersToGossip.length
    } else {
      shuffle(peersToGossip)
    }
    // Emit the IHAVE gossip to the selected peers up to the target
    peersToGossip.slice(0, target).forEach((id) => {
      let peerMessageIDs = messageIDs
      if (messageIDs.length > constants.GossipsubMaxIHaveLength) {
        // shuffle and slice message IDs per peer so that we emit a different set for each peer
        // we have enough reduncancy in the system that this will significantly increase the message
        // coverage when we do truncate
        peerMessageIDs = shuffle(peerMessageIDs.slice()).slice(0, constants.GossipsubMaxIHaveLength)
      }
      this.pushGossip(id, {
        topicID: topic,
        messageIDs: peerMessageIDs
      })
    })
  }

  /**
   * Flush gossip and control messages
   */
  private flush(): void {
    // send gossip first, which will also piggyback control
    for (const [peer, ihave] of this.gossip.entries()) {
      this.gossip.delete(peer)
      this.sendRpc(peer, createGossipRpc([], { ihave }))
    }
    // send the remaining control messages
    for (const [peer, control] of this.control.entries()) {
      this.control.delete(peer)
      this.sendRpc(peer, createGossipRpc([], { graft: control.graft, prune: control.prune }))
    }
  }

  /**
   * Adds new IHAVE messages to pending gossip
   */
  private pushGossip(id: PeerIdStr, controlIHaveMsgs: RPC.IControlIHave): void {
    this.log('Add gossip to %s', id)
    const gossip = this.gossip.get(id) || []
    this.gossip.set(id, gossip.concat(controlIHaveMsgs))
  }

  /**
   * Returns the current time in milliseconds
   */
  _now(): number {
    return Date.now()
  }

  /**
   * Make a PRUNE control message for a peer in a topic
   */
  private async makePrune(id: PeerIdStr, topic: string, doPX: boolean): Promise<RPC.IControlPrune> {
    if (this.peers.get(id)!.protocol === constants.GossipsubIDv10) {
      // Gossipsub v1.0 -- no backoff, the peer won't be able to parse it anyway
      return {
        topicID: topic,
        peers: []
      }
    }
    // backoff is measured in seconds
    // GossipsubPruneBackoff is measured in milliseconds
    const backoff = constants.GossipsubPruneBackoff / 1000
    if (!doPX) {
      return {
        topicID: topic,
        peers: [],
        backoff: backoff
      }
    }
    // select peers for Peer eXchange
    const peers = this.getRandomGossipPeers(topic, constants.GossipsubPrunePeers, (xid) => {
      return xid !== id && this.score.score(xid) >= 0
    })
    const px = await Promise.all(
      Array.from(peers).map(async (p) => {
        // see if we have a signed record to send back; if we don't, just send
        // the peer ID and let the pruned peer find them in the DHT -- we can't trust
        // unsigned address records through PX anyways
        // Finding signed records in the DHT is not supported at the time of writing in js-libp2p
        const peerId = createFromB58String(p)
        return {
          peerID: peerId.toBytes(),
          signedPeerRecord: await this._libp2p.peerStore.addressBook.getRawEnvelope(peerId)
        }
      })
    )
    return {
      topicID: topic,
      peers: px,
      backoff: backoff
    }
  }

  private runHeartbeat = () => {
    const timer = this.metrics?.heartbeatDuration.startTimer()
    try {
      this.heartbeat()
    } catch (e) {
      this.log('Error running heartbeat', e as Error)
    }
    if (timer) timer()

    // Schedule the next run if still in started status
    if (this.status.code === GossipStatusCode.started) {
      // Clear previous timeout before overwriting `status.heartbeatTimeout`, it should be completed tho.
      clearTimeout(this.status.heartbeatTimeout)

      // NodeJS setInterval function is innexact, calls drift by a few miliseconds on each call.
      // To run the heartbeat precisely setTimeout() must be used recomputing the delay on every loop.
      let msToNextHeartbeat = (Date.now() - this.status.hearbeatStartMs) % this.opts.heartbeatInterval

      // If too close to next heartbeat, skip one
      if (msToNextHeartbeat < this.opts.heartbeatInterval * 0.25) {
        msToNextHeartbeat += this.opts.heartbeatInterval
        this.metrics?.heartbeatSkipped.inc()
      }

      this.status.heartbeatTimeout = setTimeout(this.runHeartbeat, msToNextHeartbeat)
    }
  }

  /**
   * Maintains the mesh and fanout maps in gossipsub.
   */
  private heartbeat(): void {
    const { D, Dlo, Dhi, Dscore, Dout, fanoutTTL } = this.opts

    this.heartbeatTicks++

    // cache scores throught the heartbeat
    const scores = new Map<string, number>()
    const getScore = (id: string): number => {
      let s = scores.get(id)
      if (s === undefined) {
        s = this.score.score(id)
        scores.set(id, s)
      }
      return s
    }

    // peer id => topic[]
    const tograft = new Map<string, string[]>()
    // peer id => topic[]
    const toprune = new Map<string, string[]>()
    // peer id => don't px
    const noPX = new Map<string, boolean>()

    // clean up expired backoffs
    this.clearBackoff()

    // clean up peerhave/iasked counters
    this.peerhave.clear()
    this.iasked.clear()

    // apply IWANT request penalties
    this.applyIwantPenalties()

    // ensure direct peers are connected
    if (this.heartbeatTicks % constants.GossipsubDirectConnectTicks === 0) {
      // we only do this every few ticks to allow pending connections to complete and account for restarts/downtime
      this.directConnect()
    }

    // EXTRA: Prune caches
    this.fastMsgIdCache?.prune()
    this.seenCache.prune()
    this.gossipTracer.prune()
    this.publishedMessageIds.prune()

    // maintain the mesh for topics we have joined
    this.mesh.forEach((peers, topic) => {
      // prune/graft helper functions (defined per topic)
      const prunePeer = (id: PeerIdStr, reason: ChurnReason): void => {
        this.log('HEARTBEAT: Remove mesh link to %s in %s', id, topic)
        // update peer score
        this.score.prune(id, topic)
        // add prune backoff record
        this.addBackoff(id, topic)
        // remove peer from mesh
        peers.delete(id)
        this.metrics?.onRemoveFromMesh(topic, reason, 1)
        // add to toprune
        const topics = toprune.get(id)
        if (!topics) {
          toprune.set(id, [topic])
        } else {
          topics.push(topic)
        }
      }

      const graftPeer = (id: PeerIdStr, reason: InclusionReason): void => {
        this.log('HEARTBEAT: Add mesh link to %s in %s', id, topic)
        // update peer score
        this.score.graft(id, topic)
        // add peer to mesh
        peers.add(id)
        this.metrics?.onAddToMesh(topic, reason, 1)
        // add to tograft
        const topics = tograft.get(id)
        if (!topics) {
          tograft.set(id, [topic])
        } else {
          topics.push(topic)
        }
      }

      // drop all peers with negative score, without PX
      peers.forEach((id) => {
        const score = getScore(id)

        // Record the score

        if (score < 0) {
          this.log('HEARTBEAT: Prune peer %s with negative score: score=%d, topic=%s', id, score, topic)
          prunePeer(id, ChurnReason.BadScore)
          noPX.set(id, true)
        }
      })

      // do we have enough peers?
      if (peers.size < Dlo) {
        const backoff = this.backoff.get(topic)
        const ineed = D - peers.size
        const peersSet = this.getRandomGossipPeers(topic, ineed, (id) => {
          // filter out mesh peers, direct peers, peers we are backing off, peers with negative score
          return !peers.has(id) && !this.direct.has(id) && (!backoff || !backoff.has(id)) && getScore(id) >= 0
        })

        peersSet.forEach((p) => graftPeer(p, InclusionReason.NotEnough))
      }

      // do we have to many peers?
      if (peers.size > Dhi) {
        let peersArray = Array.from(peers)
        // sort by score
        peersArray.sort((a, b) => getScore(b) - getScore(a))
        // We keep the first D_score peers by score and the remaining up to D randomly
        // under the constraint that we keep D_out peers in the mesh (if we have that many)
        peersArray = peersArray.slice(0, Dscore).concat(shuffle(peersArray.slice(Dscore)))

        // count the outbound peers we are keeping
        let outbound = 0
        peersArray.slice(0, D).forEach((p) => {
          if (this.outbound.get(p)) {
            outbound++
          }
        })

        // if it's less than D_out, bubble up some outbound peers from the random selection
        if (outbound < Dout) {
          const rotate = (i: number): void => {
            // rotate the peersArray to the right and put the ith peer in the front
            const p = peersArray[i]
            for (let j = i; j > 0; j--) {
              peersArray[j] = peersArray[j - 1]
            }
            peersArray[0] = p
          }

          // first bubble up all outbound peers already in the selection to the front
          if (outbound > 0) {
            let ihave = outbound
            for (let i = 1; i < D && ihave > 0; i++) {
              if (this.outbound.get(peersArray[i])) {
                rotate(i)
                ihave--
              }
            }
          }

          // now bubble up enough outbound peers outside the selection to the front
          let ineed = D - outbound
          for (let i = D; i < peersArray.length && ineed > 0; i++) {
            if (this.outbound.get(peersArray[i])) {
              rotate(i)
              ineed--
            }
          }
        }

        // prune the excess peers
        peersArray.slice(D).forEach((p) => prunePeer(p, ChurnReason.Excess))
      }

      // do we have enough outbound peers?
      if (peers.size >= Dlo) {
        // count the outbound peers we have
        let outbound = 0
        peers.forEach((p) => {
          if (this.outbound.get(p)) {
            outbound++
          }
        })

        // if it's less than D_out, select some peers with outbound connections and graft them
        if (outbound < Dout) {
          const ineed = Dout - outbound
          const backoff = this.backoff.get(topic)
          const newPeers = this.getRandomGossipPeers(topic, ineed, (id: string): boolean => {
            // filter our current mesh peers, direct peers, peers we are backing off, peers with negative score
            return !peers.has(id) && !this.direct.has(id) && (!backoff || !backoff.has(id)) && getScore(id) >= 0
          })
          newPeers.forEach((p) => graftPeer(p, InclusionReason.Outbound))
        }
      }

      // should we try to improve the mesh with opportunistic grafting?
      if (this.heartbeatTicks % constants.GossipsubOpportunisticGraftTicks === 0 && peers.size > 1) {
        // Opportunistic grafting works as follows: we check the median score of peers in the
        // mesh; if this score is below the opportunisticGraftThreshold, we select a few peers at
        // random with score over the median.
        // The intention is to (slowly) improve an underperforming mesh by introducing good
        // scoring peers that may have been gossiping at us. This allows us to get out of sticky
        // situations where we are stuck with poor peers and also recover from churn of good peers.

        // now compute the median peer score in the mesh
        const peersList = Array.from(peers).sort((a, b) => getScore(a) - getScore(b))
        const medianIndex = Math.floor(peers.size / 2)
        const medianScore = getScore(peersList[medianIndex])

        // if the median score is below the threshold, select a better peer (if any) and GRAFT
        if (medianScore < this.opts.scoreThresholds.opportunisticGraftThreshold) {
          const backoff = this.backoff.get(topic)
          const peersToGraft = this.getRandomGossipPeers(topic, constants.GossipsubOpportunisticGraftPeers, (id) => {
            // filter out current mesh peers, direct peers, peers we are backing off, peers below or at threshold
            return peers.has(id) && !this.direct.has(id) && (!backoff || !backoff.has(id)) && getScore(id) > medianScore
          })
          peersToGraft.forEach((id) => {
            this.log('HEARTBEAT: Opportunistically graft peer %s on topic %s', id, topic)
            graftPeer(id, InclusionReason.Opportunistic)
          })
        }
      }

      // 2nd arg are mesh peers excluded from gossip. We have already pushed
      // messages to them, so its redundant to gossip IHAVEs.
      this.emitGossip(topic, peers)
    })

    // expire fanout for topics we haven't published to in a while
    const now = this._now()
    this.fanoutLastpub.forEach((lastpb, topic) => {
      if (lastpb + fanoutTTL < now) {
        this.fanout.delete(topic)
        this.fanoutLastpub.delete(topic)
      }
    })

    // maintain our fanout for topics we are publishing but we have not joined
    this.fanout.forEach((fanoutPeers, topic) => {
      // checks whether our peers are still in the topic and have a score above the publish threshold
      const topicPeers = this.topics.get(topic)
      fanoutPeers.forEach((id) => {
        if (!topicPeers!.has(id) || getScore(id) < this.opts.scoreThresholds.publishThreshold) {
          fanoutPeers.delete(id)
        }
      })

      // do we need more peers?
      if (fanoutPeers.size < D) {
        const ineed = D - fanoutPeers.size
        const peersSet = this.getRandomGossipPeers(topic, ineed, (id) => {
          // filter out existing fanout peers, direct peers, and peers with score above the publish threshold
          return (
            !fanoutPeers.has(id) && !this.direct.has(id) && getScore(id) >= this.opts.scoreThresholds.publishThreshold
          )
        })
        peersSet.forEach((id) => {
          fanoutPeers.add(id)
        })
      }

      // 2nd arg are fanout peers excluded from gossip.
      // We have already pushed messages to them, so its redundant to gossip IHAVEs
      this.emitGossip(topic, fanoutPeers)
    })

    // send coalesced GRAFT/PRUNE messages (will piggyback gossip)
    this.sendGraftPrune(tograft, toprune, noPX)

    // flush pending gossip that wasn't piggybacked above
    this.flush()

    // advance the message history window
    this.mcache.shift()

    this.emit('gossipsub:heartbeat')
  }

  /**
   * Given a topic, returns up to count peers subscribed to that topic
   * that pass an optional filter function
   *
   * @param filter a function to filter acceptable peers
   */
  private getRandomGossipPeers(
    topic: string,
    count: number,
    filter: (id: string) => boolean = () => true
  ): Set<string> {
    const peersInTopic = this.topics.get(topic)
    if (!peersInTopic) {
      return new Set()
    }

    // Adds all peers using our protocol
    // that also pass the filter function
    let peers: string[] = []
    peersInTopic.forEach((id) => {
      const peerStreams = this.peers.get(id)
      if (!peerStreams) {
        return
      }
      if (hasGossipProtocol(peerStreams.protocol) && filter(id)) {
        peers.push(id)
      }
    })

    // Pseudo-randomly shuffles peers
    peers = shuffle(peers)
    if (count > 0 && peers.length > count) {
      peers = peers.slice(0, count)
    }

    return new Set(peers)
  }

  private onScrapeMetrics(metrics: Metrics): void {
    /* Data structure sizes */
    metrics.mcacheSize.set(this.mcache.size)
    // Arbitrary size
    metrics.cacheSize.set({ cache: 'direct' }, this.direct.size)
    metrics.cacheSize.set({ cache: 'seenCache' }, this.seenCache.size)
    metrics.cacheSize.set({ cache: 'fastMsgIdCache' }, this.fastMsgIdCache?.size ?? 0)
    metrics.cacheSize.set({ cache: 'publishedMessageIds' }, this.publishedMessageIds.size)
    metrics.cacheSize.set({ cache: 'mcache' }, this.mcache.size)
    metrics.cacheSize.set({ cache: 'score' }, this.score.size)
    metrics.cacheSize.set({ cache: 'gossipTracer.promises' }, this.gossipTracer.size)
    metrics.cacheSize.set({ cache: 'gossipTracer.requests' }, this.gossipTracer.requestMsByMsgSize)
    // Bounded by topic
    metrics.cacheSize.set({ cache: 'topics' }, this.topics.size)
    metrics.cacheSize.set({ cache: 'subscriptions' }, this.subscriptions.size)
    metrics.cacheSize.set({ cache: 'mesh' }, this.mesh.size)
    metrics.cacheSize.set({ cache: 'fanout' }, this.fanout.size)
    // Bounded by peer
    metrics.cacheSize.set({ cache: 'peers' }, this.peers.size)
    metrics.cacheSize.set({ cache: 'acceptFromWhitelist' }, this.acceptFromWhitelist.size)
    metrics.cacheSize.set({ cache: 'gossip' }, this.gossip.size)
    metrics.cacheSize.set({ cache: 'control' }, this.control.size)
    metrics.cacheSize.set({ cache: 'peerhave' }, this.peerhave.size)
    // TODO: This ones get cleared every heartbeat, track there
    metrics.cacheSize.set({ cache: 'iasked' }, this.iasked.size)
    metrics.cacheSize.set({ cache: 'outbound' }, this.outbound.size)
    // 2D nested data structure
    let backoffSize = 0
    for (const backoff of this.backoff.values()) {
      backoffSize += backoff.size
    }
    metrics.cacheSize.set({ cache: 'backoff' }, backoffSize)

    // Peer counts

    for (const [topicStr, peers] of this.topics) {
      metrics.topicPeersCount.set({ topicStr }, peers.size)
    }

    for (const [topicStr, peers] of this.mesh) {
      metrics.meshPeerCounts.set({ topicStr }, peers.size)
    }

    // Peer scores

    const scores: number[] = []
    const scoreByPeer = new Map<PeerIdStr, number>()

    for (const peerIdStr of this.peers.keys()) {
      const score = this.score.score(peerIdStr)
      scores.push(score)
      scoreByPeer.set(peerIdStr, score)
      metrics.behaviourPenalty.observe(this.score.peerStats.get(peerIdStr)?.behaviourPenalty ?? 0)
    }

    metrics.registerScores(scores, this.opts.scoreThresholds)

    // Breakdown score per mesh topicLabel

    metrics.registerScorePerMesh(this.mesh, scoreByPeer)

    // Breakdown on each score weight

    const sw = computeAllPeersScoreWeights(
      this.peers.keys(),
      this.score.peerStats,
      this.score.params,
      this.score.peerIPs,
      metrics.topicStrToLabel
    )

    metrics.registerScoreWeights(sw)
  }
}

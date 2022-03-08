import Pubsub, { InMessage, utils } from 'libp2p-interfaces/src/pubsub'
import { MessageCache } from './message-cache'
import { RPC, IRPC } from './message/rpc'
import * as constants from './constants'
import { Heartbeat } from './heartbeat'
import { getGossipPeers } from './get-gossip-peers'
import { createGossipRpc, shuffle, hasGossipProtocol, messageIdToString } from './utils'
import {
  PeerScore,
  PeerScoreParams,
  PeerScoreThresholds,
  createPeerScoreParams,
  createPeerScoreThresholds,
} from './score'
import { IWantTracer } from './tracer'
import { AddrInfo, MessageIdFunction } from './interfaces'
import { SimpleTimeCache } from './utils/time-cache'
import { Debugger } from 'debug'
import Libp2p from 'libp2p'

import PeerStreams from 'libp2p-interfaces/src/pubsub/peer-streams'
import PeerId = require('peer-id')
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Envelope = require('libp2p/src/record/envelope')
import {
  ACCEPT_FROM_WHITELIST_DURATION_MS,
  ACCEPT_FROM_WHITELIST_MAX_MESSAGES,
  ACCEPT_FROM_WHITELIST_THRESHOLD_SCORE,
} from './constants'

interface GossipInputOptions {
  emitSelf: boolean
  canRelayMessage: boolean
  gossipIncoming: boolean
  fallbackToFloodsub: boolean
  floodPublish: boolean
  doPX: boolean
  msgIdFn: MessageIdFunction
  fastMsgIdFn: FastMsgIdFn
  messageCache: MessageCache
  globalSignaturePolicy: 'StrictSign' | 'StrictNoSign' | undefined
  scoreParams: Partial<PeerScoreParams>
  scoreThresholds: Partial<PeerScoreThresholds>
  directPeers: AddrInfo[]

  /**
   * D sets the optimal degree for a Gossipsub topic mesh.
   */
  D: number

  /**
   * Dlo sets the lower bound on the number of peers we keep in a Gossipsub topic mesh.
   */
  Dlo: number

  /**
   * Dhi sets the upper bound on the number of peers we keep in a Gossipsub topic mesh.
   */
  Dhi: number

  /**
   * Dscore affects how peers are selected when pruning a mesh due to over subscription.
   */
  Dscore: number

  /**
   * Dout sets the quota for the number of outbound connections to maintain in a topic mesh.
   */
  Dout: number

  /**
   * Dlazy affects how many peers we will emit gossip to at each heartbeat.
   */
  Dlazy: number

  /**
   * heartbeatInterval is the time between heartbeats in milliseconds
   */
  heartbeatInterval: number

  /**
   * fanoutTTL controls how long we keep track of the fanout state. If it's been
   * fanoutTTL milliseconds since we've published to a topic that we're not subscribed to,
   * we'll delete the fanout map for that topic.
   */
  fanoutTTL: number

  /**
   * mcacheLength is the number of windows to retain full messages for IWANT responses
   */
  mcacheLength: number

  /**
   * mcacheGossip is the number of windows to gossip about
   */
  mcacheGossip: number

  /**
   * seenTTL is the number of milliseconds to retain message IDs in the seen cache
   */
  seenTTL: number
}

interface GossipOptions extends GossipInputOptions {
  scoreParams: PeerScoreParams
  scoreThresholds: PeerScoreThresholds
}

interface AcceptFromWhitelistEntry {
  /** number of messages accepted since recomputing the peer's score */
  messagesAccepted: number
  /** have to recompute score after this time */
  acceptUntil: number
}

type FastMsgIdFn = (msg: InMessage) => string

class Gossipsub extends Pubsub {
  peers: Map<string, PeerStreams>

  /** Direct peers */
  direct: Set<string>

  /** Cache of seen messages */
  seenCache: SimpleTimeCache<void>

  /**
   * Map of peer id and AcceptRequestWhileListEntry
   */
  acceptFromWhitelist = new Map<string, AcceptFromWhitelistEntry>()

  topics: Map<string, Set<string>>

  /**
   * Map of topic meshes
   * topic => peer id set
   */
  mesh = new Map<string, Set<string>>()

  /**
   * Map of topics to set of peers. These mesh peers are the ones to which we are publishing without a topic membership
   * topic => peer id set
   */
  fanout = new Map<string, Set<string>>()

  /**
   * Map of last publish time for fanout topics
   * topic => last publish time
   */
  lastpub = new Map<string, number>()

  /**
   * Map of pending messages to gossip
   * peer id => control messages
   */
  gossip = new Map<string, RPC.IControlIHave[]>()

  /**
   * Map of control messages
   * peer id => control message
   */
  control = new Map<string, RPC.IControlMessage>()

  /**
   * Number of IHAVEs received from peer in the last heartbeat
   */
  peerhave = new Map<string, number>()

  /** Number of messages we have asked from peer in the last heartbeat */
  iasked = new Map<string, number>()

  /** Prune backoff map */
  backoff = new Map<string, Map<string, number>>()

  /**
   * Connection direction cache, marks peers with outbound connections
   * peer id => direction
   */
  outbound = new Map<string, boolean>()
  defaultMsgIdFn: MessageIdFunction

  /**
   * A fast message id function used for internal message de-duplication
   */
  getFastMsgIdStr: FastMsgIdFn | undefined

  /** Maps fast message-id to canonical message-id */
  fastMsgIdCache: SimpleTimeCache<string> | undefined

  /**
   * A message cache that contains the messages for last few hearbeat ticks
   */
  messageCache: MessageCache

  /** Peer score tracking */
  score: PeerScore

  /** A heartbeat timer that maintains the mesh */
  heartbeat: Heartbeat

  /**
   * Number of heartbeats since the beginning of time
   * This allows us to amortize some resource cleanup -- eg: backoff cleanup
   */
  heartbeatTicks = 0

  /**
   * Tracks IHAVE/IWANT promises broken by peers
   */
  gossipTracer = new IWantTracer()

  multicodecs: string[]
  started: boolean
  peerId: PeerId
  subscriptions: Set<string>
  _libp2p: Libp2p
  _options: GossipOptions
  _directPeerInitial: NodeJS.Timeout
  log: Debugger & { err: Debugger }
  // eslint-disable-next-line @typescript-eslint/ban-types
  emit: (event: string | symbol, ...args: any[]) => boolean

  public static multicodec: string = constants.GossipsubIDv11

  // TODO: add remaining props
  /**
   * @param {Libp2p} libp2p
   * @param {Object} [options]
   * @param {boolean} [options.emitSelf = false] if publish should emit to self, if subscribed
   * @param {boolean} [options.canRelayMessage = false] - if can relay messages not subscribed
   * @param {boolean} [options.gossipIncoming = true] if incoming messages on a subscribed topic should be automatically gossiped
   * @param {boolean} [options.fallbackToFloodsub = true] if dial should fallback to floodsub
   * @param {boolean} [options.floodPublish = true] if self-published messages should be sent to all peers
   * @param {boolean} [options.doPX = false] whether PX is enabled; this should be enabled in bootstrappers and other well connected/trusted nodes.
   * @param {Object} [options.messageCache] override the default MessageCache
   * @param {FastMsgIdFn} [options.fastMsgIdFn] fast message id function
   * @param {string} [options.globalSignaturePolicy = "StrictSign"] signing policy to apply across all messages
   * @param {Object} [options.scoreParams] peer score parameters
   * @param {Object} [options.scoreThresholds] peer score thresholds
   * @param {AddrInfo[]} [options.directPeers] peers with which we will maintain direct connections
   * @constructor
   */
  constructor(libp2p: Libp2p, options: Partial<GossipInputOptions> = {}) {
    const multicodecs = [constants.GossipsubIDv11, constants.GossipsubIDv10]
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
      scoreThresholds: createPeerScoreThresholds(options.scoreThresholds),
    } as GossipOptions

    // Also wants to get notified of peers connected using floodsub
    if (opts.fallbackToFloodsub) {
      multicodecs.push(constants.FloodsubID)
    }

    super({
      debugName: 'libp2p:gossipsub',
      multicodecs,
      libp2p,
      ...opts,
    })

    this._options = opts

    this.direct = new Set(opts.directPeers.map((p) => p.id.toB58String()))

    // set direct peer addresses in the address book
    opts.directPeers.forEach((p) => {
      libp2p.peerStore.addressBook.add(p.id, p.addrs)
    })

    this.seenCache = new SimpleTimeCache<void>({ validityMs: opts.seenTTL })

    this.messageCache = options.messageCache || new MessageCache(opts.mcacheGossip, opts.mcacheLength)

    this.getFastMsgIdStr = options.fastMsgIdFn ?? undefined

    this.fastMsgIdCache = options.fastMsgIdFn ? new SimpleTimeCache<string>({ validityMs: opts.seenTTL }) : undefined

    this.heartbeat = new Heartbeat(this)

    /**
     * libp2p
     */
    this._libp2p = libp2p

    this.score = new PeerScore(this._options.scoreParams, libp2p.connectionManager)
  }

  /**
   * Decode a Uint8Array into an RPC object
   * Overrided to use an extended protocol-specific protobuf decoder
   * @override
   */
  _decodeRpc(bytes: Uint8Array) {
    return RPC.decode(bytes)
  }

  /**
   * Encode an RPC object into a Uint8Array
   * Overrided to use an extended protocol-specific protobuf encoder
   * @override
   */
  _encodeRpc(rpc: RPC) {
    return RPC.encode(rpc).finish()
  }

  /**
   * Add a peer to the router
   * @override
   */
  _addPeer(peerId: PeerId, protocol: string): PeerStreams {
    const p = super._addPeer(peerId, protocol)

    // Add to peer scoring
    this.score.addPeer(peerId.toB58String())

    // track the connection direction
    let outbound = false
    for (const c of this._libp2p.connectionManager.getAll(peerId)) {
      if (c.stat.direction === 'outbound') {
        if (Array.from(c.registry.values()).some((rvalue) => protocol === rvalue.protocol)) {
          outbound = true
          break
        }
      }
    }
    this.outbound.set(p.id.toB58String(), outbound)

    return p
  }

  /**
   * Removes a peer from the router
   * @override
   */
  _removePeer(peerId: PeerId): PeerStreams | undefined {
    const peerStreams = super._removePeer(peerId)
    const id = peerId.toB58String()

    // Remove this peer from the mesh
    // eslint-disable-next-line no-unused-vars
    for (const peers of this.mesh.values()) {
      peers.delete(id)
    }

    // Remove this peer from the fanout
    // eslint-disable-next-line no-unused-vars
    for (const peers of this.fanout.values()) {
      peers.delete(id)
    }

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

  /**
   * Handles an rpc request from a peer
   *
   * @override
   */
  async _processRpc(id: string, peerStreams: PeerStreams, rpc: RPC): Promise<boolean> {
    if (await super._processRpc(id, peerStreams, rpc)) {
      if (rpc.control) {
        await this._processRpcControlMessage(id, rpc.control)
      }
      return true
    }
    return false
  }

  /**
   * Handles an rpc control message from a peer
   */
  async _processRpcControlMessage(id: string, controlMsg: RPC.IControlMessage): Promise<void> {
    if (!controlMsg) {
      return
    }

    const iwant = controlMsg.ihave ? this._handleIHave(id, controlMsg.ihave) : []
    const ihave = controlMsg.iwant ? this._handleIWant(id, controlMsg.iwant) : []
    const prune = controlMsg.graft ? await this._handleGraft(id, controlMsg.graft) : []
    controlMsg.prune && this._handlePrune(id, controlMsg.prune)

    if (!iwant.length && !ihave.length && !prune.length) {
      return
    }

    const outRpc = createGossipRpc(ihave, { iwant, prune })
    this._sendRpc(id, outRpc)
  }

  /**
   * Process incoming message,
   * emitting locally and forwarding on to relevant floodsub and gossipsub peers
   * @override
   */
  async _processRpcMessage(msg: InMessage): Promise<void> {
    let canonicalMsgIdStr
    if (this.getFastMsgIdStr && this.fastMsgIdCache) {
      // check duplicate
      const fastMsgIdStr = this.getFastMsgIdStr(msg)
      canonicalMsgIdStr = this.fastMsgIdCache.get(fastMsgIdStr)
      if (canonicalMsgIdStr !== undefined) {
        this.score.duplicateMessage(msg, canonicalMsgIdStr)
        return
      }
      canonicalMsgIdStr = messageIdToString(await this.getMsgId(msg))

      this.fastMsgIdCache.put(fastMsgIdStr, canonicalMsgIdStr)
    } else {
      // check duplicate
      canonicalMsgIdStr = messageIdToString(await this.getMsgId(msg))
      if (this.seenCache.has(canonicalMsgIdStr)) {
        this.score.duplicateMessage(msg, canonicalMsgIdStr)
        return
      }
    }

    // put in cache
    this.seenCache.put(canonicalMsgIdStr)

    await this.score.validateMessage(canonicalMsgIdStr)
    await super._processRpcMessage(msg)
  }

  /**
   * Whether to accept a message from a peer
   * @override
   */
  _acceptFrom(id: string): boolean {
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
        acceptUntil: now + ACCEPT_FROM_WHITELIST_DURATION_MS,
      })
    } else {
      this.acceptFromWhitelist.delete(id)
    }

    return score >= this._options.scoreThresholds.graylistThreshold
  }

  /**
   * Validate incoming message
   * @override
   */
  async validate(msg: InMessage): Promise<void> {
    try {
      await super.validate(msg)
    } catch (e) {
      const canonicalMsgIdStr = await this.getCanonicalMsgIdStr(msg)
      this.score.rejectMessage(msg, canonicalMsgIdStr, e.code)
      this.gossipTracer.rejectMessage(canonicalMsgIdStr, e.code)
      throw e
    }
  }

  /**
   * Handles IHAVE messages
   */
  _handleIHave(id: string, ihave: RPC.IControlIHave[]): RPC.IControlIWant[] {
    if (!ihave.length) {
      return []
    }
    // we ignore IHAVE gossip from any peer whose score is below the gossips threshold
    const score = this.score.score(id)
    if (score < this._options.scoreThresholds.gossipThreshold) {
      this.log('IHAVE: ignoring peer %s with score below threshold [ score = %d ]', id, score)
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
      return []
    }

    const iasked = this.iasked.get(id) || 0
    if (iasked >= constants.GossipsubMaxIHaveLength) {
      this.log('IHAVE: peer %s has already advertised too many messages (%d); ignoring', id, iasked)
      return []
    }

    // string msgId => msgId
    const iwant = new Map<string, Uint8Array>()

    ihave.forEach(({ topicID, messageIDs }) => {
      if (!topicID || !messageIDs || !this.mesh.has(topicID)) {
        return
      }

      messageIDs.forEach((msgId) => {
        const msgIdStr = messageIdToString(msgId)
        if (this.seenCache.has(msgIdStr)) {
          return
        }
        iwant.set(msgIdStr, msgId)
      })
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
        messageIDs: iwantList,
      },
    ]
  }

  /**
   * Handles IWANT messages
   * Returns messages to send back to peer
   */
  _handleIWant(id: string, iwant: RPC.IControlIWant[]): RPC.IMessage[] {
    if (!iwant.length) {
      return []
    }
    // we don't respond to IWANT requests from any per whose score is below the gossip threshold
    const score = this.score.score(id)
    if (score < this._options.scoreThresholds.gossipThreshold) {
      this.log('IWANT: ignoring peer %s with score below threshold [score = %d]', id, score)
      return []
    }
    // @type {Map<string, Message>}
    const ihave = new Map<string, InMessage>()

    iwant.forEach(({ messageIDs }) => {
      messageIDs &&
        messageIDs.forEach((msgId) => {
          const msgIdStr = messageIdToString(msgId)
          const [msg, count] = this.messageCache.getForPeer(msgIdStr, id)
          if (!msg) {
            return
          }

          if (count > constants.GossipsubGossipRetransmission) {
            this.log('IWANT: Peer %s has asked for message %s too many times: ignoring request', id, msgId)
            return
          }
          ihave.set(msgIdStr, msg)
        })
    })

    if (!ihave.size) {
      return []
    }

    this.log('IWANT: Sending %d messages to %s', ihave.size, id)

    return Array.from(ihave.values()).map(utils.normalizeOutRpcMessage)
  }

  /**
   * Handles Graft messages
   */
  async _handleGraft(id: string, graft: RPC.IControlGraft[]): Promise<RPC.IControlPrune[]> {
    const prune: string[] = []
    const score = this.score.score(id)
    const now = this._now()
    let doPX = this._options.doPX

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
        this.score.addPenalty(id, 1)
        // no PX
        doPX = false
        // check the flood cutoff -- is the GRAFT coming too fast?
        const floodCutoff = expire + constants.GossipsubGraftFloodThreshold - constants.GossipsubPruneBackoff
        if (now < floodCutoff) {
          // extra penalty
          this.score.addPenalty(id, 1)
        }
        // refresh the backoff
        this._addBackoff(id, topicID)
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
        this._addBackoff(id, topicID)
        return
      }

      // check the number of mesh peers; if it is at (or over) Dhi, we only accept grafts
      // from peers with outbound connections; this is a defensive check to restrict potential
      // mesh takeover attacks combined with love bombing
      if (peersInMesh.size >= this._options.Dhi && !this.outbound.get(id)) {
        prune.push(topicID)
        this._addBackoff(id, topicID)
        return
      }

      this.log('GRAFT: Add mesh link from %s in %s', id, topicID)
      this.score.graft(id, topicID)
      peersInMesh.add(id)
    })

    if (!prune.length) {
      return []
    }

    return Promise.all(prune.map((topic) => this._makePrune(id, topic, doPX)))
  }

  /**
   * Handles Prune messages
   */
  _handlePrune(id: string, prune: RPC.IControlPrune[]): void {
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
      peersInMesh.delete(id)
      // is there a backoff specified by the peer? if so obey it
      if (typeof backoff === 'number' && backoff > 0) {
        this._doAddBackoff(id, topicID, backoff * 1000)
      } else {
        this._addBackoff(id, topicID)
      }

      // PX
      if (peers && peers.length) {
        // we ignore PX from peers with insufficient scores
        if (score < this._options.scoreThresholds.acceptPXThreshold) {
          this.log(
            'PRUNE: ignoring PX from peer %s with insufficient score [score = %d, topic = %s]',
            id,
            score,
            topicID
          )
          return
        }
        this._pxConnect(peers)
      }
    })
  }

  /**
   * Add standard backoff log for a peer in a topic
   */
  _addBackoff(id: string, topic: string): void {
    this._doAddBackoff(id, topic, constants.GossipsubPruneBackoff)
  }

  /**
   * Add backoff expiry interval for a peer in a topic
   * @param interval backoff duration in milliseconds
   */
  _doAddBackoff(id: string, topic: string, interval: number): void {
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
  _applyIwantPenalties(): void {
    this.gossipTracer.getBrokenPromises().forEach((count, p) => {
      this.log("peer %s didn't follow up in %d IWANT requests; adding penalty", p, count)
      this.score.addPenalty(p, count)
    })
  }

  /**
   * Clear expired backoff expiries
   */
  _clearBackoff(): void {
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
  _directConnect(): void {
    // we only do this every few ticks to allow pending connections to complete and account for
    // restarts/downtime
    if (this.heartbeatTicks % constants.GossipsubDirectConnectTicks !== 0) {
      return
    }

    const toconnect: string[] = []
    this.direct.forEach((id) => {
      const peer = this.peers.get(id)
      if (!peer || !peer.isWritable) {
        toconnect.push(id)
      }
    })
    if (toconnect.length) {
      toconnect.forEach((id) => {
        this._connect(id)
      })
    }
  }

  /**
   * Maybe attempt connection given signed peer records
   */
  async _pxConnect(peers: RPC.IPeerInfo[]): Promise<void> {
    if (peers.length > constants.GossipsubPrunePeers) {
      shuffle(peers)
      peers = peers.slice(0, constants.GossipsubPrunePeers)
    }
    const toconnect: string[] = []

    await Promise.all(
      peers.map(async (pi) => {
        if (!pi.peerID) {
          return
        }

        const p = PeerId.createFromBytes(pi.peerID)
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

    toconnect.forEach((id) => this._connect(id))
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   * @override
   */
  async start(): Promise<void> {
    await super.start()
    this.heartbeat.start()
    this.score.start()
    // connect to direct peers
    this._directPeerInitial = setTimeout(() => {
      this.direct.forEach((id) => {
        this._connect(id)
      })
    }, constants.GossipsubDirectConnectInitialDelay)
  }

  /**
   * Unmounts the gossipsub protocol and shuts down every connection
   * @override
   */
  async stop(): Promise<void> {
    await super.stop()
    this.heartbeat.stop()
    this.score.stop()

    this.mesh = new Map()
    this.fanout = new Map()
    this.lastpub = new Map()
    this.gossip = new Map()
    this.control = new Map()
    this.peerhave = new Map()
    this.iasked = new Map()
    this.backoff = new Map()
    this.outbound = new Map()
    this.gossipTracer.clear()
    this.seenCache.clear()
    if (this.fastMsgIdCache) this.fastMsgIdCache.clear()
    clearTimeout(this._directPeerInitial)
  }

  /**
   * Connect to a peer using the gossipsub protocol
   */
  _connect(id: string): void {
    this.log('Initiating connection with %s', id)
    this._libp2p.dialProtocol(PeerId.createFromB58String(id), this.multicodecs)
  }

  /**
   * Subscribes to a topic
   * @override
   */
  subscribe(topic: string): void {
    super.subscribe(topic)
    this.join(topic)
  }

  /**
   * Unsubscribe to a topic
   * @override
   */
  unsubscribe(topic: string): void {
    super.unsubscribe(topic)
    this.leave(topic)
  }

  /**
   * Join topic
   */
  join(topic: string): void {
    if (!this.started) {
      throw new Error('Gossipsub has not started')
    }
    this.log('JOIN %s', topic)

    const fanoutPeers = this.fanout.get(topic)
    if (fanoutPeers) {
      // these peers have a score above the publish threshold, which may be negative
      // so drop the ones with a negative score
      fanoutPeers.forEach((id) => {
        if (this.score.score(id) < 0) {
          fanoutPeers.delete(id)
        }
      })
      if (fanoutPeers.size < this._options.D) {
        // we need more peers; eager, as this would get fixed in the next heartbeat
        getGossipPeers(this, topic, this._options.D - fanoutPeers.size, (id: string): boolean => {
          // filter our current peers, direct peers, and peers with negative scores
          return !fanoutPeers.has(id) && !this.direct.has(id) && this.score.score(id) >= 0
        }).forEach((id) => fanoutPeers.add(id))
      }
      this.mesh.set(topic, fanoutPeers)
      this.fanout.delete(topic)
      this.lastpub.delete(topic)
    } else {
      const peers = getGossipPeers(this, topic, this._options.D, (id: string): boolean => {
        // filter direct peers and peers with negative score
        return !this.direct.has(id) && this.score.score(id) >= 0
      })
      this.mesh.set(topic, peers)
    }
    this.mesh.get(topic)!.forEach((id) => {
      this.log('JOIN: Add mesh link to %s in %s', id, topic)
      this._sendGraft(id, topic)
    })
  }

  /**
   * Leave topic
   */
  leave(topic: string): void {
    if (!this.started) {
      throw new Error('Gossipsub has not started')
    }
    this.log('LEAVE %s', topic)

    // Send PRUNE to mesh peers
    const meshPeers = this.mesh.get(topic)
    if (meshPeers) {
      meshPeers.forEach((id) => {
        this.log('LEAVE: Remove mesh link to %s in %s', id, topic)
        this._sendPrune(id, topic)
      })
      this.mesh.delete(topic)
    }
  }

  /**
   * Return the canonical message-id of a message as a string
   *
   * If a fast message-id is set: Try 1. the application cache 2. the fast cache 3. `getMsgId()`
   * If a fast message-id is NOT set: Just `getMsgId()`
   */
  async getCanonicalMsgIdStr(msg: InMessage): Promise<string> {
    return this.fastMsgIdCache && this.getFastMsgIdStr
      ? this.getCachedMsgIdStr(msg) ??
          this.fastMsgIdCache.get(this.getFastMsgIdStr(msg)) ??
          messageIdToString(await this.getMsgId(msg))
      : messageIdToString(await this.getMsgId(msg))
  }

  /**
   * An application should override this function to return its cached message id string without computing it.
   * Return undefined if message id is not found.
   * If a fast message id function is not defined, this function is ignored.
   */
  getCachedMsgIdStr(msg: InMessage): string | undefined {
    return undefined
  }

  /**
   * Publish messages
   *
   * @override
   */
  async _publish(msg: InMessage): Promise<void> {
    const msgIdStr = await this.getCanonicalMsgIdStr(msg)
    if (msg.receivedFrom !== this.peerId.toB58String()) {
      this.score.deliverMessage(msg, msgIdStr)
      this.gossipTracer.deliverMessage(msgIdStr)
    }

    // put in seen cache
    this.seenCache.put(msgIdStr)

    this.messageCache.put(msg, msgIdStr)

    const tosend = new Set<string>()
    msg.topicIDs.forEach((topic) => {
      const peersInTopic = this.topics.get(topic)
      if (!peersInTopic) {
        return
      }

      if (this._options.floodPublish && msg.from === this.peerId.toB58String()) {
        // flood-publish behavior
        // send to direct peers and _all_ peers meeting the publishThreshold
        peersInTopic.forEach((id) => {
          if (this.direct.has(id) || this.score.score(id) >= this._options.scoreThresholds.publishThreshold) {
            tosend.add(id)
          }
        })
      } else {
        // non-flood-publish behavior
        // send to direct peers, subscribed floodsub peers
        // and some mesh peers above publishThreshold

        // direct peers
        this.direct.forEach((id) => {
          tosend.add(id)
        })

        // floodsub peers
        peersInTopic.forEach((id) => {
          const peerStreams = this.peers.get(id)
          if (!peerStreams) {
            return
          }
          if (
            peerStreams.protocol === constants.FloodsubID &&
            this.score.score(id) >= this._options.scoreThresholds.publishThreshold
          ) {
            tosend.add(id)
          }
        })

        // Gossipsub peers handling
        let meshPeers = this.mesh.get(topic)
        if (!meshPeers || !meshPeers.size) {
          // We are not in the mesh for topic, use fanout peers
          meshPeers = this.fanout.get(topic)
          if (!meshPeers) {
            // If we are not in the fanout, then pick peers in topic above the publishThreshold
            const peers = getGossipPeers(this, topic, this._options.D, (id) => {
              return this.score.score(id) >= this._options.scoreThresholds.publishThreshold
            })

            if (peers.size > 0) {
              meshPeers = peers
              this.fanout.set(topic, peers)
            } else {
              meshPeers = new Set()
            }
          }
          // Store the latest publishing time
          this.lastpub.set(topic, this._now())
        }

        meshPeers!.forEach((peer) => {
          tosend.add(peer)
        })
      }
    })
    // Publish messages to peers
    const rpc = createGossipRpc([utils.normalizeOutRpcMessage(msg)])
    tosend.forEach((id) => {
      if (id === msg.from) {
        return
      }
      this._sendRpc(id, rpc)
    })
  }

  /**
   * Sends a GRAFT message to a peer
   */
  _sendGraft(id: string, topic: string): void {
    const graft = [
      {
        topicID: topic,
      },
    ]

    const out = createGossipRpc([], { graft })
    this._sendRpc(id, out)
  }

  /**
   * Sends a PRUNE message to a peer
   */
  async _sendPrune(id: string, topic: string): Promise<void> {
    const prune = [await this._makePrune(id, topic, this._options.doPX)]

    const out = createGossipRpc([], { prune })
    this._sendRpc(id, out)
  }

  /**
   * @override
   */
  _sendRpc(id: string, outRpc: IRPC): void {
    const peerStreams = this.peers.get(id)
    if (!peerStreams || !peerStreams.isWritable) {
      return
    }

    // piggyback control message retries
    const ctrl = this.control.get(id)
    if (ctrl) {
      this._piggybackControl(id, outRpc, ctrl)
      this.control.delete(id)
    }

    // piggyback gossip
    const ihave = this.gossip.get(id)
    if (ihave) {
      this._piggybackGossip(id, outRpc, ihave)
      this.gossip.delete(id)
    }

    peerStreams.write(RPC.encode(outRpc).finish())
  }

  _piggybackControl(id: string, outRpc: IRPC, ctrl: RPC.IControlMessage): void {
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

  _piggybackGossip(id: string, outRpc: IRPC, ihave: RPC.IControlIHave[]): void {
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
  async _sendGraftPrune(
    tograft: Map<string, string[]>,
    toprune: Map<string, string[]>,
    noPX: Map<string, boolean>
  ): Promise<void> {
    const doPX = this._options.doPX
    for (const [id, topics] of tograft) {
      const graft = topics.map((topicID) => ({ topicID }))
      let prune: RPC.IControlPrune[] = []
      // If a peer also has prunes, process them now
      const pruning = toprune.get(id)
      if (pruning) {
        prune = await Promise.all(pruning.map((topicID) => this._makePrune(id, topicID, doPX && !noPX.get(id))))
        toprune.delete(id)
      }

      const outRpc = createGossipRpc([], { graft, prune })
      this._sendRpc(id, outRpc)
    }
    for (const [id, topics] of toprune) {
      const prune = await Promise.all(topics.map((topicID) => this._makePrune(id, topicID, doPX && !noPX.get(id))))
      const outRpc = createGossipRpc([], { prune })
      this._sendRpc(id, outRpc)
    }
  }

  /**
   * Emits gossip to peers in a particular topic
   * @param exclude peers to exclude
   */
  _emitGossip(topic: string, exclude: Set<string>): void {
    const messageIDs = this.messageCache.getGossipIDs(topic)
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
        this.score.score(id) >= this._options.scoreThresholds.gossipThreshold
      ) {
        peersToGossip.push(id)
      }
    })

    let target = this._options.Dlazy
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
      this._pushGossip(id, {
        topicID: topic,
        messageIDs: peerMessageIDs,
      })
    })
  }

  /**
   * Flush gossip and control messages
   */
  _flush(): void {
    // send gossip first, which will also piggyback control
    for (const [peer, ihave] of this.gossip.entries()) {
      this.gossip.delete(peer)
      const out = createGossipRpc([], { ihave })
      this._sendRpc(peer, out)
    }
    // send the remaining control messages
    for (const [peer, control] of this.control.entries()) {
      this.control.delete(peer)
      const out = createGossipRpc([], { graft: control.graft, prune: control.prune })
      this._sendRpc(peer, out)
    }
  }

  /**
   * Adds new IHAVE messages to pending gossip
   */
  _pushGossip(id: string, controlIHaveMsgs: RPC.IControlIHave): void {
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
  async _makePrune(id: string, topic: string, doPX: boolean): Promise<RPC.IControlPrune> {
    if (this.peers.get(id)!.protocol === constants.GossipsubIDv10) {
      // Gossipsub v1.0 -- no backoff, the peer won't be able to parse it anyway
      return {
        topicID: topic,
        peers: [],
      }
    }
    // backoff is measured in seconds
    // GossipsubPruneBackoff is measured in milliseconds
    const backoff = constants.GossipsubPruneBackoff / 1000
    if (!doPX) {
      return {
        topicID: topic,
        peers: [],
        backoff: backoff,
      }
    }
    // select peers for Peer eXchange
    const peers = getGossipPeers(this, topic, constants.GossipsubPrunePeers, (xid: string): boolean => {
      return xid !== id && this.score.score(xid) >= 0
    })
    const px = await Promise.all(
      Array.from(peers).map(async (p) => {
        // see if we have a signed record to send back; if we don't, just send
        // the peer ID and let the pruned peer find them in the DHT -- we can't trust
        // unsigned address records through PX anyways
        // Finding signed records in the DHT is not supported at the time of writing in js-libp2p
        const peerId = PeerId.createFromB58String(p)
        return {
          peerID: peerId.toBytes(),
          signedPeerRecord: await this._libp2p.peerStore.addressBook.getRawEnvelope(peerId),
        }
      })
    )
    return {
      topicID: topic,
      peers: px,
      backoff: backoff,
    }
  }
}

export = Gossipsub

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { utils } from 'libp2p-interfaces/src/pubsub'
import { MessageCache } from './message-cache'
import {
  RPCCodec,
  RPC, Message, InMessage,
  ControlMessage, ControlIHave, ControlGraft, ControlIWant, ControlPrune, PeerInfo
} from './message'
import * as constants from './constants'
import { Heartbeat } from './heartbeat'
import { getGossipPeers } from './get-gossip-peers'
import { createGossipRpc, shuffle, hasGossipProtocol } from './utils'
import { PeerStreams } from './peer-streams'
import { PeerScore, PeerScoreParams, PeerScoreThresholds, createPeerScoreParams, createPeerScoreThresholds } from './score'
import { IWantTracer } from './tracer'
import { AddrInfo, Libp2p, EnvelopeClass } from './interfaces'
import { Debugger } from 'debug'
// @ts-ignore
import TimeCache = require('time-cache')
import PeerId = require('peer-id')
// @ts-ignore
import Envelope = require('libp2p/src/record/envelope')
// @ts-ignore
import Pubsub = require('libp2p-interfaces/src/pubsub')

interface GossipInputOptions {
  emitSelf: boolean
  gossipIncoming: boolean
  fallbackToFloodsub: boolean
  floodPublish: boolean
  doPX: boolean
  msgIdFn: (msg: InMessage) => string
  messageCache: MessageCache
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
}

interface GossipOptions extends GossipInputOptions {
  scoreParams: PeerScoreParams
  scoreThresholds: PeerScoreThresholds
}

class Gossipsub extends Pubsub {
  peers: Map<string, PeerStreams>
  direct: Set<string>
  seenCache: TimeCache
  topics: Map<string, Set<string>>
  mesh: Map<string, Set<string>>
  fanout: Map<string, Set<string>>
  lastpub: Map<string, number>
  gossip: Map<string, ControlIHave[]>
  control: Map<string, ControlMessage>
  peerhave:Map<string, number>
  iasked:Map<string, number>
  backoff: Map<string, Map<string, number>>
  outbound: Map<string, boolean>
  defaultMsgIdFn: (msg: InMessage) => string
  _msgIdFn: (msg: InMessage) => string
  messageCache: MessageCache
  score: PeerScore
  heartbeat: Heartbeat
  heartbeatTicks: number
  gossipTracer: IWantTracer
  multicodecs: string[]
  started: boolean
  peerId: PeerId
  subscriptions: Set<string>
  _libp2p: Libp2p
  _options: GossipOptions
  _directPeerInitial: NodeJS.Timeout
  log: Debugger
  // eslint-disable-next-line @typescript-eslint/ban-types
  emit: (...args: any) => void

  public static multicodec: string = constants.GossipsubIDv11

  // TODO: add remaining props
  /**
   * @param {Libp2p} libp2p
   * @param {Object} [options]
   * @param {bool} [options.emitSelf] if publish should emit to self, if subscribed, defaults to false
   * @param {bool} [options.gossipIncoming] if incoming messages on a subscribed topic should be automatically gossiped, defaults to true
   * @param {bool} [options.fallbackToFloodsub] if dial should fallback to floodsub, defaults to true
   * @param {bool} [options.floodPublish] if self-published messages should be sent to all peers, defaults to true
   * @param {bool} [options.doPX] whether PX is enabled; this should be enabled in bootstrappers and other well connected/trusted nodes. defaults to false
   * @param {function} [options.msgIdFn] override the default message id function
   * @param {Object} [options.messageCache] override the default MessageCache
   * @param {Object} [options.scoreParams] peer score parameters
   * @param {Object} [options.scoreThresholds] peer score thresholds
   * @param {AddrInfo[]} [options.directPeers] peers with which we will maintain direct connections
   * @constructor
   */
  constructor (
    libp2p: Libp2p,
    options: Partial<GossipInputOptions> = {}
  ) {
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
      ...options,
      scoreParams: createPeerScoreParams(options.scoreParams),
      scoreThresholds: createPeerScoreThresholds(options.scoreThresholds)
    } as GossipOptions

    // Also wants to get notified of peers connected using floodsub
    if (opts.fallbackToFloodsub) {
      multicodecs.push(constants.FloodsubID)
    }

    super({
      debugName: 'libp2p:gossipsub',
      multicodecs,
      libp2p,
      ...opts
    })

    this._options = opts

    /**
     * Direct peers
     * @type {Set<string>}
     */
    this.direct = new Set(opts.directPeers.map(p => p.id.toB58String()))

    // set direct peer addresses in the address book
    opts.directPeers.forEach(p => {
      libp2p.peerStore.addressBook.add(p.id, p.addrs)
    })

    /**
     * Cache of seen messages
     *
     * @type {TimeCache}
     */
    this.seenCache = new TimeCache()

    /**
     * Map of topic meshes
     * topic => peer id set
     *
     * @type {Map<string, Set<string>>}
     */
    this.mesh = new Map()

    /**
     * Map of topics to set of peers. These mesh peers are the ones to which we are publishing without a topic membership
     * topic => peer id set
     *
     * @type {Map<string, Set<string>>}
     */
    this.fanout = new Map()

    /**
     * Map of last publish time for fanout topics
     * topic => last publish time
     *
     * @type {Map<string, number>}
     */
    this.lastpub = new Map()

    /**
     * Map of pending messages to gossip
     * peer id => control messages
     *
     * @type {Map<string, Array<ControlIHave object>> }
     */
    this.gossip = new Map()

    /**
     * Map of control messages
     * peer id => control message
     *
     * @type {Map<string, ControlMessage object>}
     */
    this.control = new Map()

    /**
     * Number of IHAVEs received from peer in the last heartbeat
     * @type {Map<string, number>}
     */
    this.peerhave = new Map()

    /**
     * Number of messages we have asked from peer in the last heartbeat
     * @type {Map<string, number>}
     */
    this.iasked = new Map()

    /**
     * Prune backoff map
     */
    this.backoff = new Map()

    /**
     * Connection direction cache, marks peers with outbound connections
     * peer id => direction
     *
     * @type {Map<string, boolean>}
     */
    this.outbound = new Map()

    /**
     * Use the overriden mesgIdFn or the default one.
     */
    this.defaultMsgIdFn = (msg : InMessage) => utils.msgId(msg.from, msg.seqno)
    this._msgIdFn = options.msgIdFn || this.defaultMsgIdFn

    /**
     * A message cache that contains the messages for last few hearbeat ticks
     *
     */
    this.messageCache = options.messageCache || new MessageCache(constants.GossipsubHistoryGossip, constants.GossipsubHistoryLength, this._msgIdFn)

    /**
     * A heartbeat timer that maintains the mesh
     */
    this.heartbeat = new Heartbeat(this)

    /**
     * Number of heartbeats since the beginning of time
     * This allows us to amortize some resource cleanup -- eg: backoff cleanup
     */
    this.heartbeatTicks = 0

    /**
     * Tracks IHAVE/IWANT promises broken by peers
     */
    this.gossipTracer = new IWantTracer(this._msgIdFn)

    /**
     * libp2p
     */
    this._libp2p = libp2p

    /**
     * Peer score tracking
     */
    this.score = new PeerScore(this._options.scoreParams, libp2p.connectionManager, this._msgIdFn)
  }

  /**
   * Decode a Uint8Array into an RPC object
   * Overrided to use an extended protocol-specific protobuf decoder
   * @override
   * @param {Uint8Array} bytes
   * @returns {RPC}
   */
  _decodeRpc (bytes: Uint8Array) {
    return RPCCodec.decode(bytes)
  }

  /**
   * Encode an RPC object into a Uint8Array
   * Overrided to use an extended protocol-specific protobuf encoder
   * @override
   * @param {RPC} rpc
   * @returns {Uint8Array}
   */
  _encodeRpc (rpc: RPC) {
    return RPCCodec.encode(rpc)
  }

  /**
   * Add a peer to the router
   * @override
   * @param {PeerId} peerId
   * @param {string} protocol
   * @returns {PeerStreams}
   */
  _addPeer (peerId: PeerId, protocol: string): PeerStreams {
    const p = super._addPeer(peerId, protocol)

    // Add to peer scoring
    this.score.addPeer(peerId.toB58String())

    // track the connection direction
    let outbound = false
    for (const c of this._libp2p.connectionManager.getAll(peerId)) {
      if (c.stat.direction === 'outbound') {
        if (Array.from(c.registry.values()).some(rvalue => protocol === rvalue.protocol)) {
          outbound = true
          break
        }
      }
    }
    this.outbound.set(p, outbound)

    return p
  }

  /**
   * Removes a peer from the router
   * @override
   * @param {PeerId} peer
   * @returns {Peer}
   */
  _removePeer (peerId: PeerId): PeerStreams {
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

    return peerStreams
  }

  /**
   * Handles an rpc request from a peer
   *
   * @override
   * @param {String} idB58Str
   * @param {PeerStreams} peerStreams
   * @param {RPC} rpc
   * @returns {boolean}
   */
  _processRpc (id: string, peerStreams: PeerStreams, rpc: RPC): boolean {
    if (super._processRpc(id, peerStreams, rpc)) {
      if (rpc.control) {
        this._processRpcControlMessage(id, rpc.control)
      }
      return true
    }
    return false
  }

  /**
   * Handles an rpc control message from a peer
   * @param {string} id peer id
   * @param {ControlMessage} controlMsg
   * @returns {void}
   */
  _processRpcControlMessage (id: string, controlMsg: ControlMessage): void {
    if (!controlMsg) {
      return
    }

    const iwant = this._handleIHave(id, controlMsg.ihave)
    const ihave = this._handleIWant(id, controlMsg.iwant)
    const prune = this._handleGraft(id, controlMsg.graft)
    this._handlePrune(id, controlMsg.prune)

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
   * @param {InMessage} msg
   * @returns {Promise<void>}
   */
  async _processRpcMessage (msg: InMessage): Promise<void> {
    const msgID = this.getMsgId(msg)

    // Ignore if we've already seen the message
    if (this.seenCache.has(msgID)) {
      this.score.duplicateMessage(msg)
      return
    }
    this.seenCache.put(msgID)

    this.score.validateMessage(msg)
    await super._processRpcMessage(msg)
  }

  /**
   * Whether to accept a message from a peer
   * @override
   * @param {string} id
   * @returns {boolean}
   */
  _acceptFrom (id: string): boolean {
    return this.direct.has(id) || this.score.score(id) >= this._options.scoreThresholds.graylistThreshold
  }

  /**
   * Validate incoming message
   * @override
   * @param {InMessage} message
   * @returns {Promise<void>}
   */
  async validate (message: InMessage): Promise<void> {
    try {
      await super.validate(message)
    } catch (e) {
      this.score.rejectMessage(message, e.code)
      this.gossipTracer.rejectMessage(message, e.code)
      throw e
    }
  }

  /**
   * Handles IHAVE messages
   * @param {string} id peer id
   * @param {Array<ControlIHave>} ihave
   * @returns {ControlIWant}
   */
  _handleIHave (id: string, ihave: ControlIHave[]): ControlIWant[] {
    if (!ihave.length) {
      return []
    }
    // we ignore IHAVE gossip from any peer whose score is below the gossips threshold
    const score = this.score.score(id)
    if (score < this._options.scoreThresholds.gossipThreshold) {
      this.log(
        'IHAVE: ignoring peer %s with score below threshold [ score = %d ]',
        id, score
      )
      return []
    }

    // IHAVE flood protection
    const peerhave = (this.peerhave.get(id) || 0) + 1
    this.peerhave.set(id, peerhave)
    if (peerhave > constants.GossipsubMaxIHaveMessages) {
      this.log(
        'IHAVE: peer %s has advertised too many times (%d) within this heartbeat interval; ignoring',
        id, peerhave
      )
      return []
    }

    const iasked = this.iasked.get(id) || 0
    if (iasked >= constants.GossipsubMaxIHaveLength) {
      this.log(
        'IHAVE: peer %s has already advertised too many messages (%d); ignoring',
        id, iasked
      )
      return []
    }

    const iwant = new Set<string>()

    ihave.forEach(({ topicID, messageIDs }) => {
      if (!topicID || !this.mesh.has(topicID)) {
        return
      }

      messageIDs.forEach((msgID) => {
        if (this.seenCache.has(msgID)) {
          return
        }
        iwant.add(msgID)
      })
    })

    if (!iwant.size) {
      return []
    }

    let iask = iwant.size
    if (iask + iasked > constants.GossipsubMaxIHaveLength) {
      iask = constants.GossipsubMaxIHaveLength - iasked
    }

    this.log(
      'IHAVE: Asking for %d out of %d messages from %s',
      iask, iwant.size, id
    )

    let iwantList = Array.from(iwant)
    // ask in random order
    shuffle(iwantList)

    // truncate to the messages we are actually asking for and update the iasked counter
    iwantList = iwantList.slice(0, iask)
    this.iasked.set(id, iasked + iask)

    this.gossipTracer.addPromise(id, iwantList)

    return [{
      messageIDs: iwantList
    }]
  }

  /**
   * Handles IWANT messages
   * Returns messages to send back to peer
   * @param {string} id peer id
   * @param {Array<ControlIWant>} iwant
   * @returns {Array<Message>}
   */
  _handleIWant (id: string, iwant: ControlIWant[]): Message[] {
    if (!iwant.length) {
      return []
    }
    // we don't respond to IWANT requests from any per whose score is below the gossip threshold
    const score = this.score.score(id)
    if (score < this._options.scoreThresholds.gossipThreshold) {
      this.log(
        'IWANT: ignoring peer %s with score below threshold [score = %d]',
        id, score
      )
      return []
    }
    // @type {Map<string, Message>}
    const ihave = new Map<string, InMessage>()

    iwant.forEach(({ messageIDs }) => {
      messageIDs.forEach((msgID) => {
        const [msg, count] = this.messageCache.getForPeer(msgID, id)
        if (!msg) {
          return
        }

        if (count > constants.GossipsubGossipRetransmission) {
          this.log(
            'IWANT: Peer %s has asked for message %s too many times: ignoring request',
            id, msgID
          )
          return
        }
        ihave.set(msgID, msg)
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
   * @param {string} id peer id
   * @param {Array<ControlGraft>} graft
   * @return {Array<ControlPrune>}
   */
  _handleGraft (id: string, graft: ControlGraft[]): ControlPrune[] {
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
        this.log(
          'GRAFT: ignoring peer %s with negative score: score=%d, topic=%s',
          id, score, topicID
        )
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

    return prune.map(topic => this._makePrune(id, topic, doPX))
  }

  /**
   * Handles Prune messages
   * @param {string} id peer id
   * @param {Array<ControlPrune>} prune
   * @returns {void}
   */
  _handlePrune (id: string, prune: ControlPrune[]): void {
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
            id, score, topicID
          )
          return
        }
        this._pxConnect(peers)
      }
    })
  }

  /**
   * Add standard backoff log for a peer in a topic
   * @param {string} id
   * @param {string} topic
   * @returns {void}
   */
  _addBackoff (id: string, topic: string): void {
    this._doAddBackoff(id, topic, constants.GossipsubPruneBackoff)
  }

  /**
   * Add backoff expiry interval for a peer in a topic
   * @param {string} id
   * @param {string} topic
   * @param {number} interval backoff duration in milliseconds
   * @returns {void}
   */
  _doAddBackoff (id: string, topic: string, interval: number): void {
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
   * @returns {void}
   */
  _applyIwantPenalties (): void {
    this.gossipTracer.getBrokenPromises().forEach((count, p) => {
      this.log('peer %s didn\'t follow up in %d IWANT requests; adding penalty', p, count)
      this.score.addPenalty(p, count)
    })
  }

  /**
   * Clear expired backoff expiries
   * @returns {void}
   */
  _clearBackoff (): void {
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
   * @returns {void}
   */
  _directConnect (): void {
    // we only do this every few ticks to allow pending connections to complete and account for
    // restarts/downtime
    if (this.heartbeatTicks % constants.GossipsubDirectConnectTicks !== 0) {
      return
    }

    const toconnect: string[] = []
    this.direct.forEach(id => {
      const peer = this.peers.get(id)
      if (!peer || !peer.isWritable) {
        toconnect.push(id)
      }
    })
    if (toconnect.length) {
      toconnect.forEach(id => {
        this._connect(id)
      })
    }
  }

  /**
   * Maybe attempt connection given signed peer records
   * @param {PeerInfo[]} peers
   * @returns {Promise<void>}
   */
  async _pxConnect (peers: PeerInfo[]): Promise<void> {
    if (peers.length > constants.GossipsubPrunePeers) {
      shuffle(peers)
      peers = peers.slice(0, constants.GossipsubPrunePeers)
    }
    const toconnect: string[] = []

    await Promise.all(peers.map(async pi => {
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
        const envelope = await (Envelope as EnvelopeClass).openAndCertify(pi.signedPeerRecord, 'libp2p-peer-record')
        const eid = envelope.peerId.toB58String()
        if (id !== eid) {
          this.log(
            'bogus peer record obtained through px: peer ID %s doesn\'t match expected peer %s',
            eid, id
          )
          return
        }
        if (!this._libp2p.peerStore.addressBook.consumePeerRecord(envelope)) {
          this.log(
            'bogus peer record obtained through px: could not add peer record to address book'
          )
          return
        }
        toconnect.push(id)
      } catch (e) {
        this.log('bogus peer record obtained through px: invalid signature or not a peer record')
      }
    }))

    if (!toconnect.length) {
      return
    }

    toconnect.forEach(id => this._connect(id))
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   * @override
   * @returns {void}
   */
  start (): void {
    super.start()
    this.heartbeat.start()
    this.score.start()
    // connect to direct peers
    this._directPeerInitial = setTimeout(() => {
      this.direct.forEach(id => {
        this._connect(id)
      })
    }, constants.GossipsubDirectConnectInitialDelay)
  }

  /**
   * Unmounts the gossipsub protocol and shuts down every connection
   * @override
   * @returns {void}
   */
  stop (): void {
    super.stop()
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
    clearTimeout(this._directPeerInitial)
  }

  /**
   * Connect to a peer using the gossipsub protocol
   * @param {string} id
   * @returns {void}
   */
  _connect (id: string): void {
    this.log('Initiating connection with %s', id)
    this._libp2p.dialProtocol(PeerId.createFromB58String(id), this.multicodecs)
  }

  /**
   * Subscribes to a topic
   * @override
   * @param {string} topic
   * @returns {void}
   */
  subscribe (topic: string): void {
    super.subscribe(topic)
    this.join(topic)
  }

  /**
   * Unsubscribe to a topic
   * @override
   * @param {string} topic
   * @returns {void}
   */
  unsubscribe (topic: string): void {
    super.unsubscribe(topic)
    this.leave(topic)
  }

  /**
   * Join topic
   * @param {string} topic
   * @returns {void}
   */
  join (topic: string): void {
    if (!this.started) {
      throw new Error('Gossipsub has not started')
    }
    this.log('JOIN %s', topic)

    const fanoutPeers = this.fanout.get(topic)
    if (fanoutPeers) {
      // these peers have a score above the publish threshold, which may be negative
      // so drop the ones with a negative score
      fanoutPeers.forEach(id => {
        if (this.score.score(id) < 0) {
          fanoutPeers.delete(id)
        }
      })
      if (fanoutPeers.size < this._options.D) {
        // we need more peers; eager, as this would get fixed in the next heartbeat
        getGossipPeers(this, topic, this._options.D - fanoutPeers.size, (id: string): boolean => {
          // filter our current peers, direct peers, and peers with negative scores
          return !fanoutPeers.has(id) && !this.direct.has(id) && this.score.score(id) >= 0
        }).forEach(id => fanoutPeers.add(id))
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
   * @param {string} topic
   * @returns {void}
   */
  leave (topic: string): void {
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
   * Override the default implementation in BasicPubSub.
   * If we don't provide msgIdFn in constructor option, it's the same.
   * @override
   * @param {Message} msg the message object
   * @returns {string} message id as string
   */
  getMsgId (msg: InMessage): string {
    return this._msgIdFn(msg)
  }

  /**
   * Publish messages
   *
   * @override
   * @param {InMessage} msg
   * @returns {void}
   */
  async _publish (msg: InMessage): Promise<void> {
    if (msg.receivedFrom !== this.peerId.toB58String()) {
      this.score.deliverMessage(msg)
      this.gossipTracer.deliverMessage(msg)
    }

    const msgID = this.getMsgId(msg)
    // put in seen cache
    this.seenCache.put(msgID)

    this.messageCache.put(msg)

    const tosend = new Set<string>()
    msg.topicIDs.forEach((topic) => {
      const peersInTopic = this.topics.get(topic)
      if (!peersInTopic) {
        return
      }

      if (this._options.floodPublish && msg.from === this.peerId.toB58String()) {
        // flood-publish behavior
        // send to direct peers and _all_ peers meeting the publishThreshold
        peersInTopic.forEach(id => {
          if (this.direct.has(id) || this.score.score(id) >= this._options.scoreThresholds.publishThreshold) {
            tosend.add(id)
          }
        })
      } else {
        // non-flood-publish behavior
        // send to direct peers, subscribed floodsub peers
        // and some mesh peers above publishThreshold

        // direct peers
        this.direct.forEach(id => {
          tosend.add(id)
        })

        // floodsub peers
        peersInTopic.forEach((id) => {
          const score = this.score.score(id)
          const peerStreams = this.peers.get(id)
          if (!peerStreams) {
            return
          }
          if (peerStreams.protocol === constants.FloodsubID && score >= this._options.scoreThresholds.publishThreshold) {
            tosend.add(id)
          }
        })

        // Gossipsub peers handling
        let meshPeers = this.mesh.get(topic)
        if (!meshPeers) {
          // We are not in the mesh for topic, use fanout peers
          meshPeers = this.fanout.get(topic)
          if (!meshPeers) {
            // If we are not in the fanout, then pick peers in topic above the publishThreshold
            const peers = getGossipPeers(this, topic, this._options.D, id => {
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
    const rpc = createGossipRpc([
      utils.normalizeOutRpcMessage(msg)
    ])
    tosend.forEach((id) => {
      if (id === msg.from) {
        return
      }
      this._sendRpc(id, rpc)
    })
  }

  /**
   * Sends a GRAFT message to a peer
   * @param {string} id peer id
   * @param {string} topic
   * @returns {void}
   */
  _sendGraft (id: string, topic: string): void {
    const graft = [{
      topicID: topic
    }]

    const out = createGossipRpc([], { graft })
    this._sendRpc(id, out)
  }

  /**
   * Sends a PRUNE message to a peer
   * @param {string} id peer id
   * @param {string} topic
   * @returns {void}
   */
  _sendPrune (id: string, topic: string): void {
    const prune = [
      this._makePrune(id, topic, this._options.doPX)
    ]

    const out = createGossipRpc([], { prune })
    this._sendRpc(id, out)
  }

  /**
   * @override
   */
  _sendRpc (id: string, outRpc: RPC): void {
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

    peerStreams.write(RPCCodec.encode(outRpc))
  }

  _piggybackControl (id: string, outRpc: RPC, ctrl: ControlMessage): void {
    const tograft = (ctrl.graft || [])
      .filter(({ topicID }) => (topicID && this.mesh.get(topicID) || new Set()).has(id))
    const toprune = (ctrl.prune || [])
      .filter(({ topicID }) => !(topicID && this.mesh.get(topicID) || new Set()).has(id))

    if (!tograft.length && !toprune.length) {
      return
    }

    if (outRpc.control) {
      outRpc.control.graft = outRpc.control.graft.concat(tograft)
      outRpc.control.prune = outRpc.control.prune.concat(toprune)
    } else {
      outRpc.control = { ihave: [], iwant: [], graft: tograft, prune: toprune }
    }
  }

  _piggybackGossip (id: string, outRpc: RPC, ihave: ControlIHave[]): void {
    if (!outRpc.control) {
      outRpc.control = { ihave: [], iwant: [], graft: [], prune: [] }
    }
    outRpc.control.ihave = ihave
  }

  /**
   * Send graft and prune messages
   * @param {Map<string, Array<string>>} tograft peer id => topic[]
   * @param {Map<string, Array<string>>} toprune peer id => topic[]
   */
  _sendGraftPrune (tograft: Map<string, string[]>, toprune: Map<string, string[]>, noPX: Map<string, boolean>): void {
    const doPX = this._options.doPX
    for (const [id, topics] of tograft) {
      const graft = topics.map((topicID) => ({ topicID }))
      let prune: ControlPrune[] = []
      // If a peer also has prunes, process them now
      const pruning = toprune.get(id)
      if (pruning) {
        prune = pruning.map((topicID) => this._makePrune(id, topicID, doPX && !noPX.get(id)))
        toprune.delete(id)
      }

      const outRpc = createGossipRpc([], { graft, prune })
      this._sendRpc(id, outRpc)
    }
    for (const [id, topics] of toprune) {
      const prune = topics.map((topicID) => this._makePrune(id, topicID, doPX && !noPX.get(id)))
      const outRpc = createGossipRpc([], { prune })
      this._sendRpc(id, outRpc)
    }
  }

  /**
   * Emits gossip to peers in a particular topic
   * @param {string} topic
   * @param {Set<string>} exclude peers to exclude
   * @returns {void}
   */
  _emitGossip (topic: string, exclude: Set<string>): void {
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
    topicPeers.forEach(id => {
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
    peersToGossip.slice(0, target).forEach(id => {
      let peerMessageIDs = messageIDs
      if (messageIDs.length > constants.GossipsubMaxIHaveLength) {
        // shuffle and slice message IDs per peer so that we emit a different set for each peer
        // we have enough reduncancy in the system that this will significantly increase the message
        // coverage when we do truncate
        peerMessageIDs = shuffle(peerMessageIDs.slice()).slice(0, constants.GossipsubMaxIHaveLength)
      }
      this._pushGossip(id, {
        topicID: topic,
        messageIDs: peerMessageIDs
      })
    })
  }

  /**
   * Flush gossip and control messages
   */
  _flush (): void {
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
   * @param {PeerStreams} peerStreams
   * @param {Array<ControlIHave>} controlIHaveMsgs
   * @returns {void}
   */
  _pushGossip (id: string, controlIHaveMsgs: ControlIHave): void {
    this.log('Add gossip to %s', id)
    const gossip = this.gossip.get(id) || []
    this.gossip.set(id, gossip.concat(controlIHaveMsgs))
  }

  /**
   * Returns the current time in milliseconds
   * @returns {number}
   */
  _now (): number {
    return Date.now()
  }

  /**
   * Make a PRUNE control message for a peer in a topic
   * @param {string} id
   * @param {string} topic
   * @param {boolean} doPX
   * @returns {ControlPrune}
   */
  _makePrune (id: string, topic: string, doPX: boolean): ControlPrune {
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
    const px: PeerInfo[] = []
    if (doPX) {
      // select peers for Peer eXchange
      const peers = getGossipPeers(this, topic, constants.GossipsubPrunePeers, (xid: string): boolean => {
        return xid !== id && this.score.score(xid) >= 0
      })
      peers.forEach(p => {
        // see if we have a signed record to send back; if we don't, just send
        // the peer ID and let the pruned peer find them in the DHT -- we can't trust
        // unsigned address records through PX anyways
        // Finding signed records in the DHT is not supported at the time of writing in js-libp2p
        const peerId = PeerId.createFromB58String(p)
        px.push({
          peerID: peerId.toBytes(),
          signedPeerRecord: this._libp2p.peerStore.addressBook.getRawEnvelope(peerId)
        })
      })
    }
    return {
      topicID: topic,
      peers: px,
      backoff: backoff
    }
  }
}

export = Gossipsub

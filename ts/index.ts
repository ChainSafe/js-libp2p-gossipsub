/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { utils } from 'libp2p-pubsub'
import { MessageCache } from './messageCache'
import {
  RPCCodec,
  RPC, Message, InMessage,
  ControlMessage, ControlIHave, ControlGraft, ControlIWant, ControlPrune
} from './message'
import * as constants from './constants'
import { ExtendedValidatorResult } from './constants'
import { Heartbeat } from './heartbeat'
import { getGossipPeers } from './getGossipPeers'
import { createGossipRpc, shuffle, hasGossipProtocol } from './utils'
import { Peer } from './peer'
import { PeerScore, PeerScoreParams, PeerScoreThresholds, createPeerScoreParams, createPeerScoreThresholds } from './score'
import { IWantTracer } from './tracer'
import { AddrInfo, Libp2p } from './interfaces'
// @ts-ignore
import TimeCache = require('time-cache')
import PeerId = require('peer-id')
import BasicPubsub = require('./pubsub')

interface GossipInputOptions {
  emitSelf: boolean
  gossipIncoming: boolean
  fallbackToFloodsub: boolean
  floodPublish: boolean
  msgIdFn: (msg: Message) => string
  messageCache: MessageCache
  scoreParams: Partial<PeerScoreParams>
  scoreThresholds: Partial<PeerScoreThresholds>
  directPeers: AddrInfo[]
}

interface GossipOptions extends GossipInputOptions {
  scoreParams: PeerScoreParams
  scoreThresholds: PeerScoreThresholds
}

class Gossipsub extends BasicPubsub {
  peers: Map<string, Peer>
  direct: Set<string>
  topics: Map<string, Set<Peer>>
  mesh: Map<string, Set<Peer>>
  fanout: Map<string, Set<Peer>>
  lastpub: Map<string, number>
  gossip: Map<Peer, ControlIHave[]>
  control: Map<Peer, ControlMessage>
  peerhave:Map<string, number>
  iasked:Map<string, number>
  backoff: Map<string, Map<string, number>>
  outbound: Map<Peer, boolean>
  score: PeerScore
  heartbeatTicks: number
  gossipTracer: IWantTracer
  _libp2p: Libp2p
  _options: GossipOptions

  public static multicodec: string = constants.GossipsubIDv11

  /**
   * @param {Libp2p} libp2p
   * @param {Object} [options]
   * @param {bool} [options.emitSelf] if publish should emit to self, if subscribed, defaults to false
   * @param {bool} [options.gossipIncoming] if incoming messages on a subscribed topic should be automatically gossiped, defaults to true
   * @param {bool} [options.fallbackToFloodsub] if dial should fallback to floodsub, defaults to true
   * @param {bool} [options.floodPublish] if self-published messages should be sent to all peers, defaults to true
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
    const _options = {
      gossipIncoming: true,
      fallbackToFloodsub: true,
      floodPublish: true,
      directPeers: [],
      ...options,
      scoreParams: createPeerScoreParams(options.scoreParams),
      scoreThresholds: createPeerScoreThresholds(options.scoreThresholds)
    } as GossipOptions

    // Also wants to get notified of peers connected using floodsub
    if (_options.fallbackToFloodsub) {
      multicodecs.push(constants.FloodsubID)
    }

    super({
      debugName: 'libp2p:gossipsub',
      multicodecs,
      libp2p,
      options: _options
    })

    /**
     * Direct peers
     * @type {Set<string>}
     */
    this.direct = new Set(_options.directPeers.map(p => p.id.toB58String()))

    // set direct peer addresses in the address book
    _options.directPeers.forEach(p => {
      p.addrs.forEach(ma => libp2p.peerStore.addressBook.add(p.id, ma))
    })

    /**
     * Cache of seen messages
     *
     * @type {TimeCache}
     */
    this.seenCache = new TimeCache()

    /**
     * Map of topic meshes
     *
     * @type {Map<string, Set<Peer>>}
     */
    this.mesh = new Map()

    /**
     * Map of topics to set of peers. These mesh peers are the ones to which we are publishing without a topic membership
     *
     * @type {Map<string, Set<Peer>>}
     */
    this.fanout = new Map()

    /**
     * Map of last publish time for fanout topics
     *
     * @type {Map<string, Number>}
     */
    this.lastpub = new Map()

    /**
     * Map of pending messages to gossip
     *
     * @type {Map<Peer, Array<ControlIHave object>> }
     */
    this.gossip = new Map()

    /**
     * Map of control messages
     *
     * @type {Map<Peer, ControlMessage object>}
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
     *
     * @type {Map<Peer, boolean>}
     */
    this.outbound = new Map()

    /**
     * Use the overriden mesgIdFn or the default one.
     */
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
   * Add a peer to the router
   * @param {PeerId} peerId
   * @param {Array<string>} protocols
   * @returns {Peer}
   */
  _addPeer (peerId: PeerId, protocols: string[]): Peer {
    const p = super._addPeer(peerId, protocols)

    // Add to peer scoring
    this.score.addPeer(peerId.toB58String())

    // track the connection direction
    let outbound = false
    for (const c of this._libp2p.connectionManager.getAll(peerId)) {
      if (c.stat.direction === 'outbound') {
        if (Array.from(c.registry.values()).some(rvalue => protocols.includes(rvalue.protocol))) {
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
   * @param {Peer} peer
   * @returns {Peer}
   */
  _removePeer (peer: Peer): Peer {
    super._removePeer(peer)

    // Remove this peer from the mesh
    // eslint-disable-next-line no-unused-vars
    for (const peers of this.mesh.values()) {
      peers.delete(peer)
    }

    // Remove this peer from the fanout
    // eslint-disable-next-line no-unused-vars
    for (const peers of this.fanout.values()) {
      peers.delete(peer)
    }

    // Remove from gossip mapping
    this.gossip.delete(peer)
    // Remove from control mapping
    this.control.delete(peer)
    // Remove from backoff mapping
    this.outbound.delete(peer)

    // Remove from peer scoring
    this.score.removePeer(peer.id.toB58String())

    return peer
  }

  /**
   * Handles an rpc request from a peer
   *
   * @override
   * @param {String} idB58Str
   * @param {Peer} peer
   * @param {RPC} rpc
   * @returns {boolean}
   */
  _processRpc (idB58Str: string, peer: Peer, rpc: RPC): boolean {
    if (super._processRpc(idB58Str, peer, rpc)) {
      if (rpc.control) {
        this._processRpcControlMessage(peer, rpc.control)
      }
      return true
    }
    return false
  }

  /**
   * Handles an rpc control message from a peer
   * @param {Peer} peer
   * @param {ControlMessage} controlMsg
   * @returns {void}
   */
  _processRpcControlMessage (peer: Peer, controlMsg: ControlMessage): void {
    if (!controlMsg) {
      return
    }

    const iwant = this._handleIHave(peer, controlMsg.ihave)
    const ihave = this._handleIWant(peer, controlMsg.iwant)
    const prune = this._handleGraft(peer, controlMsg.graft)
    this._handlePrune(peer, controlMsg.prune)

    if (!iwant || !ihave || !prune) {
      return
    }

    const outRpc = createGossipRpc(ihave, { iwant: [iwant], prune })
    this._sendRpc(peer, outRpc)
  }

  /**
   * Process incoming message,
   * emitting locally and forwarding on to relevant floodsub and gossipsub peers
   * @override
   * @param {Peer} peer
   * @param {Message} msg
   */
  async _processRpcMessage (peer: Peer, msg: InMessage): Promise<void> {
    const msgID = this.getMsgId(msg)

    // Ignore if we've already seen the message
    if (this.seenCache.has(msgID)) {
      this.score.duplicateMessage(peer.id.toB58String(), msg as Message)
      return
    }
    this.seenCache.put(msgID)

    this.score.validateMessage(peer.id.toB58String(), msg as Message)
    await super._processRpcMessage(peer, msg)
  }

  /**
   * Publish a message sent from a peer
   * @override
   * @param {Peer} peer
   * @param {InMessage} msg
   * @returns {void}
   */
  _publishFrom (peer: Peer, msg: InMessage): void {
    const id = peer.id.toB58String()
    this.score.deliverMessage(id, msg as Message)
    this.gossipTracer.deliverMessage(id, msg as Message)
    const topics = msg.topicIDs

    // If options.gossipIncoming is false, do NOT emit incoming messages to peers
    if (this._options.gossipIncoming) {
      // Emit to floodsub peers
      this.peers.forEach((peer) => {
        if (peer.protocols.includes(constants.FloodsubID) &&
          peer.id.toB58String() !== msg.from &&
          utils.anyMatch(peer.topics, topics) &&
          peer.isWritable
        ) {
          peer.sendMessages(utils.normalizeOutRpcMessages([msg]))
          this.log('publish msg on topics - floodsub', topics, peer.id.toB58String())
        }
      })

      // Emit to peers in the mesh
      topics.forEach((topic) => {
        const meshPeers = this.mesh.get(topic)
        if (!meshPeers) {
          return
        }
        meshPeers.forEach((peer) => {
          if (!peer.isWritable || peer.id.toB58String() === msg.from) {
            return
          }
          peer.sendMessages(utils.normalizeOutRpcMessages([msg]))
          this.log('publish msg on topic - meshsub', topic, peer.id.toB58String())
        })
      })
    }

    // Emit to self
    super._publishFrom(peer, msg)
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
   * Coerse topic validator result to valid/invalid boolean
   * Provide extended validator support
   *
   * @override
   * @param {string} topic
   * @param {Peer} peer
   * @param {Message} message
   * @param {unknown} result
   * @returns {boolean}
   */
  _processTopicValidatorResult (topic: string, peer: Peer, message: Message, result: unknown): boolean {
    if (typeof result === 'string') {
      const id = peer.id.toB58String()
      // assume an extended topic validator result
      switch (result) {
        case ExtendedValidatorResult.accept:
          return true
        case ExtendedValidatorResult.reject:
          this.score.rejectMessage(id, message)
          this.gossipTracer.rejectMessage(id, message)
          return false
        case ExtendedValidatorResult.ignore:
          this.score.ignoreMessage(id, message)
          this.gossipTracer.rejectMessage(id, message)
          return false
      }
    }
    // assume a basic topic validator result
    return super._processTopicValidatorResult(topic, peer, message, result)
  }

  /**
   * Handles IHAVE messages
   * @param {Peer} peer
   * @param {Array<ControlIHave>} ihave
   * @returns {ControlIWant}
   */
  _handleIHave (peer: Peer, ihave: ControlIHave[]): ControlIWant | undefined {
    // we ignore IHAVE gossip from any peer whose score is below the gossips threshold
    const id = peer.id.toB58String()
    const score = this.score.score(id)
    if (score < this._options.scoreThresholds.gossipThreshold) {
      this.log(
        'IHAVE: ignoring peer %s with score below threshold [ score = %d ]',
        id, score
      )
      return
    }

    // IHAVE flood protection
    const peerhave = (this.peerhave.get(id) || 0) + 1
    this.peerhave.set(id, peerhave)
    if (peerhave > constants.GossipsubMaxIHaveMessages) {
      this.log(
        'IHAVE: peer %s has advertised too many times (%d) within this heartbeat interval; ignoring',
        id, peerhave
      )
      return
    }

    const iasked = this.iasked.get(id) || 0
    if (iasked >= constants.GossipsubMaxIHaveLength) {
      this.log(
        'IHAVE: peer %s has already advertised too many messages (%d); ignoring',
        id, iasked
      )
      return
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
      return
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

    return {
      messageIDs: iwantList
    }
  }

  /**
   * Handles IWANT messages
   * Returns messages to send back to peer
   * @param {Peer} peer
   * @param {Array<ControlIWant>} iwant
   * @returns {Array<Message>}
   */
  _handleIWant (peer: Peer, iwant: ControlIWant[]): Message[] | undefined {
    // @type {Map<string, Message>}
    const ihave = new Map<string, Message>()

    iwant.forEach(({ messageIDs }) => {
      messageIDs.forEach((msgID) => {
        const msg = this.messageCache.get(msgID)
        if (msg) {
          ihave.set(msgID, msg)
        }
      })
    })

    if (!ihave.size) {
      return
    }

    this.log('IWANT: Sending %d messages to %s', ihave.size, peer.id.toB58String())

    return Array.from(ihave.values())
  }

  /**
   * Handles Graft messages
   * @param {Peer} peer
   * @param {Array<ControlGraft>} graft
   * @return {Array<ControlPrune>}
   */
  _handleGraft (peer: Peer, graft: ControlGraft[]): ControlPrune[] | undefined {
    const prune: string[] = []
    const id = peer.id.toB58String()
    const score = this.score.score(id)
    const now = this._now()

    graft.forEach(({ topicID }) => {
      if (!topicID) {
        return
      }
      const peersInMesh = this.mesh.get(topicID)
      if (!peersInMesh) {
        // spam hardening: ignore GRAFTs for unknown topics
        return
      }

      // check if peer is already in the mesh; if so do nothing
      if (peersInMesh.has(peer)) {
        return
      }

      // we don't GRAFT to/from direct peers; complain loudly if this happens
      if (this.direct.has(id)) {
        this.log('GRAFT: ignoring request from direct peer %s', id)
        // this is possibly a bug from a non-reciprical configuration; send a PRUNE
        prune.push(topicID)
        return
      }

      // make sure we are not backing off that peer
      const expire = this.backoff.get(topicID)?.get(id)
      if (typeof expire === 'number' && now < expire) {
        this.log('GRAFT: ignoring backed off peer %s', id)
        // add behavioral penalty
        this.score.addPenalty(id, 1)
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
        // add/refresh backoff so that we don't reGRAFT too early even if the score decays
        this._addBackoff(id, topicID)
        return
      }

      // check the number of mesh peers; if it is at (or over) Dhi, we only accept grafts
      // from peers with outbound connections; this is a defensive check to restrict potential
      // mesh takeover attacks combined with love bombing
      if (peersInMesh.size >= constants.GossipsubDhi && !this.outbound.get(peer)) {
        prune.push(topicID)
        this._addBackoff(id, topicID)
        return
      }

      this.log('GRAFT: Add mesh link from %s in %s', id, topicID)
      peersInMesh.add(peer)
      peer.topics.add(topicID)
    })

    if (!prune.length) {
      return
    }

    return prune.map(topic => this._makePrune(id, topic))
  }

  /**
   * Handles Prune messages
   * @param {Peer} peer
   * @param {Array<ControlPrune>} prune
   * @returns {void}
   */
  _handlePrune (peer: Peer, prune: ControlPrune[]): void {
    const id = peer.id.toB58String()
    prune.forEach(({ topicID, backoff }) => {
      if (!topicID) {
        return
      }
      const peers = this.mesh.get(topicID)
      if (peers) {
        this.log('PRUNE: Remove mesh link to %s in %s', peer.id.toB58String(), topicID)
        peers.delete(peer)
        peer.topics.delete(topicID)
        // is there a backoff specified by the peer? if so obey it
        if (typeof backoff === 'number' && backoff > 0) {
          this._doAddBackoff(id, topicID, backoff * 1000)
        } else {
          this._addBackoff(id, topicID)
        }
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
      if (!peer || !peer.isConnected) {
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
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   * @override
   * @returns {Promise}
   */
  async start (): Promise<void> {
    await super.start()
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
   * @returns {Promise}
   */
  async stop (): Promise<void> {
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
    clearTimeout(this._directPeerInitial)
  }

  /**
   * Connect to a peer using the gossipsub protocol
   * @param {string} id
   * @returns {void}
   */
  _connect (id: string): void {
    this._libp2p.dialProtocol(id, this.multicodecs)
  }

  /**
   * Subscribes to topics
   *
   * @override
   * @param {Array<string>} topics
   * @returns {void}
   */
  _subscribe (topics: string[]): void {
    super._subscribe(topics)
    this.join(topics)
  }

  /**
   * Unsubscribes to topics
   *
   * @override
   * @param {Array<string>} topics
   * @returns {void}
   */
  _unsubscribe (topics: string[]): void {
    super._unsubscribe(topics)
    this.leave(topics)
  }

  /**
   * Join topics
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  join (topics: string[] | string): void {
    if (!this.started) {
      throw new Error('Gossipsub has not started')
    }
    topics = utils.ensureArray(topics)

    this.log('JOIN %s', topics)

    ;(topics as string[]).forEach((topic) => {
      const fanoutPeers = this.fanout.get(topic)
      if (fanoutPeers) {
        // these peers have a score above the publish threshold, which may be negative
        // so drop the ones with a negative score
        fanoutPeers.forEach(p => {
          if (this.score.score(p.id.toB58String()) < 0) {
            fanoutPeers.delete(p)
          }
        })
        if (fanoutPeers.size < constants.GossipsubD) {
          // we need more peers; eager, as this would get fixed in the next heartbeat
          getGossipPeers(this, topic, constants.GossipsubD - fanoutPeers.size, (p: Peer): boolean => {
            const id = p.id.toB58String()
            // filter our current peers, direct peers, and peers with negative scores
            return !fanoutPeers.has(p) && !this.direct.has(id) && this.score.score(id) >= 0
          }).forEach(p => fanoutPeers.add(p))
        }
        this.mesh.set(topic, fanoutPeers)
        this.fanout.delete(topic)
        this.lastpub.delete(topic)
      } else {
        const peers = getGossipPeers(this, topic, constants.GossipsubD, (p: Peer): boolean => {
          const id = p.id.toB58String()
          // filter direct peers and peers with negative score
          return !this.direct.has(id) && this.score.score(id) >= 0
        })
        this.mesh.set(topic, peers)
      }
      this.mesh.get(topic)!.forEach((peer) => {
        this.log('JOIN: Add mesh link to %s in %s', peer.id.toB58String(), topic)
        this._sendGraft(peer, topic)
      })
    })
  }

  /**
   * Leave topics
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  leave (topics: string[] | string): void {
    topics = utils.ensureArray(topics)

    this.log('LEAVE %s', topics)

    ;(topics as string[]).forEach((topic) => {
      // Send PRUNE to mesh peers
      const meshPeers = this.mesh.get(topic)
      if (meshPeers) {
        meshPeers.forEach((peer) => {
          this.log('LEAVE: Remove mesh link to %s in %s', peer.id.toB58String(), topic)
          this._sendPrune(peer, topic)
        })
        this.mesh.delete(topic)
      }
    })
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
   * @param {Array<Message>} msgs
   * @returns {void}
   */
  _publish (msgs: InMessage[]): void {
    msgs.forEach((msgObj) => {
      const msgID = this.getMsgId(msgObj)
      // put in seen cache
      this.seenCache.put(msgID)

      this.messageCache.put(msgObj)

      const tosend = new Set<Peer>()
      msgObj.topicIDs.forEach((topic) => {
        const peersInTopic = this.topics.get(topic)
        if (!peersInTopic) {
          return
        }

        if (this._options.floodPublish) {
          // flood-publish behavior
          // send to direct peers and _all_ peers meeting the publishThreshold
          peersInTopic.forEach(peer => {
            const id = peer.id.toB58String()
            if (this.direct.has(id) || this.score.score(id) >= this._options.scoreThresholds.publishThreshold) {
              tosend.add(peer)
            }
          })
        } else {
          // non-flood-publish behavior
          // send to direct peers, subscribed floodsub peers
          // and some mesh peers above publishThreshold

          // direct peers
          this.direct.forEach(id => {
            const peer = this.peers.get(id)
            if (peer) {
              tosend.add(peer)
            }
          })

          // floodsub peers
          peersInTopic.forEach((peer) => {
            const score = this.score.score(peer.id.toB58String())
            if (peer.protocols.includes(constants.FloodsubID) && score >= this._options.scoreThresholds.publishThreshold) {
              tosend.add(peer)
            }
          })

          // Gossipsub peers handling
          let meshPeers = this.mesh.get(topic)
          if (!meshPeers) {
            // We are not in the mesh for topic, use fanout peers
            meshPeers = this.fanout.get(topic)
            if (!meshPeers) {
              // If we are not in the fanout, then pick peers in topic above the publishThreshold
              const peers = getGossipPeers(this, topic, constants.GossipsubD, peer => {
                return this.score.score(peer.id.toB58String()) >= this._options.scoreThresholds.publishThreshold
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
      tosend.forEach((peer) => {
        if (peer.id.toB58String() === msgObj.from) {
          return
        }
        this._sendRpc(peer, createGossipRpc([utils.normalizeOutRpcMessage(msgObj)]))
      })
    })
  }

  /**
   * Sends a GRAFT message to a peer
   * @param {Peer} peer
   * @param {String} topic
   * @returns {void}
   */
  _sendGraft (peer: Peer, topic: string): void {
    const graft = [{
      topicID: topic
    }]

    const out = createGossipRpc([], { graft })
    this._sendRpc(peer, out)
  }

  /**
   * Sends a PRUNE message to a peer
   * @param {Peer} peer
   * @param {String} topic
   * @returns {void}
   */
  _sendPrune (peer: Peer, topic: string): void {
    const prune = [
      this._makePrune(peer.id.toB58String(), topic)
    ]

    const out = createGossipRpc([], { prune })
    this._sendRpc(peer, out)
  }

  _sendRpc (peer: Peer, outRpc: RPC): void {
    if (!peer || !peer.isWritable) {
      return
    }

    // piggyback control message retries
    const ctrl = this.control.get(peer)
    if (ctrl) {
      this._piggybackControl(peer, outRpc, ctrl)
      this.control.delete(peer)
    }

    // piggyback gossip
    const ihave = this.gossip.get(peer)
    if (ihave) {
      this._piggybackGossip(peer, outRpc, ihave)
      this.gossip.delete(peer)
    }

    peer.write(RPCCodec.encode(outRpc))
  }

  _piggybackControl (peer: Peer, outRpc: RPC, ctrl: ControlMessage): void {
    const tograft = (ctrl.graft || [])
      .filter(({ topicID }) => (topicID && this.mesh.get(topicID) || new Set()).has(peer))
    const toprune = (ctrl.prune || [])
      .filter(({ topicID }) => !(topicID && this.mesh.get(topicID) || new Set()).has(peer))

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

  _piggybackGossip (peer: Peer, outRpc: RPC, ihave: ControlIHave[]): void {
    if (!outRpc.control) {
      outRpc.control = { ihave: [], iwant: [], graft: [], prune: [] }
    }
    outRpc.control.ihave = ihave
  }

  /**
   * Send graft and prune messages
   * @param {Map<Peer, Array<String>>} tograft
   * @param {Map<Peer, Array<String>>} toprune
   */
  _sendGraftPrune (tograft: Map<Peer, string[]>, toprune: Map<Peer, string[]>): void {
    for (const [p, topics] of tograft) {
      const id = p.id.toB58String()
      const graft = topics.map((topicID) => ({ topicID }))
      let prune: ControlPrune[] = []
      // If a peer also has prunes, process them now
      const pruning = toprune.get(p)
      if (pruning) {
        prune = pruning.map((topicID) => this._makePrune(id, topicID))
        toprune.delete(p)
      }

      const outRpc = createGossipRpc([], { graft, prune })
      this._sendRpc(p, outRpc)
    }
    for (const [p, topics] of toprune) {
      const id = p.id.toB58String()
      const prune = topics.map((topicID) => this._makePrune(id, topicID))
      const outRpc = createGossipRpc([], { prune })
      this._sendRpc(p, outRpc)
    }
  }

  /**
   * Emits gossip to peers in a particular topic
   * @param {String} topic
   * @param {Set<Peer>} exclude peers to exclude
   * @returns {void}
   */
  _emitGossip (topic: string, exclude: Set<Peer>): void {
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
    const peersToGossip: Peer[] = []
    const topicPeers = this.topics.get(topic)
    if (!topicPeers) {
      // no topic peers, no gossip
      return
    }
    topicPeers.forEach(p => {
      const id = p.id.toB58String()
      if (
        !exclude.has(p) &&
        !this.direct.has(id) &&
        hasGossipProtocol(p.protocols) &&
        this.score.score(id) >= this._options.scoreThresholds.gossipThreshold
      ) {
        peersToGossip.push(p)
      }
    })

    let target = constants.GossipsubDlazy
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
    peersToGossip.slice(0, target).forEach(p => {
      let peerMessageIDs = messageIDs
      if (messageIDs.length > constants.GossipsubMaxIHaveLength) {
        // shuffle and slice message IDs per peer so that we emit a different set for each peer
        // we have enough reduncancy in the system that this will significantly increase the message
        // coverage when we do truncate
        peerMessageIDs = shuffle(peerMessageIDs.slice()).slice(0, constants.GossipsubMaxIHaveLength)
      }
      this._pushGossip(p, {
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
   * @param {Peer} peer
   * @param {Array<ControlIHave>} controlIHaveMsgs
   * @returns {void}
   */
  _pushGossip (peer: Peer, controlIHaveMsgs: ControlIHave): void {
    this.log('Add gossip to %s', peer.id.toB58String())
    const gossip = this.gossip.get(peer) || []
    this.gossip.set(peer, gossip.concat(controlIHaveMsgs))
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
   * @returns {ControlPrune}
   */
  _makePrune (id: string, topic: string): ControlPrune {
    if (this.peers.get(id)!.protocols.includes(constants.GossipsubIDv10)) {
      // Gossipsub v1.0 -- no backoff, the peer won't be able to parse it anyway
      return {
        topicID: topic,
        peers: []
      }
    }
    // backoff is measured in seconds
    // GossipsubPruneBackoff is measured in milliseconds
    const backoff = constants.GossipsubPruneBackoff / 1000
    return {
      topicID: topic,
      peers: [],
      backoff: backoff
    }
  }
}

export = Gossipsub

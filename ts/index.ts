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
import { Libp2p } from './interfaces'
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
}

interface GossipOptions extends GossipInputOptions {
  scoreParams: PeerScoreParams
  scoreThresholds: PeerScoreThresholds
}

class Gossipsub extends BasicPubsub {
  peers: Map<string, Peer>
  topics: Map<string, Set<Peer>>
  mesh: Map<string, Set<Peer>>
  fanout: Map<string, Set<Peer>>
  lastpub: Map<string, number>
  gossip: Map<Peer, ControlIHave[]>
  control: Map<Peer, ControlMessage>
  backoff: Map<string, Map<string, number>>
  outbound: Map<Peer, boolean>
  score: PeerScore
  heartbeatTicks: number
  _libp2p: Libp2p
  _options: GossipOptions

  public static multicodec: string = constants.GossipsubIDv10

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
   * @constructor
   */
  constructor (
    libp2p: Libp2p,
    options: Partial<GossipInputOptions> = {}
  ) {
    const multicodecs = [constants.GossipsubIDv10]
    const _options = {
      gossipIncoming: true,
      fallbackToFloodsub: true,
      floodPublish: true,
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
    this.score.deliverMessage(peer.id.toB58String(), msg as Message)
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
      // assume an extended topic validator result
      switch (result) {
        case ExtendedValidatorResult.accept:
          return true
        case ExtendedValidatorResult.reject:
          this.score.rejectMessage(peer.id.toB58String(), message)
          return false
        case ExtendedValidatorResult.ignore:
          this.score.ignoreMessage(peer.id.toB58String(), message)
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

    this.log('IHAVE: Asking for %d messages from %s', iwant.size, peer.id.toB58String())

    return {
      messageIDs: Array.from(iwant)
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
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   * @override
   * @returns {Promise}
   */
  async start (): Promise<void> {
    await super.start()
    this.heartbeat.start()
    this.score.start()
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
    this.backoff = new Map()
    this.outbound = new Map()
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
      // Send GRAFT to mesh peers
      const fanoutPeers = this.fanout.get(topic)
      if (fanoutPeers) {
        this.mesh.set(topic, fanoutPeers)
        this.fanout.delete(topic)
        this.lastpub.delete(topic)
      } else {
        const peers = getGossipPeers(this, topic, constants.GossipsubD)
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
          // send to _all_ peers meeting the publishThreshold
          peersInTopic.forEach(peer => {
            const score = this.score.score(peer.id.toB58String())
            if (score >= this._options.scoreThresholds.publishThreshold) {
              tosend.add(peer)
            }
          })
        } else {
          // non-flood-publish behavior
          // send to subscribed floodsub peers
          // and some mesh peers above publishThreshold

          // floodsub peers
          peersInTopic.forEach((peer) => {
            if (peer.protocols.includes(constants.FloodsubID)) {
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
    const peersToGossip: Peer[] = []
    const topicPeers = this.topics.get(topic)
    if (!topicPeers) {
      // no topic peers, no gossip
      return
    }
    topicPeers.forEach(p => {
      if (
        !exclude.has(p) &&
        hasGossipProtocol(p.protocols) &&
        this.score.score(p.id.toB58String()) >= this._options.scoreThresholds.gossipThreshold
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

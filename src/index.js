'use strict'

const { utils } = require('libp2p-pubsub')
const TimeCache = require('time-cache')

const BasicPubsub = require('./pubsub')
const { MessageCache } = require('./messageCache')

const { RPC } = require('./message')
const constants = require('./constants')
const Heartbeat = require('./heartbeat')
const getGossipPeers = require('./getGossipPeers')
const { createGossipRpc } = require('./utils')

class GossipSub extends BasicPubsub {
  /**
   * @param {PeerId} peerId instance of the peer's PeerId
   * @param {Object} registrar
   * @param {function} registrar.handle
   * @param {function} registrar.register
   * @param {function} registrar.unregister
   * @param {Object} [options]
   * @param {bool} [options.emitSelf] if publish should emit to self, if subscribed, defaults to false
   * @param {bool} [options.gossipIncoming] if incoming messages on a subscribed topic should be automatically gossiped, defaults to true
   * @param {bool} [options.fallbackToFloodsub] if dial should fallback to floodsub, defaults to true
   * @param {function} [options.msgIdFn] override the default message id function
   * @param {Object} [options.messageCache] override the default MessageCache
   * @constructor
   */
  constructor (peerId, registrar, options = {}) {
    const multicodecs = [constants.GossipSubID]
    const _options = {
      gossipIncoming: true,
      fallbackToFloodsub: true,
      ...options
    }

    // Also wants to get notified of peers connected using floodsub
    if (_options.fallbackToFloodsub) {
      multicodecs.push(constants.FloodSubID)
    }

    super({
      debugName: 'libp2p:gossipsub',
      multicodecs,
      peerId,
      registrar,
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
     * @type {Map<Peer, Array<RPC.ControlIHave object>> }
     */
    this.gossip = new Map()

    /**
     * Map of control messages
     *
     * @type {Map<Peer, RPC.ControlMessage object>}
     */
    this.control = new Map()

    /**
     * Use the overriden mesgIdFn or the default one.
     */
    this._msgIdFn = options.msgIdFn || this.defaultMsgIdFn

    /**
     * A message cache that contains the messages for last few hearbeat ticks
     *
     */
    this.messageCache = options.messageCache || new MessageCache(constants.GossipSubHistoryGossip, constants.GossipSubHistoryLength, this._msgIdFn)

    /**
     * A heartbeat timer that maintains the mesh
     */
    this.heartbeat = new Heartbeat(this)
  }

  /**
   * Removes a peer from the router
   * @override
   * @param {Peer} peer
   * @returns {Peer}
   */
  _removePeer (peer) {
    super._removePeer(peer)

    // Remove this peer from the mesh
    // eslint-disable-next-line no-unused-vars
    for (const [_, peers] of this.mesh.entries()) {
      peers.delete(peer)
    }

    // Remove this peer from the fanout
    // eslint-disable-next-line no-unused-vars
    for (const [_, peers] of this.fanout.entries()) {
      peers.delete(peer)
    }

    // Remove from gossip mapping
    this.gossip.delete(peer)
    // Remove from control mapping
    this.control.delete(peer)

    return peer
  }

  /**
   * Handles an rpc request from a peer
   *
   * @override
   * @param {String} idB58Str
   * @param {Peer} peer
   * @param {RPC} rpc
   * @returns {void}
   */
  _processRpc (idB58Str, peer, rpc) {
    super._processRpc(idB58Str, peer, rpc)
    this._processRpcControlMessage(peer, rpc.control)
  }

  /**
   * Handles an rpc control message from a peer
   * @param {Peer} peer
   * @param {RPC.ControlMessage} controlMsg
   * @returns {void}
   */
  _processRpcControlMessage (peer, controlMsg) {
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

    const outRpc = createGossipRpc([], { ihave, iwant, prune })
    this._sendRpc(peer, outRpc)
  }

  /**
   * Process incoming message,
   * emitting locally and forwarding on to relevant floodsub and gossipsub peers
   * @override
   * @param {Peer} peer
   * @param {RPC.Message} msg
   */
  _processRpcMessage (peer, msg) {
    const msgID = this.getMsgId(msg)

    // Ignore if we've already seen the message
    if (this.seenCache.has(msgID)) {
      return
    }
    this.seenCache.put(msgID)

    super._processRpcMessage(peer, msg)
    const topics = msg.topicIDs

    // If options.gossipIncoming is false, do NOT emit incoming messages to peers
    if (!this._options.gossipIncoming) {
      return
    }

    // Emit to floodsub peers
    this.peers.forEach((peer) => {
      if (peer.protocols.includes(constants.FloodSubID) &&
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
      if (!this.mesh.has(topic)) {
        return
      }
      this.mesh.get(topic).forEach((peer) => {
        if (!peer.isWritable || peer.id.toB58String() === msg.from) {
          return
        }
        peer.sendMessages(utils.normalizeOutRpcMessages([msg]))
        this.log('publish msg on topic - meshsub', topic, peer.id.toB58String())
      })
    })
  }

  /**
   * Handles IHAVE messages
   * @param {Peer} peer
   * @param {Array<RPC.ControlIHave>} ihave
   * @returns {RPC.ControlIWant}
   */
  _handleIHave (peer, ihave) {
    const iwant = new Set()

    ihave.forEach(({ topicID, messageIDs }) => {
      if (!this.mesh.has(topicID)) {
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
   * @param {Array<RPC.ControlIWant>} iwant
   * @returns {Array<RPC.Message>}
   */
  _handleIWant (peer, iwant) {
    // @type {Map<string, RPC.Message>}
    const ihave = new Map()

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
   * @param {Array<RPC.ControlGraft>} graft
   * @return {Array<RPC.ControlPrune>}
   */
  _handleGraft (peer, graft) {
    const prune = []

    graft.forEach(({ topicID }) => {
      const peers = this.mesh.get(topicID)
      if (!peers) {
        prune.push(topicID)
      } else {
        this.log('GRAFT: Add mesh link from %s in %s', peer.id.toB58String(), topicID)
        peers.add(peer)
        peer.topics.add(topicID)
        this.mesh.set(topicID, peers)
      }
    })

    if (!prune.length) {
      return
    }

    const buildCtrlPruneMsg = (topic) => {
      return {
        topicID: topic
      }
    }

    return prune.map(buildCtrlPruneMsg)
  }

  /**
   * Handles Prune messages
   * @param {Peer} peer
   * @param {Array<RPC.ControlPrune>} prune
   * @returns {void}
   */
  _handlePrune (peer, prune) {
    prune.forEach(({ topicID }) => {
      const peers = this.mesh.get(topicID)
      if (peers) {
        this.log('PRUNE: Remove mesh link to %s in %s', peer.id.toB58String(), topicID)
        peers.delete(peer)
        peer.topics.delete(topicID)
      }
    })
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   * @override
   * @returns {Promise}
   */
  async start () {
    await super.start()
    this.heartbeat.start()
  }

  /**
   * Unmounts the gossipsub protocol and shuts down every connection
   * @override
   * @returns {Promise}
   */
  async stop () {
    await super.stop()
    this.heartbeat.stop()

    this.mesh = new Map()
    this.fanout = new Map()
    this.lastpub = new Map()
    this.gossip = new Map()
    this.control = new Map()
  }

  /**
   * Subscribes to topics
   *
   * @override
   * @param {Array<string>} topics
   * @returns {void}
   */
  _subscribe (topics) {
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
  _unsubscribe (topics) {
    super._unsubscribe(topics)
    this.leave(topics)
  }

  /**
   * Join topics
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  join (topics) {
    if (!this.started) {
      throw new Error('GossipSub has not started')
    }
    topics = utils.ensureArray(topics)

    this.log('JOIN %s', topics)

    topics.forEach((topic) => {
      // Send GRAFT to mesh peers
      const fanoutPeers = this.fanout.get(topic)
      if (fanoutPeers) {
        this.mesh.set(topic, fanoutPeers)
        this.fanout.delete(topic)
        this.lastpub.delete(topic)
      } else {
        const peers = getGossipPeers(this, topic, constants.GossipSubD)
        this.mesh.set(topic, peers)
      }
      this.mesh.get(topic).forEach((peer) => {
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
  leave (topics) {
    topics = utils.ensureArray(topics)

    this.log('LEAVE %s', topics)

    topics.forEach((topic) => {
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
   * @param {RPC.Message} msg the message object
   * @returns {string} message id as string
   */
  getMsgId (msg) {
    return this._msgIdFn(msg)
  }

  /**
   * Publish messages
   *
   * Note: this function assumes all messages are well-formed RPC objects
   * @override
   * @param {Array<RPC>} rpcs
   * @returns {void}
   */
  _publish (rpcs) {
    rpcs.forEach((msgObj) => {
      const msgID = this.getMsgId(msgObj)
      // put in seen cache
      this.seenCache.put(msgID)

      this.messageCache.put(msgObj)
      // @type Set<string>
      const tosend = new Set()
      msgObj.topicIDs.forEach((topic) => {
        const peersInTopic = this.topics.get(topic)
        if (!peersInTopic) {
          return
        }

        // floodsub peers
        peersInTopic.forEach((peer) => {
          if (peer.protocols.includes(constants.FloodSubID)) {
            tosend.add(peer)
          }
        })

        // Gossipsub peers handling
        let meshPeers = this.mesh.get(topic)
        if (!meshPeers) {
          // We are not in the mesh for topic, use fanout peers
          meshPeers = this.fanout.get(topic)
          if (!meshPeers) {
            // If we are not in the fanout, then pick any peers in topic
            const peers = getGossipPeers(this, topic, constants.GossipSubD)

            if (peers.size > 0) {
              meshPeers = peers
              this.fanout.set(topic, peers)
            } else {
              meshPeers = []
            }
          }
          // Store the latest publishing time
          this.lastpub.set(topic, this._now())
        }

        meshPeers.forEach((peer) => {
          tosend.add(peer)
        })
      })
      // Publish messages to peers
      tosend.forEach((peer) => {
        if (peer.id.toB58String() === msgObj.from) {
          return
        }
        this._sendRpc(peer, { msgs: [msgObj] })
      })
    })
  }

  /**
   * Sends a GRAFT message to a peer
   * @param {Peer} peer
   * @param {String} topic
   * @returns {void}
   */
  _sendGraft (peer, topic) {
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
  _sendPrune (peer, topic) {
    const prune = [{
      topicID: topic
    }]

    const out = createGossipRpc([], { prune })
    this._sendRpc(peer, out)
  }

  _sendRpc (peer, outRpc) {
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

    peer.write(RPC.encode(outRpc))
  }

  _piggybackControl (peer, outRpc, ctrl) {
    const tograft = (ctrl.graft || [])
      .filter(({ topicID }) => (this.mesh.get(topicID) || new Set()).has(peer))
    const toprune = (ctrl.prune || [])
      .filter(({ topicID }) => !(this.mesh.get(topicID) || new Set()).has(peer))

    if (!tograft.length && !toprune.length) {
      return
    }

    outRpc.control = outRpc.control || {}
    outRpc.control.graft = (outRpc.control.graft || []).concat(tograft)
    outRpc.control.prune = (outRpc.control.prune || []).concat(toprune)
  }

  _piggybackGossip (peer, outRpc, ihave) {
    outRpc.control = outRpc.control || {}
    outRpc.control.ihave = ihave
  }

  /**
   * Send graft and prune messages
   * @param {Map<Peer, Array<String>>} tograft
   * @param {Map<Peer, Array<String>>} toprune
   */
  _sendGraftPrune (tograft, toprune) {
    for (const [p, topics] of tograft) {
      const graft = topics.map((topicID) => ({ topicID }))
      let prune = null
      // If a peer also has prunes, process them now
      const pruneMsg = toprune.get(p)
      if (pruneMsg) {
        prune = pruneMsg.map((topicID) => ({ topicID }))
        toprune.delete(p)
      }

      const outRpc = createGossipRpc([], { graft, prune })
      this._sendRpc(p, outRpc)
    }
    for (const [p, topics] of toprune) {
      const prune = topics.map((topicID) => ({ topicID }))
      const outRpc = createGossipRpc([], { prune })
      this._sendRpc(p, outRpc)
    }
  }

  /**
   * Emits gossip to peers in a particular topic
   * @param {String} topic
   * @param {Set<Peer>} peers - peers to exclude
   * @returns {void}
   */
  _emitGossip (topic, peers) {
    const messageIDs = this.messageCache.getGossipIDs(topic)
    if (!messageIDs.length) {
      return
    }

    const gossipSubPeers = getGossipPeers(this, topic, constants.GossipSubD)
    gossipSubPeers.forEach((peer) => {
      // skip mesh peers
      if (!peers.has(peer)) {
        this._pushGossip(peer, {
          topicID: topic,
          messageIDs: messageIDs
        })
      }
    })
  }

  /**
   * Flush gossip and control messages
   */
  _flush () {
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
   * @param {Array<RPC.ControlIHave>} controlIHaveMsgs
   * @returns {void}
   */
  _pushGossip (peer, controlIHaveMsgs) {
    this.log('Add gossip to %s', peer.id.toB58String())
    const gossip = this.gossip.get(peer) || []
    this.gossip.set(peer, gossip.concat(controlIHaveMsgs))
  }

  /**
   * Returns the current time in milliseconds
   * @returns {number}
   */
  _now () {
    return Date.now()
  }
}

module.exports = GossipSub
module.exports.multicodec = constants.GossipSubID

/* eslint-disable no-unused-vars */
/* eslint-disable no-warning-comments */
/* eslint-disable valid-jsdoc */

'use strict'

const Pubsub = require('libp2p-pubsub')
const pull = require('pull-stream')
const lp = require('pull-length-prefixed')
const nextTick = require('async/nextTick')
const { utils } = require('libp2p-pubsub')

const { MessageCache } = require('./messageCache')
const assert = require('assert')

const { rpc } = require('./message')
const constants = require('./constants')
const errcode = require('err-code')

class GossipSub extends Pubsub {
  /**
   * @param {Object} libp2p
   * @constructor
   */
  constructor (libp2p) {
    super('libp2p:gossipsub', constants.GossipSubID, libp2p)

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
     * @type {Map<Peer, Array<rpc.RPC.ControlIHave object>> }
     */
    this.gossip = new Map()

    /**
     * Map of control messages
     *
     * @type {Map<Peer, rpc.RPC.ControlMessage object>}
     */
    this.control = new Map()

    /**
     * A message cache that contains the messages for last few hearbeat ticks
     *
     */
    this.messageCache = new MessageCache(constants.GossipSubHistoryGossip, constants.GossipSubHistoryLength)

    /**
     * A set of subscriptions
     */
    this.subscriptions = new Set()
  }

  /**
   * Removes a peer from the router
   *
   * @override
   * @param {Peer} peer
   * @returns {PeerInfo}
   */
  _removePeer (peer) {
    super._removePeer(peer)
    // Only delete when no one else if referencing this peer.
    if (peer._references === 0) {
      // Remove this peer from the mesh
      for (const [topic, peers] of this.mesh.entries()) {
        peers.delete(peer)
      }
      // Remove this peer from the fanout
      for (const [topic, peers] of this.fanout.entries()) {
        peers.delete(peer)
      }

      // Remove from gossip mapping
      this.gossip.delete(peer)
      // Remove from control mapping
      this.control.delete(peer)
    }
    return peer
  }

  /**
   * When a peer has dialed into another peer, it sends its subscriptions to it.
   * @override
   * @param {PeerInfo} peerInfo
   * @param {Connection} conn
   * @param {Function} callback
   *
   * @returns {void}
   *
   */
  _onDial (peerInfo, conn, callback) {
    super._onDial(peerInfo, conn, (err) => {
      if (err) return callback(err)
      const idB58Str = peerInfo.id.toB58String()
      const peer = this.peers.get(idB58Str)
      if (peer && peer.isWritable) {
        // Immediately send my own subscription to the newly established conn
        peer.sendSubscriptions(this.subscriptions)
      }
      nextTick(() => callback())
    })
  }

  /**
   * Processes a peer's connection to another peer.
   *
   * @param {String} idB58Str
   * @param {Connection} conn
   * @param {Peer} peer
   *
   * @returns {void}
   *
   */
  _processConnection (idB58Str, conn, peer) {
    pull(
      conn,
      lp.decode(),
      pull.map((data) => rpc.RPC.decode(data)),
      pull.drain(
        (rpc) => this._onRpc(idB58Str, rpc),
        (err) => this._onConnectionEnd(idB58Str, peer, err)
      )
    )
  }

  /**
   * Handles an rpc request from a peer
   *
   * @param {String} idB58Str
   * @param {Object} rpc
   * @returns {void}
   */
  _onRpc (idB58Str, rpc) {
    if (!rpc) {
      return
    }

    const peer = this.peers.get(idB58Str)
    if (!peer) {
      return
    }

    this.log('rpc from', idB58Str)
    const controlMsg = rpc.control
    const subs = rpc.subscriptions
    const msgs = rpc.msgs

    if (subs.length) {
      // update peer subscriptions
      peer.updateSubscriptions(subs)
      subs.forEach((subOptMsg) => {
        const t = subOptMsg.topicID

        if (!this.topics.has(t)) {
          this.topics.set(t, new Set())
        }

        const topicSet = this.topics.get(t)
        if (subOptMsg.subscribe) {
          // subscribe peer to new topic
          topicSet.add(peer)
        } else {
          // unsubscribe from existing topic
          topicSet.delete(peer)
        }
      })
      this.emit('meshsub:subscription-change', peer.info, peer.topics, subs)
    }

    if (msgs.length) {
      this._processRpcMessages(utils.normalizeInRpcMessages(msgs))
    }

    if (!controlMsg) {
      return
    }

    const iWant = this._handleIHave(peer, controlMsg.ihave)
    const iHave = this._handleIWant(peer, controlMsg.iwant)
    const prune = this._handleGraft(peer, controlMsg.graft)
    this._handlePrune(peer, controlMsg.prune)

    if (!iWant || !iHave || !prune) {
      return
    }

    const outRpc = this._rpcWithControl(null, iHave, iWant, null, prune)
    this._sendRpc(rpc.from, outRpc)
  }

  /**
   * Process incoming messages,
   * emitting locally and forwarding on to relevant floodsub and gossipsub peers
   */
  _processRpcMessages (msgs) {
    msgs.forEach((msg) => {
      const seqno = utils.msgId(msg.from, msg.seqno)
      // Have we seen this message before> if so, ignore
      if (this.seenCache.has(seqno)) {
        return
      }

      this.seenCache.put(seqno)

      const topics = msg.topicIDs

      // Emit to self
      this._emitMessages(topics, [msg])

      // Emit to floodsub peers
      this.peers.forEach((peer) => {
        if (peer.info.protocols.has(constants.FloodSubID) &&
          peer.info.id.toB58String() !== msg.from &&
          utils.anyMatch(peer.topics, topics) &&
          peer.isWritable
        ) {
          peer.sendMessages(utils.normalizeOutRpcMessages([msg]))
          this.log('publish msg on topics - floodsub', topics, peer.info.id.toB58String())
        }
      })

      // Emit to peers in the mesh
      topics.forEach((topic) => {
        if (!this.mesh.has(topic)) {
          return
        }
        this.mesh.get(topic).forEach((peer) => {
          if (!peer.isWritable || peer.info.id.toB58String() === msg.from) {
            return
          }
          peer.sendMessages(utils.normalizeOutRpcMessages([msg]))
          this.log('publish msg on topic - meshsub', topic, peer.info.id.toB58String())
        })
      })
    })
  }

  _emitMessages (topics, messages) {
    topics.forEach((topic) => {
      if (this.subscriptions.has(topic)) {
        messages.forEach((message) => {
          this.emit(topic, message)
        })
      }
    })
  }

  /**
   * Returns a buffer of a RPC message that contains a control message
   *
   * @param {Array<rpc.RPC.Message>} msgs
   * @param {Array<rpc.RPC.ControlIHave>} ihave
   * @param {Array<rpc.RPC.ControlIWant>} iwant
   * @param {Array<rpc.RPC.ControlGraft>} graft
   * @param {Array<rpc.RPC.Prune>} prune
   *
   * @returns {rpc.RPC}
   *
   */
  _rpcWithControl (msgs, ihave, iwant, graft, prune) {
    return {
      subscriptions: [],
      msgs: msgs || [],
      control: {
        ihave: ihave || [],
        iwant: iwant || [],
        graft: graft || [],
        prune: prune || []
      }
    }
  }

  /**
   * Handles IHAVE messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.ControlIHave Object} ihave
   *
   * @returns {rpc.RPC.ControlIWant Object}
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

    this.log('IHAVE: Asking for %d messages from %s', iwant.size, peer.info.id.toB58String())

    return {
      messageIDs: Array.from(iwant)
    }
  }

  /**
   * Handles IWANT messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.ControlIWant} iwant
   *
   * @returns {Array<rpc.RPC.Message>}
   */
  _handleIWant (peer, iwant) {
    // @type {Map<string, rpc.RPC.Message>}
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

    this.log('IWANT: Sending %d messages to %s', ihave.size, peer.info.id.toB58String())

    return Array.from(ihave.values())
  }

  /**
   * Handles Graft messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.ControlGraft} graft
   *
   * @return {Array<rpc.RPC.ControlPrune>}
   *
   */
  _handleGraft (peer, graft) {
    const prune = []

    graft.forEach(({ topicID }) => {
      const peers = this.mesh.get(topicID)
      if (!peers) {
        prune.push(topicID)
      } else {
        this.log('GRAFT: Add mesh link from %s in %s', peer.info.id.toB58String(), topicID)
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
   *
   * @param {Peer} peer
   * @param {rpc.RPC.ControlPrune} prune
   *
   * @returns {void}
   *
   */
  _handlePrune (peer, prune) {
    prune.forEach(({ topicID }) => {
      const peers = this.mesh.get(topicID)
      if (peers) {
        this.log('PRUNE: Remove mesh link to %s in %s', peer.info.id.toB58String(), topicID)
        peers.delete(peer)
        peer.topics.delete(topicID)
      }
    })
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node and sends our
   * our subscriptions to every peer connected
   *
   * @override
   * @param {Function} callback
   * @returns {void}
   *
   */
  start (callback) {
    super.start((err) => {
      if (err) {
        return callback(err)
      }
      if (this._heartbeatTimer) {
        const errMsg = 'Heartbeat timer is already running'

        this.log(errMsg)
        throw errcode(new Error(errMsg), 'ERR_HEARTBEAT_ALREADY_RUNNING')
      }

      const heartbeatTimer = {
        _onCancel: null,
        _timeoutId: null,
        runPeriodically: (fn, period) => {
          heartbeatTimer._timeoutId = setInterval(fn, period)
        },
        cancel: (cb) => {
          clearTimeout(heartbeatTimer._timeoutId)
          cb()
        }
      }

      const heartbeat = this._heartbeat.bind(this)
      setTimeout(() => {
        heartbeat()
        heartbeatTimer.runPeriodically(heartbeat, constants.GossipSubHeartbeatInterval)
      }, constants.GossipSubHeartbeatInitialDelay)

      this._heartbeatTimer = heartbeatTimer
      callback()
    })
  }

  /**
   * Unmounts the gossipsub protocol and shuts down every connection
   *
   * @override
   * @param {Function} callback
   * @returns {void}
   */
  stop (callback) {
    if (!this._heartbeatTimer) {
      const errMsg = 'Heartbeat timer is not running'
      this.log(errMsg)

      throw errcode(new Error(errMsg), 'ERR_HEARTBEATIMER_NO_RUNNING')
    }
    super.stop((err) => {
      if (err) return callback(err)
      this.mesh = new Map()
      this.fanout = new Map()
      this.lastpub = new Map()
      this.gossip = new Map()
      this.control = new Map()
      this.subscriptions = new Set()
      this._heartbeatTimer.cancel(() => {
        this._heartbeatTimer = null
        callback()
      })
    })
  }

  /**
   * Subscribes to topics
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  subscribe (topics) {
    assert(this.started, 'GossipSub has not started')

    topics = utils.ensureArray(topics)

    const newTopics = topics.filter((topic) => !this.subscriptions.has(topic))
    if (newTopics.length === 0) {
      return
    }

    this.log('JOIN %s', newTopics)

    // Broadcast SUBSCRIBE to all peers
    this.peers.forEach((peer) => {
      peer.sendSubscriptions(newTopics)
    })

    newTopics.forEach((topic) => {
      // set subscription
      this.subscriptions.add(topic)

      // Send GRAFT to mesh peers
      const fanoutPeers = this.fanout.get(topic)
      if (fanoutPeers) {
        this.mesh.set(topic, fanoutPeers)
        this.fanout.delete(topic)
        this.lastpub.delete(topic)
      } else {
        const peers = this._getPeers(topic, constants.GossipSubD)
        this.mesh.set(topic, peers)
      }
      this.mesh.get(topic).forEach((peer) => {
        this.log('JOIN: Add mesh link to %s in %s', peer.info.id.toB58String(), topic)
        this._sendGraft(peer, topic)
      })
    })
  }

  /**
   * Leaves a topic
   *
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  unsubscribe (topics) {
    topics = utils.ensureArray(topics)

    const unTopics = topics.filter((topic) => this.subscriptions.has(topic))
    if (!unTopics.length) {
      return
    }
    this.log('LEAVE %s', topics)

    // Broadcast UNSUBSCRIBE to all peers
    this.peers.forEach((peer) => {
      peer.sendUnsubscriptions(topics)
    })

    unTopics.forEach((topic) => {
      // delete subscription
      this.subscriptions.delete(topic)

      // Send PRUNE to mesh peers
      const meshPeers = this.mesh.get(topic)
      if (meshPeers) {
        meshPeers.forEach((peer) => {
          this.log('LEAVE: Remove mesh link to %s in %s', peer.info.id.toB58String(), topic)
          this._sendPrune(peer, topic)
        })
        this.mesh.delete(topic)
      }
    })
  }

  /**
   * Publishes messages to all subscribed peers
   *
   * @param {Array<string>|string} topics
   * @param {Array<any>|any} messages
   * @returns {void}
   */
  publish (topics, messages) {
    assert(this.started, 'GossipSub has not started')
    this.log('publish', topics, messages)

    topics = utils.ensureArray(topics)
    messages = utils.ensureArray(messages)

    const from = this.libp2p.peerInfo.id.toB58String()

    const buildMessage = (msg) => {
      const seqno = utils.randomSeqno()
      const msgObj = {
        from: from,
        data: msg,
        seqno: seqno,
        topicIDs: topics
      }
      this.messageCache.put(msgObj)
      this.seenCache.put(msgObj.seqno)
      return msgObj
    }

    const msgObjs = utils.normalizeOutRpcMessages(messages.map(buildMessage))

    msgObjs.forEach((msgObj) => {
      // @type Set<string>
      const tosend = new Set()
      msgObj.topicIDs.forEach((topic) => {
        const peersInTopic = this.topics.get(topic)
        if (!peersInTopic) {
          return
        }

        // floodsub peers
        peersInTopic.forEach((peer) => {
          if (peer.info.protocols.has(constants.FloodSubID)) {
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
            const peers = this._getPeers(topic, constants.GossipSubD)

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
        if (peer.info.id.toB58String() === msgObj.from) {
          return
        }
        this._sendRpc(peer, { msgs: [msgObj] })
      })
    })
  }

  /**
   * Sends a GRAFT message to a peer
   *
   * @param {Peer} peer
   * @param {String} topic
   * @returns {void}
   */
  _sendGraft (peer, topic) {
    const graft = [{
      topicID: topic
    }]

    const out = this._rpcWithControl(null, null, null, graft, null)
    this._sendRpc(peer, out)
  }

  /**
   * Sends a PRUNE message to a peer
   *
   * @param {Peer} peer
   * @param {String} topic
   * @returns {void}
   */
  _sendPrune (peer, topic) {
    const prune = [{
      topicID: topic
    }]

    const out = this._rpcWithControl(null, null, null, null, prune)
    this._sendRpc(peer, out)
  }

  _sendRpc (peer, outRpc) {
    if (!peer || !peer.isWritable) {
      return
    }

    // piggyback control message retries
    const ctrl = this.control.get(peer)
    if (ctrl) {
      this.piggybackControl(peer, outRpc, ctrl)
      this.control.delete(peer)
    }

    // piggyback gossip
    const ihave = this.gossip.get(peer)
    if (ihave) {
      this.piggybackGossip(peer, outRpc, ihave)
      this.gossip.delete(peer)
    }

    peer.write(rpc.RPC.encode(outRpc))
  }

  _piggybackControl (peer, outRpc, ctrl) {
    const hasPeerInTopic = (topicID) => {
      const meshPeers = this.mesh.get(topicID)
      return meshPeers && meshPeers.has(peer)
    }
    const tograft = (ctrl.graft || []).filter(({ topicID }) => hasPeerInTopic(topicID))
    const toprune = (ctrl.prune || []).filter(({ topicID }) => hasPeerInTopic(topicID))

    if (!tograft.length && !toprune.length) {
      return
    }

    outRpc.control.graft = outRpc.control.graft.concat(tograft)
    outRpc.control.prune = outRpc.control.graft.concat(toprune)
  }

  _piggybackGossip (peer, outRpc, ihave) {
    outRpc.control.ihave = ihave
  }

  /**
   * Maintains the mesh and fanout maps in gossipsub.
   *
   * @returns {void}
   */
  _heartbeat () {
    /**
     * @type {Map<Peer, Array<String>>}
     */
    const tograft = new Map()
    const toprune = new Map()

    // maintain the mesh for topics we have joined
    this.mesh.forEach((peers, topic) => {
      // do we have enough peers?
      if (peers.size < constants.GossipSubDlo) {
        const ineed = constants.GossipSubD - peers.size
        const peersSet = this._getPeers(topic, ineed)
        peersSet.forEach((peer) => {
          // add topic peers not already in mesh
          if (peers.has(peer)) {
            return
          }

          this.log('HEARTBEAT: Add mesh link to %s in %s', peer.info.id.toB58String(), topic)
          peers.add(peer)
          peer.topics.add(topic)
          if (!tograft.has(peer)) {
            tograft.set(peer, [])
          }
          tograft.get(peer).push(topic)
        })
      }

      // do we have to many peers?
      if (peers.size > constants.GossipSubDhi) {
        const idontneed = peers.size - constants.GossipSubD
        let peersArray = new Array(peers)
        peersArray = this._shufflePeers(peersArray)

        const tmp = peersArray.slice(0, idontneed)
        tmp.forEach((peer) => {
          this.log('HEARTBEAT: Remove mesh link to %s in %s', peer.info.id.toB58String(), topic)
          peers.delete(peer)
          peer.topics.remove(topic)
          if (!toprune.has(peer)) {
            toprune.set(peer, [])
          }
          toprune.get(peer).push(topic)
        })
      }

      this._emitGossip(topic, peers)
    })

    // expire fanout for topics we haven't published to in a while
    const now = this._now()
    this.lastpub.forEach((topic, lastpb) => {
      if ((lastpb + constants.GossipSubFanoutTTL) < now) {
        this.fanout.delete(topic)
        this.lastpub.delete(topic)
      }
    })

    // maintain our fanout for topics we are publishing but we have not joined
    this.fanout.forEach((topic, peers) => {
      // checks whether our peers are still in the topic
      peers.forEach((peer) => {
        if (this.topics.has(peer)) {
          peers.delete(peer)
        }
      })

      // do we need more peers?
      if (peers.size < constants.GossipSubD) {
        const ineed = constants.GossipSubD - peers.size
        const peersSet = this._getPeers(topic, ineed)
        peersSet.forEach((peer) => {
          if (!peers.has(peer)) {
            return
          }

          peers.add(peer)
        })
      }

      this._emitGossip(topic, peers)
    })
    // send coalesced GRAFT/PRUNE messages (will piggyback gossip)
    this._sendGraftPrune(tograft, toprune)

    // advance the message history window
    this.messageCache.shift()

    this.emit('gossipsub:heartbeat')
  }

  /**
   * Send graft and prune messages
   *
   * @param {Map<Peer, Array<String>>} tograft
   * @param {Map<Peer, Array<String>>} toprune
   */
  _sendGraftPrune (tograft, toprune) {
    for (const [p, topics] of tograft) {
      const graft = topics.map((topicID) => ({ topicID }))
      let prune = null
      if (toprune.has(p)) {
        prune = toprune.get(p).map((topicID) => ({ topicID }))
        toprune.delete(p)
      }

      const outRpc = this._rpcWithControl(null, null, null, graft, prune)
      this._sendRpc(p, outRpc)
    }
    for (const [p, topics] of toprune) {
      const prune = topics.map((topicID) => ({ topicID }))
      const outRpc = this._rpcWithControl(null, null, null, null, prune)
      this._sendRpc(p, outRpc)
    }
  }

  /**
   * Emits gossip to peers in a particular topic
   *
   * @param {String} topic
   * @param {Set<Peer>} peers
   * @returns {void}
   */
  _emitGossip (topic, peers) {
    const messageIDs = this.messageCache.getGossipIDs(topic)
    if (!messageIDs.length) {
      return
    }

    const gossipSubPeers = this._getPeers(topic, constants.GossipSubD)
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
   * Adds new IHAVE messages to pending gossip
   *
   * @param {Peer} peer
   * @param {Array<rpc.RPC.ControlIHave>} controlIHaveMsgs
   * @returns {void}
   */
  _pushGossip (peer, controlIHaveMsgs) {
    let gossip = this.gossip.get(peer)
    gossip = gossip.concat(controlIHaveMsgs)
    this.gossip.set(peer, gossip)
  }

  /**
   * Given a topic, returns up to count peers subscribed to that topic
   *
   * @param {String} topic
   * @param {Number} count
   * @returns {Set<Peer>}
   *
   */
  _getPeers (topic, count) {
    const peersInTopic = this.topics.get(topic)
    if (!peersInTopic) {
      return new Set()
    }

    // Adds all peers using GossipSub protocol
    let peers = []
    peersInTopic.forEach((peer) => {
      if (peer.info.protocols.has(constants.GossipSubID)) {
        peers.push(peer)
      }
    })

    // Pseudo-randomly shuffles peers
    peers = this._shufflePeers(peers)
    if (count > 0 && peers.length > count) {
      peers = peers.slice(0, count)
    }

    peers = new Set(peers)
    return peers
  }

  /**
   * Pseudo-randomly shuffles peers
   *
   * @param {Array<Peers>} peers
   * @returns {Array<Peers>}
   */
  _shufflePeers (peers) {
    if (peers.length <= 1) {
      return peers
    }

    for (let i = 0; i < peers.length; i++) {
      const randInt = () => {
        return Math.floor(Math.random() * Math.floor(peers.length))
      }

      const j = randInt()
      const tmp = peers[i]
      peers[i] = peers[j]
      peers[j] = tmp

      return peers
    }
  }

  /**
   * Returns the current time in milliseconds
   *
   * @returns {number}
   */
  _now () {
    return Date.now()
  }
}

module.exports = GossipSub

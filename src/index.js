/* eslint-disable no-unused-vars */
/* eslint-disable no-warning-comments */
/* eslint-disable valid-jsdoc */

'use strict'

const Pubsub = require('libp2p-pubsub')
const pull = require('pull-stream')
const lp = require('pull-length-prefixed')
const nextTick = require('async/nextTick')

const MessageCache = require('./messageCache').MessageCache
const utils = require('./utils')
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
   * @returns {void}
   */
  _removePeer (peer) {
    const id = peer.info.id.toB58String()

    this.log('remove', id, peer._references)
    // Only delete when no one else if referencing this peer.
    if (--peer._references === 0) {
      this.log('delete peer', id)
      this.peers.delete(id)

      // Remove this peer from the mesh
      for (let [topic, peers] of this.mesh.entries()) {
        peers.delete(peer)
        this.mesh.set(topic, peers)
      }
      // Remove this peer from the fanout
      for (let [topic, peers] of this.fanout.entries()) {
        peers.delete(peer)
        this.fanout.set(topic, peers)
      }

      // Remove from gossip mapping
      this.gossip.delete(peer)
      // Remove from control mapping
      this.control.delete(peer)
    }
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

    let peer = this.peers.get(idB58Str)
    if (!peer) {
      return
    }

    this.log('rpc from', idB58Str)
    const controlMsg = rpc.control
    const subs = rpc.subscriptions
    const msgs = rpc.msgs

    if (subs && subs.length) {
      subs.forEach((subOptMsg) => {
        let t = subOptMsg.topicCID

        let topicSet = this.topics.get(t)
        if (subOptMsg.subscribe) {
          if (!topicSet) {
            /**
             * @type Set<Peer>
             */
            topicSet = new Set()
            topicSet.add(peer)
            this.topics.set(t, topicSet)
          }
        } else {
          if (!topicSet) {
            return
          }
          topicSet.delete(peer)
          this.topics.set(t, topicSet)
        }

        let gossipSubPeers = this.fanout.get(t)
        if (gossipSubPeers) {
          this.mesh.set(t, gossipSubPeers)
          this.fanout.delete(t)
          this.lastpub.delete(t)
        } else {
          gossipSubPeers = this._getPeers(t, constants.GossipSubD)
          this.mesh.set(t, gossipSubPeers)
        }
        gossipSubPeers.forEach((peer) => {
          if (peer && peer.isWritable) {
            this.log('JOIN: Add mesh link to %s in %s', peer.info.id.toB58String(), t)
            peer.updateSubscriptions(subs)
            this._sendGraft(peer, t)
          }
        })
      })

      this.emit('meshsub:subscription-change', peer.info, peer.topics, subs)
    }

    if (msgs && msgs.length) {
      this._processRpcMessages(utils.normalizeInRpcMessages(msgs))
    }

    if (!controlMsg) {
      return
    }

    let iWant = this._handleIHave(peer, controlMsg)
    let iHave = this._handleIWant(peer, controlMsg)
    let prune = this._handleGraft(peer, controlMsg)
    this._handlePrune(peer, controlMsg)

    if (!iWant || !iHave || !prune) {
      return
    }

    let outRpc = this._rpcWithControl(null, iHave, iWant, null, prune)
    this._sendRpc(rpc.from, outRpc)
  }

  _processRpcMessages (msgs) {
    msgs.forEach((msg) => {
      const seqno = utils.msgId(msg.from, msg.seqno)
      // Have we seen this message before> if so, ignore
      if (this.seenCache.has(seqno)) {
        return
      }

      this.seenCache.put(seqno)

      // Emit to floodsub peers
      // Need to figure this out

      // Emit to peers in the mesh
      let topics = msg.topicIDs
      topics.forEach((topic) => {
        let meshPeers = this.mesh.get(topic)
        meshPeers.forEach((peer) => {
          if (!peer.isWritable || !utils.anyMatch(peer.topics, topics)) {
            return
          }

          peer.sendMessages(utils.normalizeOutRpcMessages([msg]))

          this.log('publish msgs on topics', topic, peer.info.id.toB58String())
        })
      })
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
      msgs: msgs,
      control: {
        ihave: ihave,
        iwant: iwant,
        graft: graft,
        prune: prune
      }
    }
  }

  /**
   * Handles IHAVE messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.controlMessage Object} controlRpc
   *
   * @returns {rpc.RPC.ControlIWant Object}
   */
  _handleIHave (peer, controlRpc) {
    let iwant = new Set()

    let ihaveMsgs = controlRpc.ihave
    if (!ihaveMsgs) {
      return
    }

    ihaveMsgs.forEach((msg) => {
      let topic = msg.topicID

      if (!this.mesh.has(topic)) {
        return
      }

      let msgIDs = ihaveMsgs.messageIDs
      msgIDs.forEach((msgID) => {
        if (this.seenCache.has(msgID)) {
          return
        }
        iwant.add(msgID)
      })
    })

    if (!iwant.length) {
      return
    }

    this.log('IHAVE: Asking for %d messages from %s', iwant.length, peer.info.id.toB58String())
    let iwantlst = []
    iwant.forEach((msgID) => {
      iwantlst.push(msgID)
    })

    return {
      messageIDs: iwantlst
    }
  }

  /**
   * Handles IWANT messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.control} controlRpc
   *
   * @returns {Array<rpc.RPC.Message>}
   */
  _handleIWant (peer, controlRpc) {
    // @type {Map<string, rpc.RPC.Message>}
    let ihave = new Map()

    let iwantMsgs = controlRpc.iwant
    if (!iwantMsgs) {
      return
    }

    iwantMsgs.forEach((iwantMsg) => {
      let iwantMsgIDs = iwantMsg.MessageIDs
      if (!(iwantMsgIDs || iwantMsgIDs.length)) {
        return
      }

      iwantMsgIDs.forEach((msgID) => {
        let msg = this.messageCache.get(msgID)
        if (msg) {
          ihave.set(msgID, msg)
        }
      })
    })

    if (!ihave.length) {
      return
    }

    this.log('IWANT: Sending %d messages to %s', ihave.length, peer.info.id.toB58String())
    let msgs = []
    for (let msg of ihave.values()) {
      msgs.push(msg)
    }

    return msgs
  }

  /**
   * Handles Graft messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.control} controlRpc
   *
   * @return {Array<rpc.RPC.ControlPrune>}
   *
   */
  _handleGraft (peer, controlRpc) {
    let prune = []

    let grafts = controlRpc.graft
    if (!(grafts || grafts.length)) {
      return
    }
    grafts.forEach((graft) => {
      let topic = graft.topicID
      let peers = this.mesh.get(topic)
      if (!peers) {
        prune.push(topic)
      } else {
        this.log('GRAFT: Add mesh link from %s in %s', peer.info.id.toB58String(), topic)
        peers.add(peer)
        peer.topics.add(topic)
        this.mesh.set(topic, peers)
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

    let ctrlPrune = prune.map(buildCtrlPruneMsg)
    return ctrlPrune
  }

  /**
   * Handles Prune messages
   *
   * @param {Peer} peer
   * @param {rpc.RPC.Control} controlRpc
   *
   * @returns {void}
   *
   */
  _handlePrune (peer, controlRpc) {
    let pruneMsgs = controlRpc.prune
    if (!(pruneMsgs || pruneMsgs.length)) {
      return
    }

    pruneMsgs.forEach((prune) => {
      let topic = prune.topicID
      let peers = this.mesh.get(topic)
      if (!peers) {
        this.log('PRUNE: Remove mesh link to %s in %s', peer.info.id.toB58String(), topic)
        peers.delete(peer)
        peers.topic.delete(topic)
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
      callback()
    })
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
    setTimeout(heartbeat, constants.GossipSubHeartbeatInitialDelay)
    heartbeatTimer.runPeriodically(heartbeat, constants.GossipSubHeartbeatInterval)

    this._heartbeatTimer = heartbeatTimer
  }

  /**
   * Unmounts the floodsub protocol and shuts down every connection
   *
   * @override
   * @param {Function} callback
   * @returns {void}
   */
  stop (callback) {
    const heartbeatTimer = this._heartbeatTimer
    if (!heartbeatTimer) {
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
      heartbeatTimer.cancel(callback)
    })

    this._heartbeatTimer = null
  }

  /**
   * Subscribes to a topic
   * @param {String} topic
   * @returns {void}
   */
  subscribe (topic) {
    assert(this.started, 'GossipSub has not started')

    if (this.mesh.has(topic)) {
      return
    }

    this.log('Join %s', topic)

    this.subscriptions.add(topic)

    let topics = utils.ensureArray(topic)

    this.peers.forEach((peer) => sendSubscriptionsOnceReady(peer))
    function sendSubscriptionsOnceReady (peer) {
      if (peer && peer.isWritable) {
        return peer.sendSubscriptions(topics)
      }
      const onConnection = () => {
        peer.removeListener('connection', onConnection)
        sendSubscriptionsOnceReady(peer)
      }
      peer.on('connection', onConnection)
      peer.once('close', () => peer.removeListener('connection', onConnection))
    }
  }

  /**
   * Leaves a topic
   *
   * @param {String} topic
   * @returns {void}
   */
  unsubscribe (topic) {
    let meshPeers = this.mesh.get(topic)
    if (!meshPeers) {
      return
    }

    this.log('LEAVE %s', topic)

    this.mesh.delete(topic)
    this.subscriptions.delete(topic)

    meshPeers.forEach((peer) => {
      this.log('LEAVE: Remove mesh link to %s in %s', peer.info.id.toB58String(), topic)
      this._sendPrune(peer, topic)
      this.peer.topics.delete(topic)

      function checkIfReady (p) {
        if (p && p.isWritable) {
          p.sendUnsubscriptions([topic])
        } else {
          nextTick(checkIfReady.bind(p))
        }
      }

      checkIfReady(peer)
    })
  }

  /**
   * Publishes messages to all subscribed peers
   *
   * @param {Array<string>|string} topics
   * @param {any} msg
   * @returns {void}
   */
  publish (topics, msg) {
    topics = utils.ensureArray(topics)

    let msgObj = {
      from: this.libp2p.peerInfo.id.toB58String(),
      data: msg,
      seqno: utils.randomSeqno(),
      topicIDs: topics
    }

    this.messageCache.put(msgObj)
    this.seenCache.put(utils.msgId(msgObj.from, msgObj.seqno))

    // @type Set<string>
    let tosend = new Set()
    msgObj.topicIDs.forEach((topic) => {
      let peersInTopic = this.topics.get(topic)
      if (!peersInTopic) {
        return
      }

      // floodsub peers
      // TODO: Handle Floodsub peers
      /* peersInTopic.forEach((peer) => {
          if (peer.info.protocols.has(constants.FloodSubID)) {
              tosend.add(peer)
          }
      }) */

      // Gossipsub peers handling
      let meshPeers = this.mesh.get(topic)
      if (!meshPeers) {
        // We are not in the mesh for topic, use fanout peers
        if (!this.fanout.has(topic)) {
          // If we are not in the fanout, then pick any peers
          let peers = this._getPeers(topic, constants.GossipSubD)

          if (peers.size > 0) {
            this.fanout.set(topic, peers)
          }
        }
        // Store the latest publishing time
        this.lastpub.set(topic, this._nowInNano())
      }

      meshPeers.forEach((peer) => {
        tosend.add(peer)
      })
    })
    // Publish messages to peers
    tosend.forEach((peer) => {
      let peerId = peer.info.id.toB58String()
      if (peerId === msgObj.from) {
        return
      }
      peer.sendMessages(msgObj)
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
    let graft = [{
      topicID: topic
    }]

    let out = this._rpcWithControl(null, null, null, graft, null)
    if (peer && peer.isWritable) {
      peer.write(rpc.RPC.encode(out))
      peer.sendSubscriptions([topic])
    }
  }

  /**
   * Sends a PRUNE message to a peer
   *
   * @param {Peer} peer
   * @param {String} topic
   * @returns {void}
   */
  _sendPrune (peer, topic) {
    let prune = [{
      topicID: topic
    }]

    let out = this._rpcWithControl(null, null, null, null, prune)
    if (peer && peer.isWritable) {
      peer.write(rpc.RPC.encode(out))
      peer.sendUnsubscriptions([topic])
    }
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
    let tograft = new Map()
    let toprune = new Map()

    // maintain the mesh for topics we have joined
    this.mesh.forEach((peers, topic) => {
      // do we have enough peers?
      if (peers.size < constants.GossipSubDlo) {
        let ineed = constants.GossipSubD - peers.size
        let peersSet = this._getPeers(topic, ineed)
        peersSet.forEach((peer) => {
          if (!peers.has(peer)) {
            return
          }

          this.log('HEARTBEAT: Add mesh link to %s in %s', peer.info.id.toB58String(), topic)
          peers.add(peer)
          peer.topics.add(topic)
          tograft.set(peer, tograft.get(peer).push(topic))
        })
      }

      // do we have to many peers?
      if (peers.size > constants.GossipSubDhi) {
        let idontneed = peers.size - constants.GossipSubD
        let peersArray = new Array(peers)
        peersArray = this._shufflePeers(peersArray)

        let tmp = peersArray.slice(0, idontneed)
        tmp.forEach((peer) => {
          this.log('HEARTBEAT: Remove mesh link to %s in %s', peer.info.id.toB58String(), topic)
          peers.delete(peer)
          peer.topics.remove(topic)
          toprune.set(peer, toprune.get(peer).push(topic))
        })
      }

      this._emitGossip(topic, peers)
    })

    // expire fanout for topics we haven't published to in a while
    let now = this._nowInNano()
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
        let ineed = constants.GossipSubD - peers.size
        let peersSet = this._getPeers(topic, ineed)
        peersSet.forEach((peer) => {
          if (!peers.has(peer)) {
            return
          }

          peers.add(peer)
        })
      }

      this._emitGossip(topic, peers)
    })

    // advance the message history window
    this.messageCache.shift()
  }

  /**
   * Emits gossip to peers in a particular topic
   *
   * @param {String} topic
   * @param {Set<Peer>} peers
   * @returns {void}
   */
  _emitGossip (topic, peers) {
    let messageIDs = this.messageCache.getGossipIDs(topic)
    if (!messageIDs.length) {
      return
    }

    let gossipSubPeers = this._getPeers(topic, constants.GossipSubD)
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
    if (!this.topics.has(topic)) {
      return new Set()
    }

    // Adds all peers using GossipSub protocol
    let peersInTopic = this.topics.get(topic)
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

      let j = randInt()
      let tmp = peers[i]
      peers[i] = peers[j]
      peers[j] = tmp

      return peers
    }
  }

  /**
   * Returns the current time in nano seconds
   *
   * @returns {number}
   */
  _nowInNano () {
    return Math.floor(Date.now / 1000000)
  }
}

module.exports = GossipSub

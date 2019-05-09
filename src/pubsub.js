/* eslint-disable no-unused-vars */
/* eslint-disable no-warning-comments */
/* eslint-disable valid-jsdoc */

'use strict'

const Pubsub = require('libp2p-pubsub')
const pull = require('pull-stream')
const lp = require('pull-length-prefixed')
const nextTick = require('async/nextTick')
const { utils } = require('libp2p-pubsub')
const asyncMap = require('async/map')

const assert = require('assert')

const { rpc } = require('./message')
const constants = require('./constants')

class BasicPubSub extends Pubsub {
  /**
   * @param {Object} libp2p
   * @constructor
   */
  constructor (debugName, multicodec, libp2p) {
    super(debugName, multicodec, libp2p)
    /**
     * A set of subscriptions
     */
    this.subscriptions = new Set()
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
      this.emit('pubsub:subscription-change', peer.info, peer.topics, subs)
    }

    if (msgs.length) {
      utils.normalizeInRpcMessages(msgs).forEach((msg) => {
        const seqno = utils.msgId(msg.from, msg.seqno)
        if (!this.seenCache.has(seqno)) {
          this.seenCache.put(seqno)
          this._processRpcMessage(msg)
        }
      })
    }
    this._handleRpcControl(peer, rpc)
  }

  /**
   * @param {rpc.RPC.Message} msg
   */
  _processRpcMessage (msg) {
    // Emit to self
    this._emitMessage(msg.topicIDs, msg)
  }

  _emitMessage (topics, message) {
    topics.forEach((topic) => {
      if (this.subscriptions.has(topic)) {
        this.emit(topic, message)
      }
    })
  }

  _handleRpcControl (peer, rpc) {
    // noop - add implementation to subclass
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
   * Mounts the protocol onto the libp2p node and sends our
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
  }

  /**
   * Unmounts the protocol and shuts down every connection
   *
   * @override
   * @param {Function} callback
   * @returns {void}
   */
  stop (callback) {
    super.stop((err) => {
      if (err) return callback(err)
      this.subscriptions = new Set()
      callback()
    })
  }

  /**
   * Subscribes to topics
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  subscribe (topics) {
    assert(this.started, 'Pubsub has not started')

    topics = utils.ensureArray(topics)

    const newTopics = topics.filter((topic) => !this.subscriptions.has(topic))
    if (newTopics.length === 0) {
      return
    }

    // set subscriptions
    newTopics.forEach((topic) => {
      this.subscriptions.add(topic)
    })

    // Broadcast SUBSCRIBE to all peers
    this.peers.forEach((peer) => {
      peer.sendSubscriptions(newTopics)
    })

    this.join(newTopics)
  }

  join (topics) {
    // noop - add implementation to subclass
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

    // delete subscriptions
    unTopics.forEach((topic) => {
      this.subscriptions.delete(topic)
    })

    // Broadcast UNSUBSCRIBE to all peers
    this.peers.forEach((peer) => {
      peer.sendUnsubscriptions(topics)
    })

    this.leave(unTopics)
  }

  leave (topics) {
    // noop - add implementation to subclass
  }

  /**
   * Publishes messages to all subscribed peers
   *
   * @param {Array<string>|string} topics
   * @param {Array<any>|any} messages
   * @returns {void}
   */
  publish (topics, messages, callback) {
    assert(this.started, 'Pubsub has not started')
    this.log('publish', topics, messages)
    topics = utils.ensureArray(topics)
    messages = utils.ensureArray(messages)
    callback = callback || (() => {})

    const from = this.libp2p.peerInfo.id.toB58String()

    const buildMessage = (msg, cb) => {
      const seqno = utils.randomSeqno()
      const msgObj = {
        from: from,
        data: msg,
        seqno: seqno,
        topicIDs: topics
      }
      this.messageCache.put(msgObj)
      this.seenCache.put(msgObj.seqno)
      this._buildMessage(msgObj, cb)
    }

    asyncMap(messages, buildMessage, (err, msgObjects) => {
      if (err) callback(err)
      this._publish(utils.normalizeOutRpcMessages(msgObjects))
    })
  }

  _publish (rpcs) {
    // noop - add implementation to subclass
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

    // Adds all peers using our protocol
    let peers = []
    peersInTopic.forEach((peer) => {
      if (peer.info.protocols.has(this.multicodec)) {
        peers.push(peer)
      }
    })

    // Pseudo-randomly shuffles peers
    peers = this._shufflePeers(peers)
    if (count > 0 && peers.length > count) {
      peers = peers.slice(0, count)
    }

    return new Set(peers)
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
}

module.exports = BasicPubSub

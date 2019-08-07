'use strict'

const { multicodec: floodsubMulticodec } = require('libp2p-floodsub')
const Pubsub = require('libp2p-pubsub')
const pull = require('pull-stream')
const lp = require('pull-length-prefixed')
const nextTick = require('async/nextTick')
const { constants: multistreamConstants } = require('multistream-select')
const { utils } = require('libp2p-pubsub')
const asyncMap = require('async/map')
const errcode = require('err-code')

const assert = require('assert')

const { rpc } = require('./message')

class BasicPubSub extends Pubsub {
  /**
   * @param {String} debugName
   * @param {String} multicodec
   * @param {Object} libp2p libp2p implementation
   * @param {Object} options
   * @param {bool} options.emitSelf if publish should emit to self, if subscribed, defaults to false
   * @param {bool} options.gossipIncoming if incoming messages on a subscribed topic should be automatically gossiped, defaults to true
   * @param {bool} options.fallbackToFloodsub if dial should fallback to floodsub, defaults to true
   * @constructor
   */
  constructor (debugName, multicodec, libp2p, options) {
    super(debugName, multicodec, libp2p, options)
    /**
     * A set of subscriptions
     */
    this.subscriptions = new Set()

    /**
     * Pubsub options
     */
    this._options = {
      emitSelf: false,
      gossipIncoming: true,
      fallbackToFloodsub: true,
      ...options
    }
  }

  /**
   * When a peer has dialed into another peer, it sends its subscriptions to it.
   * @override
   * @param {PeerInfo} peerInfo The peer dialed
   * @param {Connection} conn  The connection with the peer
   * @param {Function} callback
   *
   * @returns {void}
   */
  _onDial (peerInfo, conn, callback) {
    const idB58Str = peerInfo.id.toB58String()

    super._onDial(peerInfo, conn, (err) => {
      if (err) return callback(err)

      const peer = this.peers.get(idB58Str)
      if (peer && peer.isWritable) {
        // Immediately send my own subscription to the newly established conn
        peer.sendSubscriptions(this.subscriptions)
      }
      nextTick(() => callback())
    })
  }

  /**
   * Dial a received peer.
   * @override
   * @param {PeerInfo} peerInfo The peer being dialed
   * @param {function} callback
   *
   * @returns {void}
   */
  _dialPeer (peerInfo, callback) {
    callback = callback || function noop () { }
    const idB58Str = peerInfo.id.toB58String()

    // If already have a PubSub conn, ignore
    const peer = this.peers.get(idB58Str)
    if (peer && peer.isConnected) {
      return nextTick(() => callback())
    }

    // If already dialing this peer, ignore
    if (this._dials.has(idB58Str)) {
      this.log('already dialing %s, ignoring dial attempt', idB58Str)
      return nextTick(() => callback())
    }

    // Verify if is known that the peer does not support Gossipsub
    const onlySupportsFloodsub = peerInfo.protocols.has(floodsubMulticodec) && !peerInfo.protocols.has(this.multicodec)

    // Define multicodec to use
    // Should fallback to floodsub if fallback is enabled, protocols were negotiated, and no Gossipsub available
    let multicodec = this.multicodec

    if (this._options.fallbackToFloodsub && onlySupportsFloodsub) {
      multicodec = floodsubMulticodec
    }

    this._dials.add(idB58Str)
    this.log('dialing %s %s', multicodec, idB58Str)

    this.libp2p.dialProtocol(peerInfo, multicodec, (err, conn) => {
      this.log('dial to %s complete', idB58Str)
      this._dials.delete(idB58Str)

      if (err) {
        // If previously dialed gossipsub and not supported, try floodsub if enabled fallback
        if (this._options.fallbackToFloodsub &&
          multicodec === this.multicodec &&
          err.code === multistreamConstants.errors.MULTICODEC_NOT_SUPPORTED) {
          this._dials.add(idB58Str)
          this.log('dialing %s %s', floodsubMulticodec, idB58Str)

          this.libp2p.dialProtocol(peerInfo, floodsubMulticodec, (err, conn) => {
            this.log('dial to %s complete', idB58Str)
            this._dials.delete(idB58Str)

            if (err) {
              this.log.err(err)
              return callback()
            }
            this._onDial(peerInfo, conn, callback)
          })
        } else {
          this.log.err(err)
          return callback()
        }
      } else {
        this._onDial(peerInfo, conn, callback)
      }
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
      msgs.forEach(message => {
        const msg = utils.normalizeInRpcMessage(message)
        const seqno = utils.msgId(msg.from, msg.seqno)

        // Ignore if we've already seen the message
        if (this.seenCache.has(seqno)) {
          return
        }

        this.seenCache.put(seqno)

        // Ensure the message is valid before processing it
        this.validate(message, (err, isValid) => {
          if (err || !isValid) {
            this.log('Message could not be validated, dropping it. isValid=%s', isValid, err)
            return
          }

          this._processRpcMessage(msg)
        })
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
    throw errcode('_handleRpcControl must be implemented by the subclass', 'ERR_NOT_IMPLEMENTED')
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
      // if fallback to floodsub enabled, we need to listen to its protocol
      if (this._options.fallbackToFloodsub) {
        this.libp2p.handle(floodsubMulticodec, this._onConnection)
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
    this.peers.forEach((peer) => sendSubscriptionsOnceReady(peer))
    // make sure that Gossipsub is already mounted
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

    this.join(newTopics)
  }

  join (topics) {
    throw errcode('join must be implemented by the subclass', 'ERR_NOT_IMPLEMENTED')
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

    // Broadcast UNSUBSCRIBE to all peers ready
    this.peers.forEach((peer) => sendUnsubscriptionsOnceReady(peer))
    // make sure that Gossipsub is already mounted
    function sendUnsubscriptionsOnceReady (peer) {
      if (peer && peer.isWritable) {
        return peer.sendUnsubscriptions(topics)
      }
      const onConnection = () => {
        peer.removeListener('connection', onConnection)
        sendUnsubscriptionsOnceReady(peer)
      }
      peer.on('connection', onConnection)
      peer.once('close', () => peer.removeListener('connection', onConnection))
    }

    this.leave(unTopics)
  }

  leave (topics) {
    throw errcode('leave must be implemented by the subclass', 'ERR_NOT_IMPLEMENTED')
  }

  /**
   * Publishes messages to all subscribed peers
   *
   * @param {Array<string>|string} topics
   * @param {Array<any>|any} messages
   * @param {Function|null} callback
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
      // put in seen cache
      this.seenCache.put(msgObj.seqno)

      // Emit to self if I'm interested and emitSelf enabled
      this._options.emitSelf && this._emitMessages(topics, [msgObj])

      this._buildMessage(msgObj, cb)
    }

    asyncMap(messages, buildMessage, (err, msgObjects) => {
      if (err) callback(err)
      this._publish(utils.normalizeOutRpcMessages(msgObjects))

      callback()
    })
  }

  _emitMessages (topics, messages) {
    topics.forEach((topic) => {
      if (!this.subscriptions.has(topic)) {
        return
      }

      messages.forEach((message) => {
        this.emit(topic, message)
      })
    })
  }

  _publish (rpcs) {
    throw errcode('_publish must be implemented by the subclass', 'ERR_NOT_IMPLEMENTED')
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

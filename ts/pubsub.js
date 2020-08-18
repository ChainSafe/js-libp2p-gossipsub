'use strict'

const errcode = require('err-code')
const PeerId = require('peer-id')

const pipe = require('it-pipe')

const Pubsub = require('libp2p-pubsub')

const { utils } = require('libp2p-pubsub')
const { RPCCodec } = require('./message')

class BasicPubSub extends Pubsub {
  /**
   * @param {Object} props
   * @param {String} props.debugName log namespace
   * @param {string[]} props.multicodecs protocol identifiers to connect
   * @param {Libp2p} props.libp2p
   * @param {Object} [props.options]
   * @param {boolean} [props.options.emitSelf] if publish should emit to self, if subscribed, defaults to false
   * @constructor
   */
  constructor ({ debugName, multicodecs, libp2p, options = {} }) {
    if (!PeerId.isPeerId(libp2p.peerId)) {
      throw new Error('peerId must be an instance of `peer-id`')
    }

    const _options = {
      emitSelf: false,
      ...options
    }

    super({
      debugName,
      multicodecs,
      peerId: libp2p.peerId,
      registrar: libp2p.registrar,
      ..._options
    })

    /**
     * A set of subscriptions
     */
    this.subscriptions = new Set()

    /**
     * Pubsub options
     */
    this._options = _options

    /**
     * The default msgID implementation
     * @param {RPC.Message} msg the message object
     * @returns {string} message id as string
     */
    this.defaultMsgIdFn = (msg) => utils.msgId(msg.from, msg.seqno)

    /**
     * Topic validator function
     * @typedef {function(string, Peer, RPC): boolean} validator
     */

    /**
     * Topic validator map
     *
     * Keyed by topic
     * Topic validators are functions with the following input:
     * @type {Map<string, validator>}
     */
    this.topicValidators = new Map()
  }

  /**
   * Peer connected successfully with pubsub protocol.
   * @override
   * @param {PeerId} peerId peer id
   * @param {Connection} conn connection to the peer
   * @returns {Promise<void>}
   */
  async _onPeerConnected (peerId, conn) {
    await super._onPeerConnected(peerId, conn)
    const id = peerId.toB58String()

    // Immediately send my own subscriptions to the newly established conn
    this._sendSubscriptions(id, Array.from(this.subscriptions), true)
  }

  /**
   * Overriding the implementation of _processConnection should keep the connection and is
   * responsible for processing each RPC message received by other peers.
   * @override
   * @param {string} idB58Str peer id string in base58
   * @param {DuplexIterableStream} stream inbound stream
   * @param {PeerStreams} peerStreams PubSub peer
   * @returns {void}
   *
   */
  async _processMessages (idB58Str, stream, peerStreams) {
    try {
      await pipe(
        stream,
        async (source) => {
          for await (const data of source) {
            const rpcMsgBuf = data instanceof Uint8Array ? data : data.slice()
            const rpcMsg = this._decodeRpc(rpcMsgBuf)

            this._processRpc(idB58Str, peerStreams, rpcMsg)
          }
        }
      )
    } catch (err) {
      this._onPeerDisconnected(peerStreams.id, err)
    }
  }

  /**
   * Decode a Uint8Array into an RPC object
   *
   * Override to use an extended protocol-specific protobuf decoder
   *
   * @param {Uint8Array} buf
   * @returns {RPC}
   */
  _decodeRpc (buf) {
    return RPCCodec.decode(buf)
  }

  /**
   * Encode an RPC object into a Uint8Array
   *
   * Override to use an extended protocol-specific protobuf encoder
   *
   * @param {RPC} rpc
   * @returns {Uint8Array}
   */
  _encodeRpc (rpc) {
    return RPCCodec.encode(rpc)
  }

  /**
   * Handles an rpc request from a peer
   *
   * @param {String} idB58Str
   * @param {PeerStreams} peerStreams
   * @param {RPC} rpc
   * @returns {boolean}
   */
  _processRpc (idB58Str, peerStreams, rpc) {
    this.log('rpc from', idB58Str)
    const subs = rpc.subscriptions
    const msgs = rpc.msgs

    if (subs.length) {
      // update peer subscriptions
      subs.forEach((subOpt) => this._processRpcSubOpt(idB58Str, subOpt))
      this.emit('pubsub:subscription-change', peerStreams.id, subs)
    }

    if (!this._acceptFrom(idB58Str)) {
      this.log('received message from unacceptable peer %s', idB58Str)
      return false
    }

    if (msgs.length) {
      msgs.forEach(message => {
        if (!message.topicIDs.some((topic) => this.subscriptions.has(topic))) {
          this.log('received message we didn\'t subscribe to. Dropping.')
          return
        }
        const msg = utils.normalizeInRpcMessage(message, PeerId.createFromB58String(idB58Str))
        this._processRpcMessage(msg)
      })
    }
    return true
  }

  /**
   * Whether to accept a message from a peer
   * Override to create a graylist
   * @override
   * @param {string} id
   * @returns {boolean}
   */
  _acceptFrom (id) {
    return true
  }

  /**
   * Validates the given message.
   * @param {InMessage} message
   * @returns {Promise<void>}
   */
  async validate (message) {
    await super.validate(message)
    for (const topic of message.topicIDs) {
      const validatorFn = this.topicValidators.get(topic)
      if (!validatorFn) {
        continue
      }
      await validatorFn(topic, message)
    }
  }

  /**
   * Handles an subscription change from a peer
   *
   * @param {string} id
   * @param {RPC.SubOpt} subOpt
   */
  _processRpcSubOpt (id, subOpt) {
    const t = subOpt.topicID

    let topicSet = this.topics.get(t)
    if (!topicSet) {
      topicSet = new Set()
      this.topics.set(t, topicSet)
    }

    if (subOpt.subscribe) {
      // subscribe peer to new topic
      topicSet.add(id)
    } else {
      // unsubscribe from existing topic
      topicSet.delete(id)
    }
  }

  /**
   * Handles an message from a peer
   *
   * @param {InMessage} msg
   */
  async _processRpcMessage (msg) {
    if (this.peerId.toB58String() === msg.from && !this._options.emitSelf) {
      return
    }
    // Ensure the message is valid before processing it
    try {
      await this.validate(msg)
    } catch (err) {
      this.log('Message is invalid, dropping it. %O', err)
      return
    }

    this._emitMessage(msg)

    this._publish(msg)
  }

  /**
   * Emit a message from a peer
   * @param {Peer} peer
   * @param {InMessage} message
   */
  _emitMessage (message) {
    message.topicIDs.forEach((topic) => {
      if (this.subscriptions.has(topic)) {
        this.emit(topic, message)
      }
    })
  }

  /**
   * Unmounts the protocol and shuts down every connection
   * @override
   * @returns {void}
   */
  async stop () {
    await super.stop()

    this.subscriptions = new Set()
  }

  /**
   * Subscribes to topics
   * @override
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  subscribe (topics) {
    if (!this.started) {
      throw new Error('Pubsub has not started')
    }

    // normalize input and remove existing subscriptions
    topics = utils.ensureArray(topics)
    const newTopics = topics.filter((topic) => !this.subscriptions.has(topic))
    if (newTopics.length === 0) {
      return
    }
    this._subscribe(newTopics)
  }

  /**
   * Subscribes to topics
   *
   * @param {Array<string>} topics
   * @returns {void}
   */
  _subscribe (topics) {
    // set subscriptions
    topics.forEach((topic) => {
      this.subscriptions.add(topic)
    })

    // Broadcast SUBSCRIBE to all peers
    this.peers.forEach((_, id) => this._sendSubscriptions(id, topics, true))
  }

  /**
   * Leaves a topic
   * @override
   * @param {Array<string>|string} topics
   * @returns {void}
   */
  unsubscribe (topics) {
    if (!this.started) {
      throw new Error('Pubsub has not started')
    }

    // normalize input and remove existing unsubscriptions
    topics = utils.ensureArray(topics)
    const unTopics = topics.filter((topic) => this.subscriptions.has(topic))
    if (unTopics.length === 0) {
      return
    }
    this._unsubscribe(unTopics)
  }

  /**
   * Unsubscribes to topics
   *
   * @param {Array<string>} topics
   * @returns {void}
   */
  _unsubscribe (topics) {
    // delete subscriptions
    topics.forEach((topic) => {
      this.subscriptions.delete(topic)
    })

    // Broadcast UNSUBSCRIBE to all peers ready
    this.peers.forEach((_, id) => this._sendSubscriptions(id, topics, false))
  }

  /**
   * Publishes messages to all subscribed peers
   * @override
   * @param {Array<string>|string} topics
   * @param {Buffer} message
   * @returns {Promise<void>}
   */
  async publish (topics, message) {
    if (!this.started) {
      throw new Error('Pubsub has not started')
    }
    topics = utils.ensureArray(topics)

    this.log('publish', topics, message)

    const from = this.peerId.toB58String()

    let msgObject = {
      receivedFrom: from,
      from: from,
      data: message,
      seqno: utils.randomSeqno(),
      topicIDs: topics
    }
    // ensure that any operations performed on the message will include the signature
    const outMsg = await this._buildMessage(msgObject)
    msgObject = utils.normalizeInRpcMessage(outMsg)

    // Emit to self if I'm interested and emitSelf enabled
    this._options.emitSelf && this._emitMessage(msgObject)

    // send to all the other peers
    await this._publish(msgObject)
  }

  /**
   * Get the list of topics which the peer is subscribed to.
   * @override
   * @returns {Array<String>}
   */
  getTopics () {
    if (!this.started) {
      throw new Error('Pubsub is not started')
    }

    return Array.from(this.subscriptions)
  }

  /**
   * Child class can override this.
   * @param {RPC.Message} msg the message object
   * @returns {string} message id as string
   */
  getMsgId (msg) {
    return this.defaultMsgIdFn(msg)
  }

  /**
   * Publish message
   *
   * @param {InMessage} msg
   * @returns {Promise<void>}
   */
  async _publish (msg) {
    throw errcode(new Error('_publish must be implemented by the subclass'), 'ERR_NOT_IMPLEMENTED')
  }

  /**
   * Send an rpc object to a peer
   * @param {string} id peer id
   * @param {RPC} rpc
   * @returns {void}
   */
  _sendRpc (id, rpc) {
    const peerStreams = this.peers.get(id)
    if (!peerStreams || !peerStreams.isWritable) {
      return
    }
    peerStreams.write(this._encodeRpc(rpc))
  }

  /**
   * Send subscroptions to a peer
   * @param {string} id peer id
   * @param {string[]} topics
   * @param {boolean} subscribe set to false for unsubscriptions
   * @returns {void}
   */
  _sendSubscriptions (id, topics, subscribe) {
    return this._sendRpc(id, {
      subscriptions: topics.map(t => ({ topicID: t, subscribe: subscribe }))
    })
  }
}

module.exports = BasicPubSub

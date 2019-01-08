'use strict'

const libp2p = require('libp2p')
const EventEmitter = require('events')
const values = require('lodash/values')
const pull = require('pul-stream')
const asyncEach = require('async/each')
const setImmediate = require('async/setImmediate')
const debug = require('debug')

// Going to need to copy over the message directory from the js floodsub repo
// and add make changes to the message format for gossipsub
const rpc = require('/message').rpc.RPC

// Going to need to copy over the peer class from the js floodsub repo
// Don't think we will need to change it since it is pubsub agnostic
class Peer {

}

// Data structure to store messages for gossip in a cache.
// Will be implemented as in https://github.com/libp2p/go-libp2p-pubsub/blob/master/mcache.go#L15
class MessageCache {

}

class GossipSub extends EventEmitter {

    constructor (debugName, multicodec, libp2p) {
        super()
	
	this.log = debug(debugName)
	this.log.err = debug(`${debugName}:error`)
	this.multicodec = multicodec
	this.libp2p = libp2p
	this.started = false

	/**
	 * Map of peers.
	 * Some peers will be gossipsub peers while others will be floodsub peers
	 * @type {Map<string, Peer>}
	 */
	this.peers = new Map()

	/**
	 * Map of topic meshes
	 *
	 * @type {Map<string, Map<Peer,Set<string>>>}
	 */
	this.mesh = new Map()

	/**
	 * Map of topics to lists of peers. These mesh peers are peers to which we are publishing to without topic membership
	 *
	 *@type {Map<string, Map<Peer, Set<string>>>}
	 */
	this.fanout = new Map()

	/**
	 * Map of last publish time for fanout topics
	 * Note: Could use https://github.com/chjj/n64 to get an int64 obj in JS
	 *@type {Map<string,int64>}
	 */
	this.lastpub = new Map()
	
	/**
	 * Map of pending messages to gossip
	 *
	 * @type {Map<Peer, string[]> }
	 */
	this.gossip = new Map()
	
	/**
	 * Map of control messages
	 *
	 * @type {Map<Peer, string>}
	 */
	this.control = new Map()

	/**
	 * A message cache that contains the messages for last few hearbeat ticks
	 *
	 */
	this.messageCache = new MessageCache()	

	// Dials that are currently in progress
	this._dials = new Map()

	this._onConnection = this._onConnection.bind(this)
	this._dialPeer = this._dialPeer.bind(this)
    }


    _addPeer (peer) {
    
    }

    _removePeer (peer) {
    }

    _dialPeer (peer) {
    }

    _onDial (peerInfo, conn, callback) {
    }

    _onRpc (idB58Str, rpc) {
    }

    _processRpcMessages (msgs) {
    }

    _emitMessages (topics, messages) {
    }

    _forwardMessages (topics, messages) {
    }

    _onConnection(protocol, conn) {
    }

    _processConnection(idB58Str, conn, peer) {
    }

    _onConnectionEnd(idB58Str, peer, err) {
    }

    /**
     * Mounts the gossipsub protocol onto a libp2p node
     * and sends subscriptions to every peer as per the protocol
     *
     * @param {Function} callback
     * @return {undefined}
     */
    start (callback) {
    }

    /**
     * Publish messages to the given topics
     *
     * @param {Array<string>|string} topics
     * @param {Array<any>|any} messages
     * @returns {undefined}
     */
    publish (topics, messages) {
    }

    /**
     * Subscribe to the given topics
     * @param {Array<string>|string} topics
     * @returns {undefined}
     */
    subscribe (topics) {
    }

    /**
     * Unsubscribe from the given topics
     * @param {Array<string>|string} topics
     * @returns {undefined}
     */
    unsubscribe (topics) {
    }

    /**
     * Unmounts the gossipsub protocol and shuts down every connection
     *
     */
    stop (callback) {
    }

}

module.exports = GossipSub

'use strict'

const libp2p = require('libp2p')
const EventEmitter = require('events')
const values = require('lodash/values')
const pull = require('pull-stream')
const asyncEach = require('async/each')
const setImmediate = require('async/setImmediate')
const debug = require('debug')

const pb = require('./message')
const MessageCache = require('./messageCache')
const utils = require('./utils')
const Peer = require('./peer') // Will switch to js-peer-info once stable

// Overlay parameters
const GossipSubD = 6
const GossipSubDlo = 4
const GossipSubDhi = 12

// Gossip parameters
const GossipSubHistoryLength = 5
const GossipSubHistoryGossip = 3

// Heartbeat interval
const GossipSubHeartbeatInitialDelay = 100 // In milliseconds
const GossipSubHeartbeatInterval = 1 // In seconds

// Fanout ttl
const GossipSubFanoutTTL = 60 // in seconds


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
	 * @type {Map<string, Set<Peer>>}
	 */
	this.mesh = new Map()

	/**
	 * Map of topics to lists of peers. These mesh peers are peers to which we are publishing to without topic membership
	 *
	 *@type {Map<string, Set<Peer>>}
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
    }


    /**
     * The next few functions will be copied over from the js-libp2p-floodsub
     * repository. Might need to copy over the base.js file from the js-libp2p-floodsub repository
     *
     */
    _addPeer (peer) {
        const id = peer.info.id.toB58String()

        /*
          Always use an existing peer.
          What is happening here is: "If the other peer has already dialed to me, we already have
          an establish link between the two, what might be missing is a
          Connection specifically between me and that Peer"
        */
        let existing = this.peers.get(id)
        if (!existing) {
            this.log('new peer', id)
            this.peers.set(id, peer)
            existing = peer

            peer.once('close', () => this._removePeer(peer))
        }
        ++existing._references

        return existing
    }

    _removePeer (peer) {
        const id = peer.info.id.toB58String()
	
	this.log('remove', id, peer._references)
	// Only delete when no one else if referencing this peer.
	if (--peer._references === 0){
	    this.log('delete peer', id)
            this.peers.delete(id)

            // Remove this peer from the mesh
            for(let topic, peers of this.mesh.entries()){
	        peers.delete(peer)
	    }
	    // Remove this peer from the fanout
            for (let topic, peers of this.fanout.entries()){
	        peers.delete(peer)
	    }

	    // Remove from gossip mapping
            this.gossip.delete(peer)
	    // Remove from control mapping
            this.control.delete(peer)
	}
    }
    
    _onRpc(idB58Str, rpc) {
        if(!rpc){
	    return
	}

	this.log('rpc from', idB58Str)
	const controlMsg = rpc.control
	
	const iwant = this.handleIHave(idB58Str, controlMsg)
	const ihave = this.handleIWant(idB58Str, controlMsg)
	const prune = this.handleGraft(idB58Str, controlMsg)
	this.handlePrune(idB58Str, controlMsg)
        	
	
    }

    handleIHave(id, controlMsg) {
    
    }

    handleIWant(id, controlMsg) {
    
    }

    handleGraft(id, controlMsg) {
    
    }

    handlePrune(id, controlMsg) {
    
    }

    _processRpcControlMsgs() {
    
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

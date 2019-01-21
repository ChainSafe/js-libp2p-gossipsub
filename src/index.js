'use strict'

const libp2p = require('libp2p')
const EventEmitter = require('events')
const FloodSub = require('libp2p-floodsub')
const values = require('lodash/values')
const pull = require('pull-stream')
const empty = require('pull-stream/sources/empty')
const lp = require('pull-length-prefixed')
const asyncEach = require('async/each')
const setImmediate = require('async/setImmediate')
const debug = require('debug')

const pb = require('./message')
const MessageCache = require('./messageCache').MessageCache
const TimeCache = require('time-cache')
const CacheEntry = require('./messageCache').CacheEntry
const utils = require('./utils')
const Peer = require('./peer') // Will switch to js-peer-info once stable

const FloodSubID = "/floodsub/1.0.0"
const GossipSubID = "/meshsub/1.0.0"

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


class GossipSub extends FloodSub {

    constructor (libp2p) {
        super('libp2p:gossipsub', '/meshsub/1.0.0', libp2p)
	
	/*
	this.log = debug('libp2p:gossipsub')
	this.log.err = debug(`libp2p:gossipsub:error`)
	this.multicodec = '/meshsub/1.0.0'
	this.libp2p = libp2p
	this.started = false
	*/

	/**
	 * Map of peers to the protocol they are using. 
	 * Some peers will be gossipsub peers while others will be floodsub peers
	 * @type {Map<string, String>}
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

        /**
	 * Time based cache for previously seen messages
	 *
	 */
	this.timeCache = new TimeCache()

	/**
	 * Tracks which topics each of our peers are subscribed to
	 * @type {Map<String, Set<Peer>>}
	 *
	 */
	this.topics = new Map()

	// Dials that are currently in progress
	this._dials = new Set()

	this._onConnection = this._onConnection.bind(this)
	this._dialPeer = this._dialPeer.bind(this)
	
	this.heartbeatTimer()
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
            // Need to add the protocol that the peer is using. 
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
            for(let [topic, peers] of this.mesh){
	        peers.delete(peer)
	    }
	    // Remove this peer from the fanout
            for (let [topic, peers] of this.fanout){
	        peers.delete(peer)
	    }

	    // Remove from gossip mapping
            this.gossip.delete(peer)
	    // Remove from control mapping
            this.control.delete(peer)
	}
    }

    _processConnection (idB58Str, conn, peer) {
        pull(
	  conn,
	  lp.decode(),
          pull.map((data) => pb.rpc.RPC.decode(data)),
          pull.drain(
	    (rpc) => this._onRpc(idB58Str, rpc),
            (err) => this._onConnectionEnd(idB58Str, peer, err)
	  )
	)
    }
    
    _onRpc(idB58Str, rpc) {
        if(!rpc){
	    return
	}

	this.log('rpc from', idB58Str)
	const controlMsg = rpc.control
	
	let iWant = this.handleIHave(idB58Str, controlMsg)
	let iHave = this.handleIWant(idB58Str, controlMsg)
	let prune = this.handleGraft(idB58Str, controlMsg)
	this.handlePrune(idB58Str, controlMsg)

	let out = this._rpcWithControl(ihave, null, iwant, null, prune)
        _sendRpc(rpc.from, out) 	
    }

    _rpcWithControl(msgs, ihave, iwant, graft, prune) {
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

    handleIHave(peer, controlRpc) {
        let iwant = new Set()

        let ihaveMsgs = controlRpc.ihave
	ihaveMsgs.forEach(function(msg) {
	    let topic = msg.topicID

	    if (!this.mesh.has(topic)) {
	        continue
	    }

	    let msgIDs = ihaveMsgs.messageIDs
            msgIDs.forEach(function(msgID){
	        if (this.timeCache.has(msgID)) {
		     continue
		}
                iwant.add(msgID)
	    })
	})

        if (iwant.length === 0) {
	    return null
	}

	this.log("IHAVE: Asking for %d messages from %s", iwant.length, peer.info.id.toB58String)
	let iwantlst = new Array(iwant.length)
	iwant.forEach(function(msgID) {
	    iwantlst.push(msgID)
	})

	const buildIWantMsg = () => {
	    return {
		    messageIDs: iwantlst
	    }
	}
	
	return buildIWantMsg()
    }

    handleIWant(peer, controlRpc) {
	// @type {Map<string, pb.Message>}
        let ihave = new Map()

	let iwantMsgs = controlRpc.iwant
	iwantMsgs.forEach(function(iwantMsg) {
	    let iwantMsgIDs = iwantMsg.MessageIDs
            iwantMsgIDs.forEach(function(msgID){
	         let msg, ok = this.messageCache.Get(msgID)
		 if (ok) {
		     ihave.set(msgID, msg)
		 }
	    })
	})

	if (ihave.length === 0) {
	    return null
	}

	this.log("IWANT: Sending %d messages to %s", ihave.length, peer.info.id.toB58String)

	let msgs = new Array(ihave.length)
	for (let [tmp, msg] of ihave) {
	    msgs.push(msg)
	}

	return msgs
    }

    handleGraft(peer, controlRpc) {
        let prune = []

	let grafts = controlRpc.graft
        grafts.forEach(function(graft) {
	    let topic = graft.topicID
            let ok = this.mesh.has(topic)
            if (!ok) {
	        prune.push(topic)
	    } else {
	        this.log("GRAFT: Add mesh link from %s in %s", peer.info.id.toB58String, topic)
		let peers = this.mesh.get(topic)
		peers.add(peer)
		// TODO: Need to tag peer with topic

	    }
	})
	
	if(prune.length === 0) {
	    return null
	}

	ctrlPrune = new Array(prune.length)

	const buildCtrlPruneMsg = (topic) => {
	    return {
		    topicID: topic
	    }
	}

	ctrlPrune = prune.map(buildCtrlPruneMsg)
	return ctrlPrune
    }

    handlePrune(peer, controlRpc) {
        let pruneMsgs = controlRpc.prune
	
	pruneMsgs.forEach(function(prune){
	    let topic = prune.topicID
            let ok = this.mesh.has(topic)
            let peers = this.mesh.get(topic)
            if (ok) {
	        this.log("PRUNE: Remove mesh link to %s in %s", peer.info.id.toB58String, topic)
		peers.delete(peer)
		// TODO: Untag peer from topic
	    }
	})
    }
    
    /**
     * Joins a topic
     * @param {String}
     *
     */
   join(topic) {
       let ok = this.mesh.has(topic)
       let gmap = this.mesh.get(topic)
       if (ok){
           return
       }

       this.log("Join " + topic)

       ok = this.fanout.has(topic)
       gmap = this.fanout.get(topic)
       if (ok) {
           this.mesh.set(topic, gmap)
	   this.fanout.delete(topic)
	   this.lastpub.delete(topic)
       } else {
           // TODO: Get peers and set topic for subset of peers
       }

       for (let peer of gmap) {
           this.log("JOIN: Add mesh link to %s in %s", peer.info.id.toB58String, topic)
	   this.sendGraft(peer, topic)
	   // TODO: Tag peer with topic
       }
   
   }

   /**
    * Leaves a topic
    * @param {String}
    *
    */
   leave(topic) {
       let ok = this.mesh.has(topic)
       let gmap = this.mesh.get(topic)
       if (!ok) {
           return
       }

       this.log("LEAVE %s", topic)

       this.mesh.delete(topic)

       for (let peer of gmap) {
           this.log("LEAVE: Remove mesh link to %s in %s", peer.info.id.toB58String, topic)
	   this.sendPrune(peer, topic)
	   // TODO: Untage peer
       }

   }

   /**
    *
    * @param {Peer}
    * @param {any}
    *
    */
   publish(from, msg) {
       this.messageCache.Put(msg)

       // @type Set<string>
       let tosend = new Set()
       for (let [i, topic] of msg.topicIDs.entries()) {

           // TODO: Determine if peer is a floodsub peer or gossipsub peer
       }

   }

   sendGraft(peer, topic) {
       let graft = [{
           topicID: topic
       }]

       let out = _rpcWithControl(null, null, null, graft, null)
       this._sendRPC(peer, out)

   }

   sendPrune(peer, topic) {
       let prune = [{
           topicID: topic
       }]

       let out = _rpcWithControl(null, null, null, null, prune)
       this._sendRPC(peer, out)
   }

   sendGraftPrune(tograft, toprune) {
       
   }
 
   _sendRPC (peer, rpc) {
   
   }

   heartbeatTimer() {
   
   }

   heartbeat() {
   
   }

   emitGossip(topic, peers) {
   
   }

   pushGossip(peer, ihave) {
   
   }

   piggybackGossip(peer, rpc, ihave) {
   
   }

   pushControl(peer, control) {
   
   }

   piggybackControl(peer, rpc, control) {
   
   }

   flush() {
   
   }

   _getPeers(topic, count, filter) {
       
   }

   /**
    * Given a peer, return the protocol is it using
    * @param {Peer}
    * @returns {string}
    *
    */
   _getProtocol(peer) {
   
   }

   _sendRPC(peer, rpc) {
   
   }

}

module.exports = GossipSub

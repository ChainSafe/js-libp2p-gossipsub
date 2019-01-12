'use strict'

const libp2p = require('libp2p')
const EventEmitter = require('events')
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

    constructor (libp2p) {
        super()
	
	this.log = debug('libp2p:gossipsub')
	this.log.err = debug(`libp2p:gossipsub:error`)
	this.multicodec = '/gossipsub/1.0.0'
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

        /**
	 * Time based cache for previously seen messages
	 *
	 */
	this.timeCache = new TimeCache()

	// Dials that are currently in progress
	this._dials = new Map()

	this._onConnection = this._onConnection.bind(this)
	this._dialPeer = this._dialPeer.bind(this)
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

    _dialPeer(peerInfo, callback) {
        callback = callback || function noop() {}
	const idB58Str = peerInfo.id.toB58String()

	// If already have a PubSub conn, ignore
	const peer = this.peers.get(idB58Str)
	if (peer && peer.isConnected) {
	    return setImmediate(() => callback())
	}

	// If already dialing this peer, ignore
	if (this._dials.has(idB58Str)) {
	    this.log('already dialing %s, ignoring dial attempt', idB58Str)
            return setImmediate(() => callback)
	}
	this._dials.add(idB58Str)

	this.log('dialing %s', idB58Str)
	this.libp2p.dialProtocol(peerInfo, this.multicodec, (err, conn) => {
	    this.log('dial to %s complete', idB58Str)

            // If the dial is not in the set, it means that pubsub has been stopped
            const gossipsubStopped = !this._dials.has(idB58Str)
            this._dials.delete(idB58Str)

            if (err) {
	        this.log.err(err)
		return callback()
	    }

	    // Gossipsub has been stopped, so we should just bail out
            if (gossipsubStopped) {
	        this.log('Gossipsub was stopped, not processing dial to %s', idB58Str)
		return callback()
	    }
	}) 
        
       
    }

    _onDial (peerInfo, conn, callback) {
        const idB58Str = peerInfo.id.toB58String()
	this.log('connected', idB58Str)

	const peer = this._addPeer(new Peer(peerInfo))
	peer.attachConnection(conn)

        setImmediate(() => callback())
    }

    _onConnection(protocol, conn) {
        conn.getPeerInfo((err, peerInfo) => {
	    if (err) {
	        this.log.err('Failed to identify incoming conn', err)
		return pull(empty(), conn)
	    }
	})

	const idB58Str = peerInfo.id.toB58String()
	const peer = this._addPeer(new Peer(peerInfo))

	this._processConnection(idB58Str, conn, peer)
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

    _onConnectionEnd(idB58Str, peer, err) {
        // socket hang up, means the one side canceled
	if (err && err.message !== 'socket hang up') {
	    this.log.err(err)
	}
	this.log('connection ended', idB58Str, err ? err.message : '')
	this._removePerr(peer)
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

    handleIHave(idB58Str, controlRpc) {
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

	this.log("IHAVE: Asking for %d messages from %s", iwant.length, idB58Str)
	let iwantlst = new Array(iwant.length)
	iwant.forEach(function(msgID) {
	    iwantlst.push(msgID)
	})

	const buildIWantMsg = (msg) => {
	    return {
		    messageIDs: iwantlst
	    }
	}
	iwantlst.map(buildIWantMsg)
	return iwantlst
    }

    handleIWant(idB58Str, controlRpc) {
	// @type {Map<string, pb.Message>}
        let ihave = new Map()

	let iwantMsgs = controlRpc.iwant
	iwantMsgs.forEach(function(iwantMsg) {
	    let iwantMsgIDs = iwantMsg.MessageIDs
            iwantMsgIDs.forEach(function(msgID){
	         if (this.messageCache.get(msgID)[1]) {
		     ihave[msgID] = iwantMsg
		 }
	    })
	})

	if (ihave.length === 0) {
	    return null
	}

	this.log("IWANT: Sending %d messages to %s", ihave.length, idB58Str)

	let msgs = new Array(ihave.length)
	for (let [tmp, msg] of ihave) {
	    msgs.push(msg)
	}

	return msgs
    }

    handleGraft(idB58Str, controlMsg) {
        
    }

    handlePrune(idB58Str, controlMsg) {
    
    }
    
    /**
     * Joins a topic
     * @param {String}
     *
     */
   join(topic) {
       gmap = this.mesh.get(topic)
       
       this.log("Join " + topic)
   
   }

   /**
    * Leaves a topic
    * @param {String}
    *
    */
   leave(topic) {
   
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
       tosend = new Set()
       for (let [i, topic] of msg.topicIDs.entries()) {
       
       }

   }

   sendGraft(peer, topic) {
   
   }

   sendPrune(peer, topic) {
   
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

   /**
    * Mounts the gossipsub protocol onto the libp2p node
    * @param {Function} callback
    * @returns {undefined}
    *
    */
   start(callback) {
       if(this.started) {
           return setImmediate(() => callback(new Error('already started')))
       }
       this.log('starting')

       this.libp2p.handle(this.multicodec, this._onConnection)

       // Speed up any new peer that comes in my way
       this.libp2p.on('peer:connect', this._dialPeer)

       // Dial already connected peers
       const peerInfos = Object.values(this.libp2p.peerBook.getAll())

       asyncEach(peerInfos, (peer, cb) => this._dialPeer(peer, cb), (err) =>{
           setImmediate(() =>{
	     this.log('started')
             this.started = true
             callback(err)
	   })
       })
   }

   /**
    * Unmounts the gossipsub protocol and shuts down every connection
    *
    * @param {Function} callback
    * @returns {undefined}
    *
    */
   stop (callback) {
       if (!this.started) {
           return setImmediate(() => callback(new Error('not started yet')))
       }

       this.libp2p.unhandle(this.multicodec)
       this.libp2p.removeListener('peer:connect', this._dialPeer)

       // Prevent any dials that are in flight from being processed
       this._dials = new Set()

       this.log('stopping')
       asyncEach(this.peers.values(), (peer, cb) => peer.close(cb), (err) => {
           if (err) {
	       return callback(err)
	   }

	   this.log('stopped')
	   this.peers = new Map()
	   this.started = false
	   callback()
       })
   }

}

module.exports = GossipSub

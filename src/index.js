'use strict'

const libp2p = require('libp2p')
const Pubsub = require('libp2p-pubsub')

const pull = require('pull-stream')
const lp = require('pull-length-prefixed')
const asyncEach = require('async/each')
const setImmediate = require('async/setImmediate')

const MessageCache = require('./messageCache').MessageCache
const TimeCache = require('time-cache')
const CacheEntry = require('./messageCache').CacheEntry
const utils = require('./utils')

const RPC = require('./message').rpc.RPC

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


class GossipSub extends Pubsub {

    /**
     * @param {Object} libp2p
     * @constructor
     *
     */
    constructor (libp2p) {
        super('libp2p:gossipsub', GossipSubID, libp2p)

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
	
	this._heartbeatTimer()
    }

    /**
     * Removes a peer from the router
     * 
     * @param {Peer} peer
     * @returns {undefined}
     */
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

    /**
     * When a peer has dialed into another peer, it sends its subscriptions to it.
     *
     * @param {PeerInfo} peerInfo
     * @param {Connection} conn
     * @param {Function} callback
     *
     * @returns undefined
     *
     */
    _onDial(peerInfo, conn, callback) {
        super._onDial(peerInfo, conn, (err) => {
	    if (err) return callback(err)
            const idB58Str = peerInfo.id.toB58Str()
            const peer = this.peers.get(idB58Str)
	    if (peer && peer.isWritable) {
	        // Immediately send my own subscription to the newly established conn
		peer.sendSubscriptions(this.subscriptions)
	    }
	    setImmediate(() => callback())
	})     
    }

    /**
     * Processes a peer's connection to another peer.
     *
     * @param {String} idB58Str
     * @param {Connection} conn
     * @param {Peer} peer
     *
     * @returns undefined
     *
     */
    _processConnection(idB58Str, conn, peer) {
        pull(
	  conn,
	  lp.decode(),
	  pull.map((data) => RPC.decode(data)),
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
     * @returns {undefined}
     */
    _onRpc(idB58Str, rpc) {
        if(!rpc){
	    return
	}

	this.log('rpc from', idB58Str)
	const controlMsg = rpc.control
	
	if (!controlMsg) {
	    return
	}

	let iWant = this._handleIHave(idB58Str, controlMsg)
	let iHave = this._handleIWant(idB58Str, controlMsg)
	let prune = this._handleGraft(idB58Str, controlMsg)
	this._handlePrune(idB58Str, controlMsg)

	if(!(iWant || iWant.length) && !(iHave || iHave.length) && !(prune || prune.length)) {
	    return
	}
	

	let outRpc = this._rpcWithControl(ihave, null, iwant, null, prune)
        _sendRpc(rpc.from, outRpc) 	
    }

    /**
     * Returns a buffer of a RPC message that contains a control message
     *
     * @param {Array<RPC.Message>} msgs
     * @param {Array<RPC.ControlIHave>} ihave
     * @param {Array<RPC.ControlIWant>} iwant
     * @param {Array<RPC.ControlGraft>} graft
     * @param {Array<RPC.Prune>} prune
     *
     * @returns {Buffer}
     *
     */
    _rpcWithControl(msgs, ihave, iwant, graft, prune) {
        return RPC.encode({
	    msgs: msgs,
	    control: RPC.ControlMessage.encode({	
	        ihave: ihave,
                iwant: iwant,
	        graft: graft,
                prune: prune
            })
	})
    }

    /**
     * Handles IHAVE messages
     *
     * @param {Peer} peer
     * @param {RPC.control} controlRpc
     * 
     * @returns {RPC.ControlIWant}
     */
    _handleIHave(peer, controlRpc) {
        let iwant = new Set()

        let ihaveMsgs = controlRpc.ihave
	if(!ihaveMsgs) {
	    return
	}

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
	    return
	}

	this.log("IHAVE: Asking for %d messages from %s", iwant.length, peer.info.id.toB58String)
	let iwantlst = new Array(iwant.length)
	iwant.forEach(function(msgID) {
	    iwantlst.push(msgID)
	})
	
	return RPC.ControlIWant.encode({
		messageIDs: iwantlst
	})
    }

    /**
     * Handles IWANT messages
     *
     * @param {Peer} peer
     * @param {RPC.control} controlRpc
     *
     * @returns {Array<RPC.Message>}
     */
    _handleIWant(peer, controlRpc) {
	// @type {Map<string, RPC.Message>}
        let ihave = new Map()

	let iwantMsgs = controlRpc.iwant
	if (!iwantMsgs){
	   return
	}

	iwantMsgs.forEach(function(iwantMsg) {
	    let iwantMsgIDs = iwantMsg.MessageIDs
	    if(!(iwantMsgIDs || iwantMsgIDs.length)) {
	        return 
	    }

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

    /**
     * Handles Graft messages
     *
     * @param {Peer} peer
     * @param {RPC.control} controlRpc
     *
     * @return {Array<RPC.ControlPrune>}
     *
     */
    _handleGraft(peer, controlRpc) {
        let prune = []

	let grafts = controlRpc.graft
	if (!(grafts || grafts.length)) {
	    return
	}
        grafts.forEach(function(graft) {
	    let topic = graft.topicID
            let ok = this.mesh.has(topic)
            if (!ok) {
	        prune.push(topic)
	    } else {
	        this.log("GRAFT: Add mesh link from %s in %s", peer.info.id.toB58String, topic)
		let peers = this.mesh.get(topic)
		peers.add(peer)
		peer.topics.add(topic)

	    }
	})
	
	if(prune.length === 0) {
	    return
	}

	ctrlPrune = new Array(prune.length)

	const buildCtrlPruneMsg = (topic) => {
	    return RPC.ControlPrune.encode({
		    topicID: topic
	    })
	}

	ctrlPrune = prune.map(buildCtrlPruneMsg)
	return ctrlPrune
    }

    /**
     * Handles Prune messages
     *
     * @param {Peer} peer
     * @param {RPC.Control} controlRpc
     *
     * @returns undefined
     *
     */
    _handlePrune(peer, controlRpc) {
        let pruneMsgs = controlRpc.prune
        if(!(pruneMsgs || pruneMsgs.length)) {
	    return
	}

	pruneMsgs.forEach(function(prune){
	    let topic = prune.topicID
            let ok = this.mesh.has(topic)
            let peers = this.mesh.get(topic)
            if (ok) {
	        this.log("PRUNE: Remove mesh link to %s in %s", peer.info.id.toB58String, topic)
		peers.delete(peer)
		peers.topic.delete(topic)
	    }
	})
    }
    
    /**
     * Subscribes to a topic
     * @param {String}
     *
     */
   subscribe(topic) {
       assert(this.started, 'GossipSub has not started')
       if (this.mesh.has(topic)) {
           return
       }

       this.log("Join " + topic)

       let gossipSubPeers = this.fanout.get(topic)
       if(this.fanout.has(topic)) {
           this.mesh.set(topic, gossipSubPeers)
	   this.fanout.delete(topic)
	   this.lastpub.delete(topic)
       } else {
           gossipSubPeers = this._getPeers(topic, GossipSubD)
	   this.mesh.set(topic, gossipSubPeers)
       }

       gossipSubPeers.forEach((peer) => {
           this.log("JOIN: Add mesh link to %s in %s", peer.info.id.toB58String, topic)
	   this._sendGraft(peer, topic)
	   peer.topics.add(topic)
       })

       
   }

   /**
    * Leaves a topic
    * @param {String}
    *
    */
   unsubscribe(topic) {
       let ok = this.mesh.has(topic)
       let gmap = this.mesh.get(topic)
       if (!ok) {
           return
       }

       this.log("LEAVE %s", topic)

       this.mesh.delete(topic)

       for (let peer of gmap) {
           this.log("LEAVE: Remove mesh link to %s in %s", peer.info.id.toB58String, topic)
	   this._sendPrune(peer, topic)
	   this.peer.topics.delete(topic)
	   
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
       msg.topicIDs.forEach((topic) => {
           if (!this.topics.has(topic)) {
	       continue
	   }

	   let peersInTopic = this.topics.get(topic)
	   
	   // floodsub peers
	   peersInTopic.forEach((peer) => {
	       if (peer.info.protocols.has(FloodSubID)) {
	           tosend.add(peer)
	       }
	   })

	   // Gossipsub peers handling
	   if (!this.mesh.has(topic)) {
	       // We are not in the mesh for topic, use fanout peers
	       if (!this.fanout.has(topic)) {
	           // If we are not in the fanout, then pick any peers
		   let peers = this._getPeers(topic, GossipSubD)

		   if(peers.size > 0) {
		       this.fanout.set(topic, peers)
		   }
	       }
	       // Store the latest publishing time
	       this.lastpub.set(topic, _nowInNano())
	   }

	   let meshPeers = this.mesh.get(topic)
	   meshPeers.forEach((peer) => {
	       tosend.add(peer)
	   })
       })
       // Publish messages to peers
       tosend.forEach((peer) => {
           let peerId = peer.info.id.getB58Str()
	       if (peerId === from || peerId === msg.from) {
	       continue
	   }
	   peer.sendMessages(msg)
       })


   }

   /**
    * Sends a GRAFT message to a peer
    *
    * @param {Peer} peer 
    * @param {String} topic
    */
   _sendGraft(peer, topic) {
       let graft = [{
           topicID: topic
       }]

       let out = this._rpcWithControl(null, null, null, graft, null)
       if(peer && peer.isWritable()) {
           peer.write(out)
	   peer.sendSubscriptions([topic])
       }
   }

   _sendPrune(peer, topic) {
       let prune = [RPC.ControlPrune.encode({
           topicID: topic
       })]

       let out = _rpcWithControl(null, null, null, null, prune)
       if(peer && peer.isWritable()) {
          peer.write(out)
	  peer.sendUnsubscriptions([topic])
       }

   }

   _heartbeatTimer() {
   
   }

   /**
    * Maintains the mesh and fanout maps in gossipsub. 
    *
    */
   _heartbeat() {

       /**
	* @type {Map<Peer, Array<String>>}
	*/
       let tograft = new Map()
       let toprune = new Map()

       // maintain the mesh for topics we have joined
       for (let [topic, peers] of this.mesh) {
           
           // do we have enough peers?
	   if (peers.size < GossipSubDlo) {
	       let ineed = GossipSubD - peers.size
	       let peersSet = this._getPeers(topic, ineed)
	        peersSet.forEach((peer) => {
	            if (!peers.has(peer)) {
		        continue
		    }

	            this.log("HEARTBEAT: Add mesh link to %s in %s", peer.info.id.toB58Str, topic)
	            peers.add(peer)
	            peer.topics.add(topic)
	            tograft.set(peer, tograft.get(peer).push(topic))
	       })
	   }

	   // do we have to many peers?
	   if (peers.size > GossipSubDhi) {
	       let idontneed = peers.size - GossipSubD
	       let peersArray = new Array(peers)
	       peersArray = this_shufflePeers(peersArray)

	       let tmp = peersArray.slice(0, idontneed)
	       tmp.forEach((peer) => {
	           this.log("HEARTBEAT: Remove mesh link to %s in %s", peer.info.id.toB58Str, topic)
		   peers.delete(peer)
		   peer.topics.remove(topic)
		   toprune.set(peer, toprune.get(peer).push(topic))
	       })
	   }

	   this._emitGossip(topic, peers)
       }

       // expire fanout for topics we haven't published to in a while
       let now = this._nowInNano()
       this.lastpub.forEach((topic, lastpb) => {
           if ((lastpb + GossipSubFanoutTTL) < now) {
	       this.fanout.delete(topic)
	       this.lastpub.delete(topic)
	   }
       })

       // maintain our fanout for topics we are publishing but we have not joined
       this.fanout.forEach((topic, peers) => {
           // checks whether our peers are still in the topic
	   peers.forEach((peer) => {
	       if(this.topics.has(peer)) {
	           peers.delete(peer)
	       }
	   })

	   // do we need more peers?
	   if (peers.size < GossipSubD) {
	       let ineed = GossipSubD - peers.size
               peersSet = this._getPeers(topic, ineed)
	       peersSet.forEach((peer) => {
	            if(!peers.has(peer)) {
		        continue
		    }

		    peers.add(peer)
	       })
	     
	   }

	   this._emitGossip(topic, peers)
       })

       // advance the message history window
       this.messageCache.Shift()
       
   }

   _emitGossip(topic, peers) {
   
   }


   /**
    * Given a topic, returns up to count peers subscribed to that topic
    *
    * @param {String} topic
    * @param {Number} count
    *
    * @returns {Set<Peer>}
    *
    */
   _getPeers(topic, count) {
       if (!(this.topics.has(topic))) {
           return
       }

       // Adds all peers using GossipSub protocol
       let peersInTopic = this.topics.get(topic)
       let peers = new Array(peersInTopic.length)
       peersInTopic.forEach((peer) => {
           if(peer.info.protocols.has(GossipSubID)) {
	       peers.add(peer)
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

   _shufflePeers(peers) {
       for (let i = 0; i < peers.size; i++) {
           const randInt = () => {
	       return Math.floor(Math.random() * Math.floor(max))
	   }

	   let j = randInt()
	   peers[i], peers[j] = peers[j], peers[i]

	   return peers
       }
       
   }

   _nowInNano() {
       return Math.floor(Date.now/1000000)
   }

}

module.exports = GossipSub

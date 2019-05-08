/* eslint-disable valid-jsdoc */

'use strict'

const constants = require('./constants')
const errcode = require('err-code')

class Heartbeat {
  /**
   * @param {Object} gossipsub
   * @constructor
   */
  constructor (gossipsub) {
    this.gossipsub = gossipsub
  }

  start (callback) {
    if (this._heartbeatTimer) {
      const errMsg = 'Heartbeat timer is already running'
      this.gossipsub.log(errMsg)
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
      this.gossipsub.log(errMsg)
      throw errcode(new Error(errMsg), 'ERR_HEARTBEATIMER_NO_RUNNING')
    }
    this._heartbeatTimer.cancel(() => {
      this._heartbeatTimer = null
      callback()
    })
  }

  /**
   * Maintains the mesh and fanout maps in gossipsub.
   *
   * @returns {void}
   */
  _heartbeat () {
    // flush pending control message from retries and gossip
    // that hasn't been piggybacked since the last heartbeat
    this.gossipsub._flush()

    /**
     * @type {Map<Peer, Array<String>>}
     */
    const tograft = new Map()
    const toprune = new Map()

    // maintain the mesh for topics we have joined
    this.gossipsub.mesh.forEach((peers, topic) => {
      // do we have enough peers?
      if (peers.size < constants.GossipSubDlo) {
        const ineed = constants.GossipSubD - peers.size
        const peersSet = this.gossipsub._getPeers(topic, ineed)
        peersSet.forEach((peer) => {
          // add topic peers not already in mesh
          if (peers.has(peer)) {
            return
          }

          this.gossipsub.log('HEARTBEAT: Add mesh link to %s in %s', peer.info.id.toB58String(), topic)
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
        peersArray = this.gossipsub._shufflePeers(peersArray)

        const tmp = peersArray.slice(0, idontneed)
        tmp.forEach((peer) => {
          this.gossipsub.log('HEARTBEAT: Remove mesh link to %s in %s', peer.info.id.toB58String(), topic)
          peers.delete(peer)
          peer.topics.remove(topic)
          if (!toprune.has(peer)) {
            toprune.set(peer, [])
          }
          toprune.get(peer).push(topic)
        })
      }

      this.gossipsub._emitGossip(topic, peers)
    })

    // expire fanout for topics we haven't published to in a while
    const now = this.gossipsub._now()
    this.gossipsub.lastpub.forEach((topic, lastpb) => {
      if ((lastpb + constants.GossipSubFanoutTTL) < now) {
        this.gossipsub.fanout.delete(topic)
        this.gossipsub.lastpub.delete(topic)
      }
    })

    // maintain our fanout for topics we are publishing but we have not joined
    this.gossipsub.fanout.forEach((topic, peers) => {
      // checks whether our peers are still in the topic
      peers.forEach((peer) => {
        if (this.gossipsub.topics.has(peer)) {
          peers.delete(peer)
        }
      })

      // do we need more peers?
      if (peers.size < constants.GossipSubD) {
        const ineed = constants.GossipSubD - peers.size
        const peersSet = this.gossipsub._getPeers(topic, ineed)
        peersSet.forEach((peer) => {
          if (!peers.has(peer)) {
            return
          }

          peers.add(peer)
        })
      }

      this.gossipsub._emitGossip(topic, peers)
    })
    // send coalesced GRAFT/PRUNE messages (will piggyback gossip)
    this.gossipsub._sendGraftPrune(tograft, toprune)

    // advance the message history window
    this.gossipsub.messageCache.shift()

    this.gossipsub.emit('gossipsub:heartbeat')
  }
}

module.exports = Heartbeat

import * as constants from './constants'
import { getGossipPeers } from './getGossipPeers'
import { shuffle } from './utils'
import { Peer } from './peer'
import Gossipsub = require('./index')
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import errcode = require('err-code')

export class Heartbeat {
  gossipsub: Gossipsub
  _heartbeatTimer: {
    _intervalId: NodeJS.Timeout | undefined
    runPeriodically (fn: () => void, period: number): void
    cancel (): void
  } | null

  /**
   * @param {Object} gossipsub
   * @constructor
   */
  constructor (gossipsub: Gossipsub) {
    this.gossipsub = gossipsub
  }

  start (): void {
    if (this._heartbeatTimer) {
      const errMsg = 'Heartbeat timer is already running'
      this.gossipsub.log(errMsg)
      throw errcode(new Error(errMsg), 'ERR_HEARTBEAT_ALREADY_RUNNING')
    }

    const heartbeat = this._heartbeat.bind(this)

    const timeout = setTimeout(() => {
      heartbeat()
      this._heartbeatTimer!.runPeriodically(heartbeat, constants.GossipsubHeartbeatInterval)
    }, constants.GossipsubHeartbeatInitialDelay)

    this._heartbeatTimer = {
      _intervalId: undefined,
      runPeriodically: (fn, period) => {
        this._heartbeatTimer!._intervalId = setInterval(fn, period)
      },
      cancel: () => {
        clearTimeout(timeout)
        clearInterval(this._heartbeatTimer!._intervalId as NodeJS.Timeout)
      }
    }
  }

  /**
   * Unmounts the gossipsub protocol and shuts down every connection
   * @override
   * @returns {void}
   */
  stop (): void {
    if (!this._heartbeatTimer) {
      const errMsg = 'Heartbeat timer is not running'
      this.gossipsub.log(errMsg)
      throw errcode(new Error(errMsg), 'ERR_HEARTBEAT_NO_RUNNING')
    }

    this._heartbeatTimer.cancel()
    this._heartbeatTimer = null
  }

  /**
   * Maintains the mesh and fanout maps in gossipsub.
   *
   * @returns {void}
   */
  _heartbeat (): void {
    // flush pending control message from retries and gossip
    // that hasn't been piggybacked since the last heartbeat
    this.gossipsub._flush()

    // cache scores throught the heartbeat
    const scores = new Map<string, number>()
    const getScore = (id: string): number => {
      let s = scores.get(id)
      if (s === undefined) {
        s = this.gossipsub.score.score(id)
        scores.set(id, s)
      }
      return s
    }

    const tograft = new Map<Peer, string[]>()
    const toprune = new Map<Peer, string[]>()

    // maintain the mesh for topics we have joined
    this.gossipsub.mesh.forEach((peers, topic) => {
      // prune/graft helper functions (defined per topic)
      const prunePeer = (p: Peer): void => {
        const id = p.id.toB58String()
        this.gossipsub.log(
          'HEARTBEAT: Remove mesh link to %s in %s',
          id, topic
        )
        // update peer score
        this.gossipsub.score.prune(id, topic)
        // remove peer from mesh
        peers.delete(p)
        // add to toprune
        const topics = toprune.get(p)
        if (!topics) {
          toprune.set(p, [topic])
        } else {
          topics.push(topic)
        }
      }
      const graftPeer = (p: Peer): void => {
        const id = p.id.toB58String()
        this.gossipsub.log(
          'HEARTBEAT: Add mesh link to %s in %s',
          id, topic
        )
        // update peer score
        this.gossipsub.score.graft(id, topic)
        // add peer to mesh
        peers.add(p)
        // add to tograft
        const topics = tograft.get(p)
        if (!topics) {
          tograft.set(p, [topic])
        } else {
          topics.push(topic)
        }
      }

      // drop all peers with negative score
      peers.forEach(p => {
        const id = p.id.toB58String()
        const score = getScore(id)
        if (score < 0) {
          this.gossipsub.log(
            'HEARTBEAT: Prune peer %s with negative score: score=%d, topic=%s',
            id, score, topic
          )
          prunePeer(p)
        }
      })

      // do we have enough peers?
      if (peers.size < constants.GossipsubDlo) {
        const ineed = constants.GossipsubD - peers.size
        const peersSet = getGossipPeers(this.gossipsub, topic, ineed, p => {
          // filter out mesh peers, peers with negative score
          return !peers.has(p) && getScore(p.id.toB58String()) >= 0
        })

        peersSet.forEach(graftPeer)
      }

      // do we have to many peers?
      if (peers.size > constants.GossipsubDhi) {
        let peersArray = Array.from(peers)
        // sort by score
        peersArray.sort((a, b) => getScore(b.id.toB58String()) - getScore(a.id.toB58String()))
        // We keep the first D_score peers by score and the remaining up to D randomly
        // under the constraint that we keep D_out peers in the mesh (if we have that many)
        peersArray = peersArray.slice(0, constants.GossipsubDscore).concat(
          shuffle(peersArray.slice(constants.GossipsubDscore))
        )

        // count the outbound peers we are keeping
        let outbound = 0
        peersArray.slice(0, constants.GossipsubD).forEach(p => {
          if (this.gossipsub.outbound.get(p)) {
            outbound++
          }
        })

        // if it's less than D_out, bubble up some outbound peers from the random selection
        if (outbound < constants.GossipsubDout) {
          const rotate = (i: number): void => {
            // rotate the peersArray to the right and put the ith peer in the front
            const p = peersArray[i]
            for (let j = i; j > 0; j--) {
              peersArray[j] = peersArray[j - 1]
            }
            peersArray[0] = p
          }

          // first bubble up all outbound peers already in the selection to the front
          if (outbound > 0) {
            let ihave = outbound
            for (let i = 1; i < constants.GossipsubD && ihave > 0; i++) {
              if (this.gossipsub.outbound.get(peersArray[i])) {
                rotate(i)
                ihave--
              }
            }
          }

          // now bubble up enough outbound peers outside the selection to the front
          let ineed = constants.GossipsubD - outbound
          for (let i = constants.GossipsubD; i < peersArray.length && ineed > 0; i++) {
            if (this.gossipsub.outbound.get(peersArray[i])) {
              rotate(i)
              ineed--
            }
          }
        }

        // prune the excess peers
        peersArray.slice(0, constants.GossipsubD).forEach(prunePeer)
      }

      // do we have enough outbound peers?
      if (peers.size >= constants.GossipsubDlo) {
        // count the outbound peers we have
        let outbound = 0
        peers.forEach(p => {
          if (this.gossipsub.outbound.get(p)) {
            outbound++
          }
        })

        // if it's less than D_out, select some peers with outbound connections and graft them
        if (outbound < constants.GossipsubDout) {
          const ineed = constants.GossipsubDout - outbound
          getGossipPeers(this.gossipsub, topic, ineed, (p: Peer): boolean => {
            // filter our current mesh peers and peers with negative score
            return !peers.has(p) && getScore(p.id.toB58String()) >= 0
          }).forEach(graftPeer)
        }
      }

      this.gossipsub._emitGossip(topic, peers)
    })

    // expire fanout for topics we haven't published to in a while
    const now = this.gossipsub._now()
    this.gossipsub.lastpub.forEach((lastpb, topic) => {
      if ((lastpb + constants.GossipsubFanoutTTL) < now) {
        this.gossipsub.fanout.delete(topic)
        this.gossipsub.lastpub.delete(topic)
      }
    })

    // maintain our fanout for topics we are publishing but we have not joined
    this.gossipsub.fanout.forEach((peers, topic) => {
      // checks whether our peers are still in the topic
      const topicGossip = this.gossipsub.topics.get(topic)
      peers.forEach((peer) => {
        if (topicGossip!.has(peer)) {
          peers.delete(peer)
        }
      })

      // do we need more peers?
      if (peers.size < constants.GossipsubD) {
        const ineed = constants.GossipsubD - peers.size
        const peersSet = getGossipPeers(this.gossipsub, topic, ineed)
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

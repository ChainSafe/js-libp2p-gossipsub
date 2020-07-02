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
    this.gossipsub.heartbeatTicks++

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

    // clean up expired backoffs
    this.gossipsub._clearBackoff()

    // ensure direct peers are connected
    this.gossipsub._directConnect()

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
        // add prune backoff record
        this.gossipsub._addBackoff(id, topic)
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
        const backoff = this.gossipsub.backoff.get(topic)
        const ineed = constants.GossipsubD - peers.size
        const peersSet = getGossipPeers(this.gossipsub, topic, ineed, p => {
          const id = p.id.toB58String()
          // filter out mesh peers, direct peers, peers we are backing off, peers with negative score
          return !peers.has(p) && !this.gossipsub.direct.has(id) && (!backoff || !backoff.has(id)) && getScore(id) >= 0
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
          const backoff = this.gossipsub.backoff.get(topic)
          getGossipPeers(this.gossipsub, topic, ineed, (p: Peer): boolean => {
            const id = p.id.toB58String()
            // filter our current mesh peers, direct peers, peers we are backing off, peers with negative score
            return !peers.has(p) && !this.gossipsub.direct.has(id) && (!backoff || !backoff.has(id)) && getScore(id) >= 0
          }).forEach(graftPeer)
        }
      }

      // should we try to improve the mesh with opportunistic grafting?
      if (this.gossipsub.heartbeatTicks % constants.GossipsubOpportunisticGraftTicks === 0 && peers.size > 1) {
        // Opportunistic grafting works as follows: we check the median score of peers in the
        // mesh; if this score is below the opportunisticGraftThreshold, we select a few peers at
        // random with score over the median.
        // The intention is to (slowly) improve an underperforming mesh by introducing good
        // scoring peers that may have been gossiping at us. This allows us to get out of sticky
        // situations where we are stuck with poor peers and also recover from churn of good peers.

        // now compute the median peer score in the mesh
        const peersList = Array.from(peers)
          .sort((a, b) => getScore(a.id.toB58String()) - getScore(b.id.toB58String()))
        const medianIndex = peers.size / 2
        const medianScore = getScore(peersList[medianIndex].id.toB58String())

        // if the median score is below the threshold, select a better peer (if any) and GRAFT
        if (medianScore < this.gossipsub._options.scoreThresholds.opportunisticGraftThreshold) {
          const backoff = this.gossipsub.backoff.get(topic)
          const peersToGraft = getGossipPeers(this.gossipsub, topic, constants.GossipsubOpportunisticGraftPeers, (p: Peer): boolean => {
            const id = p.id.toB58String()
            // filter out current mesh peers, direct peers, peers we are backing off, peers below or at threshold
            return peers.has(p) && !this.gossipsub.direct.has(id) && (!backoff || !backoff.has(id)) && getScore(id) > medianScore
          })
          peersToGraft.forEach(p => {
            this.gossipsub.log(
              'HEARTBEAT: Opportunistically graft peer %s on topic %s',
              p.id.toB58String(), topic
            )
            graftPeer(p)
          })
        }
      }

      // 2nd arg are mesh peers excluded from gossip. We have already pushed
      // messages to them, so its redundant to gossip IHAVEs.
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
    this.gossipsub.fanout.forEach((fanoutPeers, topic) => {
      // checks whether our peers are still in the topic and have a score above the publish threshold
      const topicPeers = this.gossipsub.topics.get(topic)
      fanoutPeers.forEach(p => {
        if (
          !topicPeers!.has(p) ||
          getScore(p.id.toB58String()) < this.gossipsub._options.scoreThresholds.publishThreshold
        ) {
          fanoutPeers.delete(p)
        }
      })

      // do we need more peers?
      if (fanoutPeers.size < constants.GossipsubD) {
        const ineed = constants.GossipsubD - fanoutPeers.size
        const peersSet = getGossipPeers(this.gossipsub, topic, ineed, (p: Peer): boolean => {
          const id = p.id.toB58String()
          // filter out existing fanout peers, direct peers, and peers with score above the publish threshold
          return !fanoutPeers.has(p) &&
            !this.gossipsub.direct.has(id) &&
            getScore(id) >= this.gossipsub._options.scoreThresholds.publishThreshold
        })
        peersSet.forEach(p => {
          fanoutPeers.add(p)
        })
      }

      // 2nd arg are fanout peers excluded from gossip.
      // We have already pushed messages to them, so its redundant to gossip IHAVEs
      this.gossipsub._emitGossip(topic, fanoutPeers)
    })

    // send coalesced GRAFT/PRUNE messages (will piggyback gossip)
    this.gossipsub._sendGraftPrune(tograft, toprune)

    // flush pending gossip that wasn't piggybacked above
    this.gossipsub._flush()

    // advance the message history window
    this.gossipsub.messageCache.shift()

    this.gossipsub.emit('gossipsub:heartbeat')
  }
}

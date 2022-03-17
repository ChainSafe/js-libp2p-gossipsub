import { PeerScoreParams, validatePeerScoreParams } from './peer-score-params'
import { PeerStats, createPeerStats, ensureTopicStats } from './peer-stats'
import { computeScore } from './compute-score'
import { MessageDeliveries, DeliveryRecordStatus } from './message-deliveries'
import PeerId from 'peer-id'
import ConnectionManager from 'libp2p/src/connection-manager'
import debug from 'debug'
import { MsgIdStr, PeerIdStr, RejectReason, TopicStr } from '../types'
import { Metrics, ScorePenalty } from '../metrics'

const log = debug('libp2p:gossipsub:score')
type IPStr = string

interface ScoreCacheEntry {
  /** The cached score, null if not cached */
  score: number | null
  /** Unix timestamp in miliseconds, the time after which the cached score for a peer is no longer valid */
  cacheUntil: number
}

export class PeerScore {
  /**
   * Per-peer stats for score calculation
   */
  readonly peerStats: Map<PeerIdStr, PeerStats>
  /**
   * IP colocation tracking; maps IP => set of peers.
   */
  readonly peerIPs: Map<PeerIdStr, Set<IPStr>>
  /**
   * Cache score up to decayInterval if topic stats are unchanged.
   */
  readonly scoreCache: Map<PeerIdStr, ScoreCacheEntry>
  /**
   * Recent message delivery timing/participants
   */
  readonly deliveryRecords: MessageDeliveries
  _backgroundInterval?: NodeJS.Timeout

  constructor(
    readonly params: PeerScoreParams,
    private readonly connectionManager: ConnectionManager,
    private readonly metrics: Metrics | null
  ) {
    validatePeerScoreParams(params)
    this.params = params
    this.peerStats = new Map()
    this.peerIPs = new Map()
    this.scoreCache = new Map()
    this.deliveryRecords = new MessageDeliveries()
  }

  get size(): number {
    return this.peerStats.size
  }

  /**
   * Start PeerScore instance
   */
  start(): void {
    if (this._backgroundInterval) {
      log('Peer score already running')
      return
    }
    this._backgroundInterval = setInterval(() => this.background(), this.params.decayInterval)
    log('started')
  }

  /**
   * Stop PeerScore instance
   */
  stop(): void {
    if (!this._backgroundInterval) {
      log('Peer score already stopped')
      return
    }
    clearInterval(this._backgroundInterval)
    delete this._backgroundInterval
    this.peerIPs.clear()
    this.peerStats.clear()
    this.deliveryRecords.clear()
    log('stopped')
  }

  /**
   * Periodic maintenance
   */
  background(): void {
    this._refreshScores()
    this._updateIPs()
    this.deliveryRecords.gc()
  }

  /**
   * Decays scores, and purges score records for disconnected peers once their expiry has elapsed.
   */
  _refreshScores(): void {
    const now = Date.now()
    const decayToZero = this.params.decayToZero

    this.peerStats.forEach((pstats, id) => {
      if (!pstats.connected) {
        // has the retention perious expired?
        if (now > pstats.expire) {
          // yes, throw it away (but clean up the IP tracking first)
          this._removeIPs(id, pstats.ips)
          this.peerStats.delete(id)
        }

        // we don't decay retained scores, as the peer is not active.
        // this way the peer cannot reset a negative score by simply disconnecting and reconnecting,
        // unless the retention period has ellapsed.
        // similarly, a well behaved peer does not lose its score by getting disconnected.
        return
      }

      Object.entries(pstats.topics).forEach(([topic, tstats]) => {
        const tparams = this.params.topics[topic]
        if (!tparams) {
          // we are not scoring this topic
          // should be unreachable, we only add scored topics to pstats
          return
        }

        // decay counters
        tstats.firstMessageDeliveries *= tparams.firstMessageDeliveriesDecay
        if (tstats.firstMessageDeliveries < decayToZero) {
          tstats.firstMessageDeliveries = 0
        }
        tstats.meshMessageDeliveries *= tparams.meshMessageDeliveriesDecay
        if (tstats.meshMessageDeliveries < decayToZero) {
          tstats.meshMessageDeliveries = 0
        }
        tstats.meshFailurePenalty *= tparams.meshFailurePenaltyDecay
        if (tstats.meshFailurePenalty < decayToZero) {
          tstats.meshFailurePenalty = 0
        }
        tstats.invalidMessageDeliveries *= tparams.invalidMessageDeliveriesDecay
        if (tstats.invalidMessageDeliveries < decayToZero) {
          tstats.invalidMessageDeliveries = 0
        }
        // update mesh time and activate mesh message delivery parameter if need be
        if (tstats.inMesh) {
          tstats.meshTime = now - tstats.graftTime
          if (tstats.meshTime > tparams.meshMessageDeliveriesActivation) {
            tstats.meshMessageDeliveriesActive = true
          }
        }
      })
      // decay P7 counter
      pstats.behaviourPenalty *= this.params.behaviourPenaltyDecay
      if (pstats.behaviourPenalty < decayToZero) {
        pstats.behaviourPenalty = 0
      }

      this.scoreCache.set(id, { score: null, cacheUntil: 0 })
    })
  }

  /**
   * Return the score for a peer
   */
  score(id: PeerIdStr): number {
    this.metrics?.scoreFnCalls.inc()

    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return 0
    }

    const now = Date.now()
    let cacheEntry = this.scoreCache.get(id)
    if (cacheEntry === undefined) {
      cacheEntry = { score: null, cacheUntil: 0 }
      this.scoreCache.set(id, cacheEntry)
    }

    const { score, cacheUntil } = cacheEntry
    if (cacheUntil > now && score !== null) {
      return score
    }

    this.metrics?.scoreFnRuns.inc()

    cacheEntry.score = computeScore(id, pstats, this.params, this.peerIPs)
    // decayInterval is used to refresh score so we don't want to cache more than that
    cacheEntry.cacheUntil = now + this.params.decayInterval
    return cacheEntry.score
  }

  /**
   * Apply a behavioural penalty to a peer
   */
  addPenalty(id: PeerIdStr, penalty: number, penaltyLabel: ScorePenalty): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }
    pstats.behaviourPenalty += penalty
    this.scoreCache.set(id, { score: null, cacheUntil: 0 })
    this.metrics?.onScorePenalty(penaltyLabel)
  }

  addPeer(id: PeerIdStr): void {
    // create peer stats (not including topic stats for each topic to be scored)
    // topic stats will be added as needed
    const pstats = createPeerStats({
      connected: true
    })
    this.peerStats.set(id, pstats)

    // get + update peer IPs
    const ips = this._getIPs(id)
    this._setIPs(id, ips, pstats.ips)
    pstats.ips = ips
  }

  removePeer(id: PeerIdStr): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    // decide whether to retain the score; this currently only retains non-positive scores
    // to dissuade attacks on the score function.
    if (this.score(id) > 0) {
      this._removeIPs(id, pstats.ips)
      this.peerStats.delete(id)
      return
    }

    // delete score cache
    this.scoreCache.delete(id)

    // furthermore, when we decide to retain the score, the firstMessageDelivery counters are
    // reset to 0 and mesh delivery penalties applied.
    Object.entries(pstats.topics).forEach(([topic, tstats]) => {
      tstats.firstMessageDeliveries = 0

      const threshold = this.params.topics[topic].meshMessageDeliveriesThreshold
      if (tstats.inMesh && tstats.meshMessageDeliveriesActive && tstats.meshMessageDeliveries < threshold) {
        const deficit = threshold - tstats.meshMessageDeliveries
        tstats.meshFailurePenalty += deficit * deficit
      }

      tstats.inMesh = false
    })

    pstats.connected = false
    pstats.expire = Date.now() + this.params.retainScore
  }

  graft(id: PeerIdStr, topic: TopicStr): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    const tstats = ensureTopicStats(topic, pstats, this.params)
    if (!tstats) {
      return
    }

    tstats.inMesh = true
    tstats.graftTime = Date.now()
    tstats.meshTime = 0
    tstats.meshMessageDeliveriesActive = false
    this.scoreCache.set(id, { score: null, cacheUntil: 0 })
  }

  prune(id: PeerIdStr, topic: TopicStr): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    const tstats = ensureTopicStats(topic, pstats, this.params)
    if (!tstats) {
      return
    }

    // sticky mesh delivery rate failure penalty
    const threshold = this.params.topics[topic].meshMessageDeliveriesThreshold
    if (tstats.meshMessageDeliveriesActive && tstats.meshMessageDeliveries < threshold) {
      const deficit = threshold - tstats.meshMessageDeliveries
      tstats.meshFailurePenalty += deficit * deficit
    }
    tstats.inMesh = false
    this.scoreCache.set(id, { score: null, cacheUntil: 0 })
  }

  validateMessage(msgIdStr: MsgIdStr): void {
    this.deliveryRecords.ensureRecord(msgIdStr)
  }

  deliverMessage(from: PeerIdStr, msgIdStr: MsgIdStr, topic: TopicStr): void {
    this._markFirstMessageDelivery(from, topic)

    const drec = this.deliveryRecords.ensureRecord(msgIdStr)
    const now = Date.now()

    // defensive check that this is the first delivery trace -- delivery status should be unknown
    if (drec.status !== DeliveryRecordStatus.unknown) {
      log(
        'unexpected delivery: message from %s was first seen %s ago and has delivery status %d',
        from,
        now - drec.firstSeen,
        DeliveryRecordStatus[drec.status]
      )
      return
    }

    // mark the message as valid and reward mesh peers that have already forwarded it to us
    drec.status = DeliveryRecordStatus.valid
    drec.validated = now
    drec.peers.forEach((p) => {
      // this check is to make sure a peer can't send us a message twice and get a double count
      // if it is a first delivery.
      if (p !== from) {
        this._markDuplicateMessageDelivery(p, topic)
      }
    })
  }

  /**
   * Similar to `rejectMessage` except does not require the message id or reason for an invalid message.
   */
  rejectInvalidMessage(from: PeerIdStr, topic: TopicStr): void {
    this._markInvalidMessageDelivery(from, topic)
  }

  rejectMessage(from: PeerIdStr, msgIdStr: MsgIdStr, topic: TopicStr, reason: RejectReason): void {
    switch (reason) {
      // these messages are not tracked, but the peer is penalized as they are invalid
      case RejectReason.Error:
        this._markInvalidMessageDelivery(from, topic)
        return

      // we ignore those messages, so do nothing.
      case RejectReason.Blacklisted:
        return

      // the rest are handled after record creation
    }

    const drec = this.deliveryRecords.ensureRecord(msgIdStr)

    // defensive check that this is the first rejection -- delivery status should be unknown
    if (drec.status !== DeliveryRecordStatus.unknown) {
      log(
        'unexpected rejection: message from %s was first seen %s ago and has delivery status %d',
        from,
        Date.now() - drec.firstSeen,
        DeliveryRecordStatus[drec.status]
      )
      return
    }

    switch (reason) {
      case RejectReason.Ignore:
        // we were explicitly instructed by the validator to ignore the message but not penalize the peer
        drec.status = DeliveryRecordStatus.ignored
        return
    }

    // mark the message as invalid and penalize peers that have already forwarded it.
    drec.status = DeliveryRecordStatus.invalid

    this._markInvalidMessageDelivery(from, topic)
    drec.peers.forEach((p) => {
      this._markInvalidMessageDelivery(p, topic)
    })
  }

  duplicateMessage(from: PeerIdStr, msgIdStr: MsgIdStr, topic: TopicStr): void {
    const drec = this.deliveryRecords.ensureRecord(msgIdStr)

    if (drec.peers.has(from)) {
      // we have already seen this duplicate
      return
    }

    switch (drec.status) {
      case DeliveryRecordStatus.unknown:
        // the message is being validated; track the peer delivery and wait for
        // the Deliver/Reject/Ignore notification.
        drec.peers.add(from)
        break
      case DeliveryRecordStatus.valid:
        // mark the peer delivery time to only count a duplicate delivery once.
        drec.peers.add(from)
        this._markDuplicateMessageDelivery(from, topic, drec.validated)
        break
      case DeliveryRecordStatus.invalid:
        // we no longer track delivery time
        this._markInvalidMessageDelivery(from, topic)
        break
    }
  }

  /**
   * Increments the "invalid message deliveries" counter for all scored topics the message is published in.
   */
  _markInvalidMessageDelivery(from: PeerIdStr, topic: TopicStr): void {
    const pstats = this.peerStats.get(from)
    if (!pstats) {
      return
    }

    const tstats = ensureTopicStats(topic, pstats, this.params)
    if (!tstats) {
      return
    }

    tstats.invalidMessageDeliveries += 1

    this.scoreCache.set(from, { score: null, cacheUntil: 0 })
  }

  /**
   * Increments the "first message deliveries" counter for all scored topics the message is published in,
   * as well as the "mesh message deliveries" counter, if the peer is in the mesh for the topic.
   */
  _markFirstMessageDelivery(from: PeerIdStr, topic: TopicStr): void {
    const pstats = this.peerStats.get(from)
    if (!pstats) {
      return
    }

    const tstats = ensureTopicStats(topic, pstats, this.params)
    if (!tstats) {
      return
    }

    let cap = this.params.topics[topic].firstMessageDeliveriesCap
    tstats.firstMessageDeliveries += 1
    if (tstats.firstMessageDeliveries > cap) {
      tstats.firstMessageDeliveries = cap
    }

    if (!tstats.inMesh) {
      return
    }

    cap = this.params.topics[topic].meshMessageDeliveriesCap
    tstats.meshMessageDeliveries += 1
    if (tstats.meshMessageDeliveries > cap) {
      tstats.meshMessageDeliveries = cap
    }

    this.scoreCache.set(from, { score: null, cacheUntil: 0 })
  }

  /**
   * Increments the "mesh message deliveries" counter for messages we've seen before,
   * as long the message was received within the P3 window.
   */
  _markDuplicateMessageDelivery(from: PeerIdStr, topic: TopicStr, validatedTime = 0): void {
    const pstats = this.peerStats.get(from)
    if (!pstats) {
      return
    }

    const now = validatedTime ? Date.now() : 0

    const tstats = ensureTopicStats(topic, pstats, this.params)
    if (!tstats) {
      return
    }

    if (!tstats.inMesh) {
      return
    }

    const tparams = this.params.topics[topic]

    // check against the mesh delivery window -- if the validated time is passed as 0, then
    // the message was received before we finished validation and thus falls within the mesh
    // delivery window.
    if (validatedTime && now > validatedTime + tparams.meshMessageDeliveriesWindow) {
      return
    }

    const cap = tparams.meshMessageDeliveriesCap
    tstats.meshMessageDeliveries += 1
    if (tstats.meshMessageDeliveries > cap) {
      tstats.meshMessageDeliveries = cap
    }

    this.scoreCache.set(from, { score: null, cacheUntil: 0 })
  }

  /**
   * Gets the current IPs for a peer.
   */
  _getIPs(id: PeerIdStr): IPStr[] {
    // TODO: Optimize conversions
    const peerId = PeerId.createFromB58String(id)

    // PeerId.createFromB58String(id)

    return this.connectionManager.getAll(peerId).map((c) => c.remoteAddr.toOptions().host)
  }

  /**
   * Adds tracking for the new IPs in the list, and removes tracking from the obsolete IPs.
   */
  _setIPs(id: PeerIdStr, newIPs: IPStr[], oldIPs: IPStr[]): void {
    // add the new IPs to the tracking
    // eslint-disable-next-line no-labels
    addNewIPs: for (const ip of newIPs) {
      // check if it is in the old ips list
      for (const xip of oldIPs) {
        if (ip === xip) {
          // eslint-disable-next-line no-labels
          continue addNewIPs
        }
      }
      // no, it's a new one -- add it to the tracker
      let peers = this.peerIPs.get(ip)
      if (!peers) {
        peers = new Set()
        this.peerIPs.set(ip, peers)
      }
      peers.add(id)
    }
    // remove the obsolete old IPs from the tracking
    // eslint-disable-next-line no-labels
    removeOldIPs: for (const ip of oldIPs) {
      // check if it is in the new ips list
      for (const xip of newIPs) {
        if (ip === xip) {
          // eslint-disable-next-line no-labels
          continue removeOldIPs
        }
      }
      // no, its obselete -- remove it from the tracker
      const peers = this.peerIPs.get(ip)
      if (!peers) {
        continue
      }
      peers.delete(id)
      if (!peers.size) {
        this.peerIPs.delete(ip)
      }
    }

    this.scoreCache.set(id, { score: null, cacheUntil: 0 })
  }

  /**
   * Removes an IP list from the tracking list for a peer.
   */
  _removeIPs(id: PeerIdStr, ips: IPStr[]): void {
    ips.forEach((ip) => {
      const peers = this.peerIPs.get(ip)
      if (!peers) {
        return
      }

      peers.delete(id)
      if (!peers.size) {
        this.peerIPs.delete(ip)
      }
    })

    this.scoreCache.set(id, { score: null, cacheUntil: 0 })
  }

  /**
   * Update all peer IPs to currently open connections
   */
  _updateIPs(): void {
    this.peerStats.forEach((pstats, id) => {
      const newIPs = this._getIPs(id)
      this._setIPs(id, newIPs, pstats.ips)
      pstats.ips = newIPs
      this.scoreCache.set(id, { score: null, cacheUntil: 0 })
    })
  }
}

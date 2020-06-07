import { Message } from '../message'
import { PeerScoreParams, validatePeerScoreParams } from './peerScoreParams'
import { PeerStats, createPeerStats, ensureTopicStats } from './peerStats'
import { computeScore } from './computeScore'
import { MessageDeliveries, DeliveryRecordStatus } from './messageDeliveries'
import PeerId = require('peer-id')
import Multiaddr = require('multiaddr')
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import debug = require('debug')

const log = debug('libp2p:gossipsub:score')

interface AddressBook {
  getMultiaddrsForPeer(id: PeerId): Multiaddr[]
  // eslint-disable-next-line @typescript-eslint/ban-types
  on(evt: string, fn: Function): void
  // eslint-disable-next-line @typescript-eslint/ban-types
  off(evt: string, fn: Function): void
}

export class PeerScore {
  /**
   * The score parameters
   */
  params: PeerScoreParams
  /**
   * Per-peer stats for score calculation
   */
  peerStats: Map<PeerId, PeerStats>
  /**
   * IP colocation tracking; maps IP => set of peers.
   */
  peerIPs: Map<string, Set<PeerId>>
  /**
   * Recent message delivery timing/participants
   */
  deliveryRecords: MessageDeliveries
  /**
   * Message ID function
   */
  msgId: (message: Message) => string
  _addressBook: AddressBook
  _backgroundInterval: NodeJS.Timeout

  constructor (params: PeerScoreParams, addressBook: AddressBook, msgId: (message: Message) => string) {
    validatePeerScoreParams(params)
    this.params = params
    this._addressBook = addressBook
    this.peerStats = new Map()
    this.peerIPs = new Map()
    this.deliveryRecords = new MessageDeliveries()
    this.msgId = msgId
  }

  /**
   * Start PeerScore instance
   * @returns {void}
   */
  start (): void {
    if (this._backgroundInterval) {
      throw new Error('Peer score already running')
    }
    this._backgroundInterval = setInterval(() => this.background(), this.params.decayInterval)
    this._addressBook.on('change:multiaddrs', this._updateIPs)
  }

  /**
   * Stop PeerScore instance
   * @returns {void}
   */
  stop (): void {
    if (!this._backgroundInterval) {
      throw new Error('Peer store already stopped')
    }
    clearInterval(this._backgroundInterval)
    delete this._backgroundInterval
    this._addressBook.off('change:multiaddrs', this._updateIPs)
  }

  /**
   * Periodic maintenance
   * @returns {void}
   */
  background (): void {
    this._refreshScores()
    this.deliveryRecords.gc()
  }

  /**
   * Decays scores, and purges score records for disconnected peers once their expiry has elapsed.
   * @returns {void}
   */
  _refreshScores (): void {
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
    })
  }

  /**
   * @param {PeerId} id
   * @returns {Number}
   */
  score (id: PeerId): number {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return 0
    }
    return computeScore(id, pstats, this.params, this.peerIPs)
  }

  /**
   * @param {PeerId} id
   * @param {Number} penalty
   * @returns {void}
   */
  addPenalty (id: PeerId, penalty: number): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }
    pstats.behaviourPenalty += penalty
  }

  /**
   * @param {PeerId} id
   * @returns {void}
   */
  addPeer (id: PeerId): void {
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

  /**
   * @param {PeerId} id
   * @returns {void}
   */
  removePeer (id: PeerId): void {
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

  /**
   * @param {PeerId} id
   * @param {String} topic
   * @returns {void}
   */
  graft (id: PeerId, topic: string): void {
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
  }

  /**
   * @param {PeerId} id
   * @param {String} topic
   * @returns {void}
   */
  prune (id: PeerId, topic: string): void {
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
  }

  /**
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  validateMessage (id: PeerId, message: Message): void {
    this.deliveryRecords.ensureRecord(this.msgId(message))
  }

  /**
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  deliverMessage (id: PeerId, message: Message): void {
    this._markFirstMessageDelivery(id, message)

    const drec = this.deliveryRecords.ensureRecord(this.msgId(message))
    const now = Date.now()

    // defensive check that this is the first delivery trace -- delivery status should be unknown
    if (drec.status !== DeliveryRecordStatus.unknown) {
      log(
        'unexpected delivery: message from %s was first seen %s ago and has delivery status %d',
        id.toB58String(), now - drec.firstSeen, DeliveryRecordStatus[drec.status]
      )
      return
    }

    // mark the message as valid and reward mesh peers that have already forwarded it to us
    drec.status = DeliveryRecordStatus.valid
    drec.validated = now
    if (drec.peers.has(id)) {
      // this check is to make sure a peer can't send us a message twice and get a double count
      // if it is a first delivery.
      this._markDuplicateMessageDelivery(id, message)
    }
  }

  /**
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  rejectMessage (id: PeerId, message: Message): void {
    const drec = this.deliveryRecords.ensureRecord(this.msgId(message))

    // defensive check that this is the first rejection -- delivery status should be unknown
    if (drec.status !== DeliveryRecordStatus.unknown) {
      log(
        'unexpected rejection: message from %s was first seen %s ago and has delivery status %d',
        id.toB58String(), Date.now() - drec.firstSeen, DeliveryRecordStatus[drec.status]
      )
      return
    }

    // mark the message as invalid and penalize peers that have already forwarded it.
    drec.status = DeliveryRecordStatus.invalid

    this._markInvalidMessageDelivery(id, message)
    drec.peers.forEach(p => {
      this._markInvalidMessageDelivery(p, message)
    })
  }

  /**
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  ignoreMessage (id: PeerId, message: Message): void {
    const drec = this.deliveryRecords.ensureRecord(this.msgId(message))

    // defensive check that this is the first ignore -- delivery status should be unknown
    if (drec.status !== DeliveryRecordStatus.unknown) {
      log(
        'unexpected ignore: message from %s was first seen %s ago and has delivery status %d',
        id.toB58String(), Date.now() - drec.firstSeen, DeliveryRecordStatus[drec.status]
      )
      return
    }

    // mark the message as invalid and penalize peers that have already forwarded it.
    drec.status = DeliveryRecordStatus.ignored
  }

  /**
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  duplicateMessage (id: PeerId, message: Message): void {
    const drec = this.deliveryRecords.ensureRecord(this.msgId(message))

    if (drec.peers.has(id)) {
      // we have already seen this duplicate
      return
    }

    switch (drec.status) {
      case DeliveryRecordStatus.unknown:
        // the message is being validated; track the peer delivery and wait for
        // the Deliver/Reject/Ignore notification.
        drec.peers.add(id)
        break
      case DeliveryRecordStatus.valid:
        // mark the peer delivery time to only count a duplicate delivery once.
        drec.peers.add(id)
        this._markDuplicateMessageDelivery(id, message, drec.validated)
        break
      case DeliveryRecordStatus.invalid:
        // we no longer track delivery time
        this._markInvalidMessageDelivery(id, message)
        break
    }
  }

  /**
   * Increments the "invalid message deliveries" counter for all scored topics the message is published in.
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  _markInvalidMessageDelivery (id: PeerId, message: Message): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    message.topicIDs.forEach(topic => {
      const tstats = ensureTopicStats(topic, pstats, this.params)
      if (!tstats) {
        return
      }

      tstats.invalidMessageDeliveries += 1
    })
  }

  /**
   * Increments the "first message deliveries" counter for all scored topics the message is published in,
   * as well as the "mesh message deliveries" counter, if the peer is in the mesh for the topic.
   * @param {PeerId} id
   * @param {Message} message
   * @returns {void}
   */
  _markFirstMessageDelivery (id: PeerId, message: Message): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    message.topicIDs.forEach(topic => {
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
    })
  }

  /**
   * Increments the "mesh message deliveries" counter for messages we've seen before,
   * as long the message was received within the P3 window.
   * @param {PeerId} id
   * @param {Message} message
   * @param {number} validatedTime
   * @returns {void}
   */
  _markDuplicateMessageDelivery (id: PeerId, message: Message, validatedTime = 0): void {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    const now = validatedTime ? Date.now() : 0

    message.topicIDs.forEach(topic => {
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
    })
  }

  /**
   * Gets the current IPs for a peer.
   * @param {PeerId} id
   * @returns {Array<string>}
   */
  _getIPs (id: PeerId): string[] {
    return this._addressBook.getMultiaddrsForPeer(id)
      .map(ma => {
        return ma.toOptions().host
      })
  }

  /**
   * Called as a callback to addressbook updates
   * @param {PeerId} id
   * @param {Array<Multiaddr>} multiaddrs
   * @returns {void}
   */
  _updateIPs = (id: PeerId, multiaddrs: Multiaddr[]): void => {
    const pstats = this.peerStats.get(id)
    if (!pstats) {
      return
    }

    this._setIPs(id, multiaddrs.map(ma => ma.toOptions().host), pstats.ips)
  }

  /**
   * Adds tracking for the new IPs in the list, and removes tracking from the obsolete IPs.
   * @param {PeerId} id
   * @param {Array<string>} newIPs
   * @param {Array<string>} oldIPs
   * @returns {void}
   */
  _setIPs (id: PeerId, newIPs: string[], oldIPs: string[]): void {
    // add the new IPs to the tracking
    // eslint-disable-next-line no-labels
    addNewIPs:
    for (const ip of newIPs) {
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
    removeOldIPs:
    for (const ip of oldIPs) {
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
  }

  /**
   * Removes an IP list from the tracking list for a peer.
   * @param {PeerId} id
   * @param {Array<string>} ips
   * @returns {void}
   */
  _removeIPs (id: PeerId, ips: string[]): void {
    ips.forEach(ip => {
      const peers = this.peerIPs.get(ip)
      if (!peers) {
        return
      }

      peers.delete(id)
      if (!peers.size) {
        this.peerIPs.delete(ip)
      }
    })
  }
}

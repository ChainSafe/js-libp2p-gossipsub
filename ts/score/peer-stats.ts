import { TopicStr } from '../types'
import { PeerScoreParams } from './peer-score-params'

export type IPeerStats = {
  connected: boolean
  expire: number
  topics: Record<TopicStr, TopicStats>
  ips: string[]
  behaviourPenalty: number
}

export class PeerStats {
  /** true if the peer is currently connected */
  connected = false
  /** expiration time of the score stats for disconnected peers */
  expire = 0
  /** per topic stats */
  topics = new Map<TopicStr, TopicStats>()
  /** IP tracking; store as string for easy processing */
  ips: string[] = []
  /** behavioural pattern penalties (applied by the router) */
  behaviourPenalty = 0

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly params: PeerScoreParams, connected: boolean) {
    this.connected = connected
  }

  /**
   * Returns topic stats if they exist, otherwise if the supplied parameters score the
   * topic, inserts the default stats and returns a reference to those. If neither apply, returns None.
   */
  topicStats(topic: TopicStr): TopicStats | null {
    let topicStats = this.topics.get(topic)

    if (topicStats) {
      return topicStats
    }

    if (this.params.topics[topic]) {
      topicStats = {
        inMesh: false,
        graftTime: 0,
        meshTime: 0,
        firstMessageDeliveries: 0,
        meshMessageDeliveries: 0,
        meshMessageDeliveriesActive: false,
        meshFailurePenalty: 0,
        invalidMessageDeliveries: 0
      }
      this.topics.set(topic, topicStats)

      return topicStats
    }

    return null
  }
}

export interface TopicStats {
  /** true if the peer is in the mesh */
  inMesh: boolean
  /** time when the peer was (last) GRAFTed; valid only when in mesh */
  graftTime: number
  /** time in mesh (updated during refresh/decay to avoid calling gettimeofday on every score invocation) */
  meshTime: number
  /** first message deliveries */
  firstMessageDeliveries: number
  /** mesh message deliveries */
  meshMessageDeliveries: number
  /** true if the peer has been enough time in the mesh to activate mess message deliveries */
  meshMessageDeliveriesActive: boolean
  /** sticky mesh rate failure penalty counter */
  meshFailurePenalty: number
  /** invalid message counter */
  invalidMessageDeliveries: number
}

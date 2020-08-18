import { PeerScoreParams } from './peer-score-params'

export interface PeerStats {
  /**
   * true if the peer is currently connected
   */
  connected: boolean

  /**
   * expiration time of the score stats for disconnected peers
   */
  expire: number

  /**
   * per topic stats
   */
  topics: Record<string, TopicStats>

  /**
   * IP tracking; store as string for easy processing
   */
  ips: string[]

  /**
   * behavioural pattern penalties (applied by the router)
   */
  behaviourPenalty: number
}

export interface TopicStats {
  /**
   * true if the peer is in the mesh
   */
  inMesh: boolean

  /**
   * time when the peer was (last) GRAFTed; valid only when in mesh
   */
  graftTime: number

  /**
   * time in mesh (updated during refresh/decay to avoid calling gettimeofday on
   * every score invocation)
   */
  meshTime: number

  /**
   * first message deliveries
   */
  firstMessageDeliveries: number

  /**
   * mesh message deliveries
   */
  meshMessageDeliveries: number

  /**
   * true if the peer has been enough time in the mesh to activate mess message deliveries
   */
  meshMessageDeliveriesActive: boolean

  /**
   * sticky mesh rate failure penalty counter
   */
  meshFailurePenalty: number

  /**
   * invalid message counter
   */
  invalidMessageDeliveries: number
}

export function createPeerStats (ps: Partial<PeerStats> = {}): PeerStats {
  return {
    connected: false,
    expire: 0,
    ips: [],
    behaviourPenalty: 0,
    ...ps,
    topics: ps.topics
      ? Object.entries(ps.topics)
        .reduce((topics, [topic, topicStats]) => {
          topics[topic] = createTopicStats(topicStats)
          return topics
        }, {} as Record<string, TopicStats>)
      : {}
  }
}

export function createTopicStats (ts: Partial<TopicStats> = {}): TopicStats {
  return {
    inMesh: false,
    graftTime: 0,
    meshTime: 0,
    firstMessageDeliveries: 0,
    meshMessageDeliveries: 0,
    meshMessageDeliveriesActive: false,
    meshFailurePenalty: 0,
    invalidMessageDeliveries: 0,
    ...ts
  }
}

export function ensureTopicStats (topic: string, ps: PeerStats, params: PeerScoreParams): TopicStats | undefined {
  let ts = ps.topics[topic]
  if (ts) {
    return ts
  }
  if (!params.topics[topic]) {
    return undefined
  }
  ps.topics[topic] = ts = createTopicStats()
  return ts
}

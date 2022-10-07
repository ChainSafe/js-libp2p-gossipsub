import type { PeerId } from '@libp2p/interface-peer-id'
import type { TopicStr } from './types.js'
import type { RPC } from './message/index.js'

/**
 * SubscriptionFilter is a function that tells us whether we are interested in allowing and tracking
 * subscriptions for a given topic.
 *
 * The filter is consulted whenever a subscription notification is received by another peer; if the
 * filter returns false, then the notification is ignored.
 *
 * The filter is also consulted when joining topics; if the filter returns false, then the Join
 * operation will result in an error.
 */
export interface SubscriptionFilter {
  // CanSubscribe returns true if the topic is of interest and we can subscribe to it
  canSubscribe(topic: TopicStr): boolean

  // FilterIncomingSubscriptions is invoked for all RPCs containing subscription notifications.
  // It should filter only the subscriptions of interest and my return an error if (for instance)
  // there are too many subscriptions.
  filterIncomingSubscriptions(peerId: PeerId, subopts: RPC.ISubOpts[]): RPC.ISubOpts[]
}

// NewAllowlistSubscriptionFilter creates a subscription filter that only allows explicitly
// specified topics for local subscriptions and incoming peer subscriptions.
export class AllowlistSubscriptionFilter implements SubscriptionFilter {
  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly allowedTopics: Set<TopicStr>) {}

  canSubscribe(topic: TopicStr): boolean {
    return this.allowedTopics.has(topic)
  }

  filterIncomingSubscriptions(peerId: PeerId, subopts: RPC.ISubOpts[]): RPC.ISubOpts[] {
    return subopts.filter((sub) => sub.topic && this.allowedTopics.has(sub.topic))
  }
}

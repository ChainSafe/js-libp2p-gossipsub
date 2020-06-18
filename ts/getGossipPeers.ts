import { GossipsubIDv10, GossipsubIDv11 } from './constants'
import { shuffle } from './utils'
import { Peer } from './peer'
import Gossipsub = require('./index')

/**
 * Given a topic, returns up to count peers subscribed to that topic
 * that pass an optional filter function
 *
 * @param {Gossipsub} router
 * @param {String} topic
 * @param {Number} count
 * @param {Function} [filter] a function to filter acceptable peers
 * @returns {Set<Peer>}
 *
 */
export function getGossipPeers (
  router: Gossipsub,
  topic: string,
  count: number,
  filter: (peer: Peer) => boolean = () => true
): Set<Peer> {
  const peersInTopic = router.topics.get(topic)
  if (!peersInTopic) {
    return new Set()
  }

  // Adds all peers using our protocol
  // that also pass the filter function
  let peers: Peer[] = []
  peersInTopic.forEach((peer) => {
    if (
      peer.protocols.find(proto => proto === GossipsubIDv10 || proto === GossipsubIDv11) &&
      filter(peer)
    ) {
      peers.push(peer)
    }
  })

  // Pseudo-randomly shuffles peers
  peers = shuffle(peers)
  if (count > 0 && peers.length > count) {
    peers = peers.slice(0, count)
  }

  return new Set(peers)
}

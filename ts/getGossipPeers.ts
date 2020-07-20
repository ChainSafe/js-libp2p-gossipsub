import { shuffle, hasGossipProtocol } from './utils'
import { PeerStreams } from './peerStreams'
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
  filter: (peerStreams: PeerStreams) => boolean = () => true
): Set<PeerStreams> {
  const peersInTopic = router.topics.get(topic)
  if (!peersInTopic) {
    return new Set()
  }

  // Adds all peers using our protocol
  // that also pass the filter function
  let peers: PeerStreams[] = []
  peersInTopic.forEach((id) => {
    const peerStreams = router.peers.get(id)
    if (!peerStreams) {
      return
    }
    if (
      hasGossipProtocol(peerStreams.protocol) &&
      filter(peerStreams)
    ) {
      peers.push(peerStreams)
    }
  })

  // Pseudo-randomly shuffles peers
  peers = shuffle(peers)
  if (count > 0 && peers.length > count) {
    peers = peers.slice(0, count)
  }

  return new Set(peers)
}

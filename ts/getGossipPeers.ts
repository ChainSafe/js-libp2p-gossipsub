import * as constants from './constants'
import { shuffle } from './utils'
import { Gossipsub } from './index'
import { Peer } from './peer'

/**
 * Given a topic, returns up to count peers subscribed to that topic
 *
 * @param {Gossipsub} router
 * @param {String} topic
 * @param {Number} count
 * @returns {Set<Peer>}
 *
 */
export function getGossipPeers (router: Gossipsub, topic: string, count: number): Set<Peer> {
  const peersInTopic = router.topics.get(topic)
  if (!peersInTopic) {
    return new Set()
  }

  // Adds all peers using our protocol
  let peers: Peer[] = []
  peersInTopic.forEach((peer) => {
    if (peer.protocols.includes(constants.GossipsubID)) {
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

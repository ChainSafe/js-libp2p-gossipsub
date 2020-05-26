'use strict'

const constants = require('./constants')
const { shuffle } = require('./utils')

/**
 * Given a topic, returns up to count peers subscribed to that topic
 *
 * @param {Gossipsub} router
 * @param {String} topic
 * @param {Number} count
 * @returns {Set<Peer>}
 *
 */
module.exports = function getGossipPeers (router, topic, count) {
  const peersInTopic = router.topics.get(topic)
  if (!peersInTopic) {
    return new Set()
  }

  // Adds all peers using our protocol
  let peers = []
  peersInTopic.forEach((peer) => {
    if (peer.protocols.includes(constants.GossipSubID)) {
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

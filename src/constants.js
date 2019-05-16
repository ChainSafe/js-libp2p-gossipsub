'use strict'

const second = exports.second = 1000
const minute = exports.minute = 60 * second

// Protocol identifiers
exports.FloodSubID = '/floodsub/1.0.0'
exports.GossipSubID = '/meshsub/1.0.0'

// Overlay parameters
exports.GossipSubD = 6
exports.GossipSubDlo = 4
exports.GossipSubDhi = 12

// Gossip parameters
exports.GossipSubHistoryLength = 5
exports.GossipSubHistoryGossip = 3

// Heartbeat interval
exports.GossipSubHeartbeatInitialDelay = 100 / second
exports.GossipSubHeartbeatInterval = second

// Fanout ttl
exports.GossipSubFanoutTTL = minute

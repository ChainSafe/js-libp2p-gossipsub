'use strict'

const second = exports.second = 1000
const minute = exports.minute = 60 * second

// Protocol identifiers
export const FloodSubID = '/floodsub/1.0.0'
export const GossipSubID = '/meshsub/1.0.0'

// Overlay parameters
export const GossipSubD = 6
export const GossipSubDlo = 4
export const GossipSubDhi = 12

// Gossip parameters
export const GossipSubHistoryLength = 5
export const GossipSubHistoryGossip = 3

// Heartbeat interval
export const GossipSubHeartbeatInitialDelay = 100 / second
export const GossipSubHeartbeatInterval = second

// Fanout ttl
export const GossipSubFanoutTTL = minute

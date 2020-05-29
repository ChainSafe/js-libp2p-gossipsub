'use strict'

const second = exports.second = 1000
const minute = exports.minute = 60 * second

// Protocol identifiers
export const FloodSubID = '/floodsub/1.0.0'
export const GossipsubID = '/meshsub/1.0.0'

// Overlay parameters
export const GossipsubD = 6
export const GossipsubDlo = 4
export const GossipsubDhi = 12

// Gossip parameters
export const GossipsubHistoryLength = 5
export const GossipsubHistoryGossip = 3

// Heartbeat interval
export const GossipsubHeartbeatInitialDelay = 100 / second
export const GossipsubHeartbeatInterval = second

// Fanout ttl
export const GossipsubFanoutTTL = minute

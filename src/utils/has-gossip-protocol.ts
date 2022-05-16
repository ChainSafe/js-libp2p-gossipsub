import { GossipsubIDv10, GossipsubIDv11 } from '../constants.js'

export function hasGossipProtocol(protocol: string): boolean {
  return protocol === GossipsubIDv10 || protocol === GossipsubIDv11
}

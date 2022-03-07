import { GossipsubIDv10, GossipsubIDv11 } from '../constants'

export function hasGossipProtocol(protocol: string): boolean {
  return protocol === GossipsubIDv10 || protocol === GossipsubIDv11
}

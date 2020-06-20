import { GossipsubIDv10, GossipsubIDv11 } from '../constants'

export function hasGossipProtocol (protocols: string[]): boolean {
  return Boolean(protocols.find(p =>
    p === GossipsubIDv10 || p === GossipsubIDv11
  ))
}

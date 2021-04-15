import { InMessage } from 'libp2p-interfaces/src/pubsub'
import { Multiaddr } from 'multiaddr'
import PeerId = require('peer-id')

export interface AddrInfo {
  id: PeerId
  addrs: Multiaddr[]
}

export type MessageIdFunction = (msg: InMessage) => Uint8Array;

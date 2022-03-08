import { sha256 } from 'multiformats/hashes/sha2'
import { GossipsubMessage } from '../types'

export type PeerIdStr = string

/**
 * Generate a message id, based on the `key` and `seqno`
 */
export function msgIdFnStrictSign(msg: GossipsubMessage): Uint8Array {
  // Should never happen
  if (!msg.from) throw Error('missing from field')
  if (!msg.seqno) throw Error('missing seqno field')

  // TODO: Should use .from here or key?
  const msgId = new Uint8Array(msg.from.length + msg.seqno.length)
  msgId.set(msg.from, 0)
  msgId.set(msg.seqno, msg.from.length)

  return msgId
}

/**
 * Generate a message id, based on message `data`
 */
export async function msgIdFnStrictNoSign(msg: GossipsubMessage): Promise<Uint8Array> {
  return sha256.encode(msg.data)
}

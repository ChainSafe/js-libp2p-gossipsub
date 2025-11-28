import { msgId } from '@libp2p/pubsub/utils'
import { digest } from '@chainsafe/as-sha256'

import type { Message } from '@libp2p/interface'

/**
 * Generate a message id, based on the `key` and `seqno`
 */
export function msgIdFnStrictSign (msg: Message): Uint8Array {
  if (msg.type !== 'signed') {
    throw new Error('expected signed message type')
  }
  // Should never happen
  if (msg.sequenceNumber == null) throw Error('missing seqno field')

  // TODO: Should use .from here or key?
  return msgId(msg.from.publicKey ?? msg.key, msg.sequenceNumber)
}

/**
 * Generate a message id, based on message `data`
 */
export function msgIdFnStrictNoSign (msg: Message): Uint8Array {
  return digest(msg.data)
}

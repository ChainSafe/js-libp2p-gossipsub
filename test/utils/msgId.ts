import SHA256 from '@chainsafe/as-sha256'
import type { RPC } from '../../ts/message/rpc.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { messageIdToString } from '../../ts/utils/messageIdToString.js'

export const getMsgId = (msg: RPC.Message) => {
  const from = (msg.from != null) ? msg.from : new Uint8Array(0)
  const seqno = msg.seqno instanceof Uint8Array ? msg.seqno : uint8ArrayFromString(msg.seqno ?? '')
  const result = new Uint8Array(from.length + seqno.length)
  result.set(from, 0)
  result.set(seqno, from.length)
  return result
}

export const getMsgIdStr = (msg: RPC.Message) => messageIdToString(getMsgId(msg))

// @ts-expect-error @chainsafe/as-sha256 types are wrong
export const fastMsgIdFn = (msg: RPC.Message) => ((msg.data != null) ? messageIdToString(SHA256.default.digest(msg.data)) : '0')

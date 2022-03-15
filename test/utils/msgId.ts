import SHA256 from '@chainsafe/as-sha256'
import { RPC } from 'libp2p-pubsub/message/rpc'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { messageIdToString } from '../../ts/utils/messageIdToString'

export const getMsgId = (msg: RPC.IMessage) => {
  const from = msg.from ? msg.from : new Uint8Array(0)
  const seqno = msg.seqno instanceof Uint8Array ? msg.seqno : uint8ArrayFromString(msg.seqno ?? '')
  const result = new Uint8Array(from.length + seqno.length)
  result.set(from, 0)
  result.set(seqno, from.length)
  return result
}

export const getMsgIdStr = (msg: RPC.IMessage) => messageIdToString(getMsgId(msg))

export const fastMsgIdFn = (msg: RPC.IMessage) => (msg.data ? messageIdToString(SHA256.digest(msg.data)) : '0')

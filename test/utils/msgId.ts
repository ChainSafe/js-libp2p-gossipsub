import SHA256 from '@chainsafe/as-sha256'
import { InMessage } from 'libp2p-interfaces/src/pubsub'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { messageIdToString } from '../../ts/utils/messageIdToString'

export const getMsgId = (msg: InMessage) => {
  const from = uint8ArrayFromString(msg.from ?? '')
  const seqno = msg.seqno instanceof Uint8Array ? msg.seqno : uint8ArrayFromString(msg.seqno ?? '')
  const result = new Uint8Array(from.length + seqno.length)
  result.set(from, 0)
  result.set(seqno, from.length)
  return result
}

export const getMsgIdStr = (msg: InMessage) => messageIdToString(getMsgId(msg))

export const fastMsgIdFn = (msg: InMessage) => messageIdToString(SHA256.digest(msg.data))

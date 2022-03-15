import SHA256 from '@chainsafe/as-sha256'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { messageIdToString } from '../../ts/utils/messageIdToString'

export const getMsgId = (msg) => {
  const from = uint8ArrayFromString(msg.from)
  const seqno = uint8ArrayFromString(msg.seqno)
  const result = new Uint8Array(from.length + seqno.length)
  result.set(from, 0)
  result.set(seqno, from.length)
  return result
}

export const getMsgIdStr = (msg) => messageIdToString(getMsgId(msg))

export const fastMsgIdFn = (msg) => messageIdToString(SHA256.digest(msg.data))

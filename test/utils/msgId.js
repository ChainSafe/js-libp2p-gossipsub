const SHA256 = require('@chainsafe/as-sha256')
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string')
const { messageIdToString } = require('../../src/utils/messageIdToString')

const getMsgId = (msg) => {
  const from = uint8ArrayFromString(msg.from)
  const seqno = uint8ArrayFromString(msg.seqno)
  const result = new Uint8Array(from.length + seqno.length)
  result.set(from, 0)
  result.set(seqno, from.length)
  return result
}

const getMsgIdStr = (msg) => messageIdToString(getMsgId(msg))

const fastMsgIdFn = (msg) => messageIdToString(SHA256.default.digest(msg.data))

module.exports = {
  getMsgId,
  getMsgIdStr,
  fastMsgIdFn,
}
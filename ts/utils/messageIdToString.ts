// remove ts-ignore once https://github.com/achingbrain/uint8arrays/pull/4 is merged
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import toString = require('uint8arrays/to-string')

export function messageIdToString (msgId: Uint8Array): string {
  return toString(msgId, 'base64')
}

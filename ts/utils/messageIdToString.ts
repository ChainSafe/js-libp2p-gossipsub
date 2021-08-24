import { toString } from 'uint8arrays/to-string'

export function messageIdToString (msgId: Uint8Array): string {
  return toString(msgId, 'base64')
}

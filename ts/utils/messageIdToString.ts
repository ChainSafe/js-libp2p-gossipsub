import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'

export function messageIdToString(msgId: Uint8Array): string {
  return toString(msgId, 'base64')
}

export function messageIdFromString(msgId: string): Uint8Array {
  return fromString(msgId, 'base64')
}

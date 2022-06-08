import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'

/**
 * Browser friendly function to convert Uint8Array message id to base64 string.
 * Do not use this function directly unless in test.
 */
export function messageIdToString(msgId: Uint8Array): string {
  return toString(msgId, 'base64')
}

/**
 * Browser friendly function to convert base64 message id string to Uint8Array
 */
export function messageIdFromString(msgId: string): Uint8Array {
  return fromString(msgId, 'base64')
}

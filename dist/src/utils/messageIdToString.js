import { toString } from 'uint8arrays/to-string';
/**
 * Browser friendly function to convert Uint8Array message id to base64 string.
 */
export function messageIdToString(msgId) {
    return toString(msgId, 'base64');
}
//# sourceMappingURL=messageIdToString.js.map
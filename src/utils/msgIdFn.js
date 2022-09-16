"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.msgIdFnStrictNoSign = exports.msgIdFnStrictSign = void 0;
const sha2_1 = require("multiformats/hashes/sha2");
/**
 * Generate a message id, based on the `key` and `seqno`
 */
function msgIdFnStrictSign(msg) {
    // Should never happen
    if (!msg.from)
        throw Error('missing from field');
    if (!msg.seqno)
        throw Error('missing seqno field');
    // TODO: Should use .from here or key?
    const msgId = new Uint8Array(msg.from.length + msg.seqno.length);
    msgId.set(msg.from, 0);
    msgId.set(msg.seqno, msg.from.length);
    return msgId;
}
exports.msgIdFnStrictSign = msgIdFnStrictSign;
/**
 * Generate a message id, based on message `data`
 */
async function msgIdFnStrictNoSign(msg) {
    return sha2_1.sha256.encode(msg.data);
}
exports.msgIdFnStrictNoSign = msgIdFnStrictNoSign;

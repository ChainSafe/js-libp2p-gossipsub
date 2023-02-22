import SHA256 from '@chainsafe/as-sha256';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { messageIdToString } from '../../src/utils/messageIdToString.js';
export const getMsgId = (msg) => {
    const from = msg.from != null ? msg.from : new Uint8Array(0);
    const seqno = msg.seqno instanceof Uint8Array ? msg.seqno : uint8ArrayFromString(msg.seqno ?? '');
    const result = new Uint8Array(from.length + seqno.length);
    result.set(from, 0);
    result.set(seqno, from.length);
    return result;
};
export const getMsgIdStr = (msg) => messageIdToString(getMsgId(msg));
export const fastMsgIdFn = (msg) => 
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error @chainsafe/as-sha256 types are wrong
msg.data != null ? messageIdToString(SHA256.default.digest(msg.data)) : '0';
//# sourceMappingURL=msgId.js.map
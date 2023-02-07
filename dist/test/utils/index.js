import { createEd25519PeerId } from '@libp2p/peer-id-factory';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
export * from './msgId.js';
export const createPeerId = async () => {
    const peerId = await createEd25519PeerId();
    return peerId;
};
let seq = 0n;
const defaultPeer = uint8ArrayFromString('12D3KooWBsYhazxNL7aeisdwttzc6DejNaM48889t5ifiS6tTrBf', 'base58btc');
export function makeTestMessage(i, topic, from) {
    return {
        seqno: uint8ArrayFromString((seq++).toString(16).padStart(16, '0'), 'base16'),
        data: Uint8Array.from([i]),
        from: from?.toBytes() ?? defaultPeer,
        topic
    };
}
//# sourceMappingURL=index.js.map
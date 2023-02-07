import { concat as uint8ArrayConcat } from 'uint8arrays/concat';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { marshalPublicKey, unmarshalPublicKey } from '@libp2p/crypto/keys';
import { randomBytes } from '@libp2p/crypto';
import { peerIdFromBytes } from '@libp2p/peer-id';
import { equals as uint8ArrayEquals } from 'uint8arrays/equals';
import { RPC } from '../message/rpc.js';
import { PublishConfigType, ValidateError } from '../types.js';
import { StrictSign, StrictNoSign } from '@libp2p/interface-pubsub';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
export const SignPrefix = uint8ArrayFromString('libp2p-pubsub:');
export async function buildRawMessage(publishConfig, topic, originalData, transformedData) {
    switch (publishConfig.type) {
        case PublishConfigType.Signing: {
            const rpcMsg = {
                from: publishConfig.author.toBytes(),
                data: transformedData,
                seqno: randomBytes(8),
                topic,
                signature: undefined,
                key: undefined // Exclude key field for signing
            };
            // Get the message in bytes, and prepend with the pubsub prefix
            // the signature is over the bytes "libp2p-pubsub:<protobuf-message>"
            const bytes = uint8ArrayConcat([SignPrefix, RPC.Message.encode(rpcMsg).finish()]);
            rpcMsg.signature = await publishConfig.privateKey.sign(bytes);
            rpcMsg.key = publishConfig.key;
            const msg = {
                type: 'signed',
                from: publishConfig.author,
                data: originalData,
                sequenceNumber: BigInt(`0x${uint8ArrayToString(rpcMsg.seqno, 'base16')}`),
                topic,
                signature: rpcMsg.signature,
                key: rpcMsg.key
            };
            return {
                raw: rpcMsg,
                msg: msg
            };
        }
        case PublishConfigType.Anonymous: {
            return {
                raw: {
                    from: undefined,
                    data: transformedData,
                    seqno: undefined,
                    topic,
                    signature: undefined,
                    key: undefined
                },
                msg: {
                    type: 'unsigned',
                    data: originalData,
                    topic
                }
            };
        }
    }
}
export async function validateToRawMessage(signaturePolicy, msg) {
    // If strict-sign, verify all
    // If anonymous (no-sign), ensure no preven
    switch (signaturePolicy) {
        case StrictNoSign:
            if (msg.signature != null)
                return { valid: false, error: ValidateError.SignaturePresent };
            if (msg.seqno != null)
                return { valid: false, error: ValidateError.SeqnoPresent };
            if (msg.key != null)
                return { valid: false, error: ValidateError.FromPresent };
            return { valid: true, message: { type: 'unsigned', topic: msg.topic, data: msg.data ?? new Uint8Array(0) } };
        case StrictSign: {
            // Verify seqno
            if (msg.seqno == null)
                return { valid: false, error: ValidateError.InvalidSeqno };
            if (msg.seqno.length !== 8) {
                return { valid: false, error: ValidateError.InvalidSeqno };
            }
            if (msg.signature == null)
                return { valid: false, error: ValidateError.InvalidSignature };
            if (msg.from == null)
                return { valid: false, error: ValidateError.InvalidPeerId };
            let fromPeerId;
            try {
                // TODO: Fix PeerId types
                fromPeerId = peerIdFromBytes(msg.from);
            }
            catch (e) {
                return { valid: false, error: ValidateError.InvalidPeerId };
            }
            // - check from defined
            // - transform source to PeerId
            // - parse signature
            // - get .key, else from source
            // - check key == source if present
            // - verify sig
            let publicKey;
            if (msg.key) {
                publicKey = unmarshalPublicKey(msg.key);
                // TODO: Should `fromPeerId.pubKey` be optional?
                if (fromPeerId.publicKey !== undefined && !uint8ArrayEquals(publicKey.bytes, fromPeerId.publicKey)) {
                    return { valid: false, error: ValidateError.InvalidPeerId };
                }
            }
            else {
                if (fromPeerId.publicKey == null) {
                    return { valid: false, error: ValidateError.InvalidPeerId };
                }
                publicKey = unmarshalPublicKey(fromPeerId.publicKey);
            }
            const rpcMsgPreSign = {
                from: msg.from,
                data: msg.data,
                seqno: msg.seqno,
                topic: msg.topic,
                signature: undefined,
                key: undefined // Exclude key field for signing
            };
            // Get the message in bytes, and prepend with the pubsub prefix
            // the signature is over the bytes "libp2p-pubsub:<protobuf-message>"
            const bytes = uint8ArrayConcat([SignPrefix, RPC.Message.encode(rpcMsgPreSign).finish()]);
            if (!(await publicKey.verify(bytes, msg.signature))) {
                return { valid: false, error: ValidateError.InvalidSignature };
            }
            return {
                valid: true,
                message: {
                    type: 'signed',
                    from: fromPeerId,
                    data: msg.data ?? new Uint8Array(0),
                    sequenceNumber: BigInt(`0x${uint8ArrayToString(msg.seqno, 'base16')}`),
                    topic: msg.topic,
                    signature: msg.signature,
                    key: msg.key ?? marshalPublicKey(publicKey)
                }
            };
        }
    }
}
//# sourceMappingURL=buildRawMessage.js.map
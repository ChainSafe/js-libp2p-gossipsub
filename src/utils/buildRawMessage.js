"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToRawMessage = exports.buildRawMessage = exports.SignPrefix = void 0;
const iso_random_stream_1 = require("iso-random-stream");
const concat_1 = require("uint8arrays/concat");
const from_string_1 = require("uint8arrays/from-string");
const libp2p_crypto_1 = require("libp2p-crypto");
const peer_id_1 = require("peer-id");
const rpc_1 = require("../message/rpc");
const types_1 = require("../types");
exports.SignPrefix = (0, from_string_1.fromString)('libp2p-pubsub:');
async function buildRawMessage(publishConfig, topic, transformedData) {
    switch (publishConfig.type) {
        case types_1.PublishConfigType.Signing: {
            const rpcMsg = {
                from: publishConfig.author.toBytes(),
                data: transformedData,
                seqno: (0, iso_random_stream_1.randomBytes)(8),
                topic,
                signature: undefined,
                key: undefined // Exclude key field for signing
            };
            // Get the message in bytes, and prepend with the pubsub prefix
            // the signature is over the bytes "libp2p-pubsub:<protobuf-message>"
            const bytes = (0, concat_1.concat)([exports.SignPrefix, rpc_1.RPC.Message.encode(rpcMsg).finish()]);
            rpcMsg.signature = await publishConfig.privateKey.sign(bytes);
            rpcMsg.key = publishConfig.key;
            return rpcMsg;
        }
        case types_1.PublishConfigType.Author: {
            return {
                from: publishConfig.author.toBytes(),
                data: transformedData,
                seqno: (0, iso_random_stream_1.randomBytes)(8),
                topic,
                signature: undefined,
                key: undefined
            };
        }
        case types_1.PublishConfigType.Anonymous: {
            return {
                from: undefined,
                data: transformedData,
                seqno: undefined,
                topic,
                signature: undefined,
                key: undefined
            };
        }
    }
}
exports.buildRawMessage = buildRawMessage;
async function validateToRawMessage(signaturePolicy, msg) {
    // If strict-sign, verify all
    // If anonymous (no-sign), ensure no preven
    switch (signaturePolicy) {
        case types_1.SignaturePolicy.StrictNoSign:
            if (msg.signature != null)
                return { valid: false, error: types_1.ValidateError.SignaturePresent };
            if (msg.seqno != null)
                return { valid: false, error: types_1.ValidateError.SeqnoPresent };
            if (msg.key != null)
                return { valid: false, error: types_1.ValidateError.FromPresent };
            return { valid: true, fromPeerId: null };
        case types_1.SignaturePolicy.StrictSign: {
            // Verify seqno
            if (msg.seqno == null)
                return { valid: false, error: types_1.ValidateError.InvalidSeqno };
            if (msg.seqno.length !== 8) {
                return { valid: false, error: types_1.ValidateError.InvalidSeqno };
            }
            if (msg.signature == null)
                return { valid: false, error: types_1.ValidateError.InvalidSignature };
            if (msg.from == null)
                return { valid: false, error: types_1.ValidateError.InvalidPeerId };
            let fromPeerId;
            try {
                // TODO: Fix PeerId types
                fromPeerId = (0, peer_id_1.createFromBytes)(msg.from);
            }
            catch (e) {
                return { valid: false, error: types_1.ValidateError.InvalidPeerId };
            }
            // - check from defined
            // - transform source to PeerId
            // - parse signature
            // - get .key, else from source
            // - check key == source if present
            // - verify sig
            let publicKey;
            if (msg.key) {
                publicKey = libp2p_crypto_1.keys.unmarshalPublicKey(msg.key);
                // TODO: Should `fromPeerId.pubKey` be optional?
                if (fromPeerId.pubKey !== undefined && !publicKey.equals(fromPeerId.pubKey)) {
                    return { valid: false, error: types_1.ValidateError.InvalidPeerId };
                }
            }
            else {
                if (fromPeerId.pubKey === undefined) {
                    return { valid: false, error: types_1.ValidateError.InvalidPeerId };
                }
                publicKey = fromPeerId.pubKey;
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
            const bytes = (0, concat_1.concat)([exports.SignPrefix, rpc_1.RPC.Message.encode(rpcMsgPreSign).finish()]);
            if (!(await publicKey.verify(bytes, msg.signature))) {
                return { valid: false, error: types_1.ValidateError.InvalidSignature };
            }
            return { valid: true, fromPeerId };
        }
    }
}
exports.validateToRawMessage = validateToRawMessage;

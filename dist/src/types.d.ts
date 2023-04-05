import type { PeerId } from '@libp2p/interface-peer-id';
import type { PrivateKey } from '@libp2p/interface-keys';
import type { Multiaddr } from '@multiformats/multiaddr';
import type { RPC } from './message/rpc.js';
import { Message, TopicValidatorResult } from '@libp2p/interface-pubsub';
export type MsgIdStr = string;
export type PeerIdStr = string;
export type TopicStr = string;
export type IPStr = string;
export interface AddrInfo {
    id: PeerId;
    addrs: Multiaddr[];
}
/**
 * Compute a local non-spec'ed msg-id for faster de-duplication of seen messages.
 * Used exclusively for a local seen_cache
 */
export type FastMsgIdFn = (msg: RPC.IMessage) => string | number;
/**
 * By default, gossipsub only provide a browser friendly function to convert Uint8Array message id to string.
 * Application could use this option to provide a more efficient function.
 */
export type MsgIdToStrFn = (msgId: Uint8Array) => string;
/**
 * Compute spec'ed msg-id. Used for IHAVE / IWANT messages
 */
export interface MsgIdFn {
    (msg: Message): Promise<Uint8Array> | Uint8Array;
}
export interface DataTransform {
    /**
     * Takes the data published by peers on a topic and transforms the data.
     * Should be the reverse of outboundTransform(). Example:
     * - `inboundTransform()`: decompress snappy payload
     * - `outboundTransform()`: compress snappy payload
     */
    inboundTransform(topic: TopicStr, data: Uint8Array): Uint8Array;
    /**
     * Takes the data to be published (a topic and associated data) transforms the data. The
     * transformed data will then be used to create a `RawGossipsubMessage` to be sent to peers.
     */
    outboundTransform(topic: TopicStr, data: Uint8Array): Uint8Array;
}
export declare enum SignaturePolicy {
    /**
     * On the producing side:
     * - Build messages with the signature, key (from may be enough for certain inlineable public key types), from and seqno fields.
     *
     * On the consuming side:
     * - Enforce the fields to be present, reject otherwise.
     * - Propagate only if the fields are valid and signature can be verified, reject otherwise.
     */
    StrictSign = "StrictSign",
    /**
     * On the producing side:
     * - Build messages without the signature, key, from and seqno fields.
     * - The corresponding protobuf key-value pairs are absent from the marshalled message, not just empty.
     *
     * On the consuming side:
     * - Enforce the fields to be absent, reject otherwise.
     * - Propagate only if the fields are absent, reject otherwise.
     * - A message_id function will not be able to use the above fields, and should instead rely on the data field. A commonplace strategy is to calculate a hash.
     */
    StrictNoSign = "StrictNoSign"
}
export type PublishOpts = {
    allowPublishToZeroPeers?: boolean;
    ignoreDuplicatePublishError?: boolean;
};
export declare enum PublishConfigType {
    Signing = 0,
    Anonymous = 1
}
export type PublishConfig = {
    type: PublishConfigType.Signing;
    author: PeerId;
    key: Uint8Array;
    privateKey: PrivateKey;
} | {
    type: PublishConfigType.Anonymous;
};
export type RejectReasonObj = {
    reason: RejectReason.Error;
    error: ValidateError;
} | {
    reason: Exclude<RejectReason, RejectReason.Error>;
};
export declare enum RejectReason {
    /**
     * The message failed the configured validation during decoding.
     * SelfOrigin is considered a ValidationError
     */
    Error = "error",
    /**
     * Custom validator fn reported status IGNORE.
     */
    Ignore = "ignore",
    /**
     * Custom validator fn reported status REJECT.
     */
    Reject = "reject",
    /**
     * The peer that sent the message OR the source from field is blacklisted.
     * Causes messages to be ignored, not penalized, neither do score record creation.
     */
    Blacklisted = "blacklisted"
}
export declare enum ValidateError {
    InvalidSignature = "invalid_signature",
    InvalidSeqno = "invalid_seqno",
    InvalidPeerId = "invalid_peerid",
    SignaturePresent = "signature_present",
    SeqnoPresent = "seqno_present",
    FromPresent = "from_present",
    TransformFailed = "transform_failed"
}
export declare enum MessageStatus {
    duplicate = "duplicate",
    invalid = "invalid",
    valid = "valid"
}
/**
 * Store both Uint8Array and string message id so that we don't have to convert data between the two.
 * See https://github.com/ChainSafe/js-libp2p-gossipsub/pull/274
 */
export type MessageId = {
    msgId: Uint8Array;
    msgIdStr: MsgIdStr;
};
/**
 * Typesafe conversion of MessageAcceptance -> RejectReason. TS ensures all values covered
 */
export declare function rejectReasonFromAcceptance(acceptance: Exclude<TopicValidatorResult, TopicValidatorResult.Accept>): RejectReason.Ignore | RejectReason.Reject;
//# sourceMappingURL=types.d.ts.map
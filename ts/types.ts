import type { PeerId } from '@libp2p/interfaces/peer-id'
import type { PrivateKey } from '@libp2p/interfaces/keys'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { RPC } from './message/rpc.js'
import type { Message } from '@libp2p/interfaces/pubsub'

export type MsgIdStr = string
export type PeerIdStr = string
export type TopicStr = string
export type IPStr = string

export interface AddrInfo {
  id: PeerId
  addrs: Multiaddr[]
}

/**
 * Compute a local non-spec'ed msg-id for faster de-duplication of seen messages.
 * Used exclusively for a local seen_cache
 */
export type FastMsgIdFn = (msg: RPC.Message) => string

/**
 * Compute spec'ed msg-id. Used for IHAVE / IWANT messages
 */
export interface MsgIdFn {
  (msg: Message): Promise<Uint8Array> | Uint8Array
}

export interface DataTransform {
  /**
   * Takes the data published by peers on a topic and transforms the data.
   * Should be the reverse of outboundTransform(). Example:
   * - `inboundTransform()`: decompress snappy payload
   * - `outboundTransform()`: compress snappy payload
   */
  inboundTransform(topic: TopicStr, data: Uint8Array): Uint8Array

  /**
   * Takes the data to be published (a topic and associated data) transforms the data. The
   * transformed data will then be used to create a `RawGossipsubMessage` to be sent to peers.
   */
  outboundTransform(topic: TopicStr, data: Uint8Array): Uint8Array
}

/**
 * Custom validator function per topic.
 * Must return or resolve quickly (< 100ms) to prevent causing penalties for late messages.
 * If you need to apply validation that may require longer times use `asyncValidation` option and callback the
 * validation result through `Gossipsub.reportValidationResult`
 */
export type TopicValidatorFn = (
  topic: TopicStr,
  msg: Message,
  propagationSource: PeerId
) => MessageAcceptance | Promise<MessageAcceptance>

export enum SignaturePolicy {
  /**
   * On the producing side:
   * - Build messages with the signature, key (from may be enough for certain inlineable public key types), from and seqno fields.
   *
   * On the consuming side:
   * - Enforce the fields to be present, reject otherwise.
   * - Propagate only if the fields are valid and signature can be verified, reject otherwise.
   */
  StrictSign = 'StrictSign',
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
  StrictNoSign = 'StrictNoSign'
}

export enum PublishConfigType {
  Signing,
  Author,
  Anonymous
}

export type PublishConfig =
  | {
      type: PublishConfigType.Signing
      author: PeerId
      key: Uint8Array
      privateKey: PrivateKey
    }
  | { type: PublishConfigType.Author; author: PeerId }
  | { type: PublishConfigType.Anonymous }

export enum MessageAcceptance {
  /// The message is considered valid, and it should be delivered and forwarded to the network.
  Accept = 'accept',
  /// The message is neither delivered nor forwarded to the network, but the router does not
  /// trigger the P₄ penalty.
  Ignore = 'ignore',
  /// The message is considered invalid, and it should be rejected and trigger the P₄ penalty.
  Reject = 'reject'
}

export type RejectReasonObj =
  | { reason: RejectReason.Error; error: ValidateError }
  | { reason: Exclude<RejectReason, RejectReason.Error> }

export enum RejectReason {
  /**
   * The message failed the configured validation during decoding.
   * SelfOrigin is considered a ValidationError
   */
  Error = 'error',
  /**
   * Custom validator fn reported status IGNORE.
   */
  Ignore = 'ignore',
  /**
   * Custom validator fn reported status REJECT.
   */
  Reject = 'reject',
  /**
   * The peer that sent the message OR the source from field is blacklisted.
   * Causes messages to be ignored, not penalized, neither do score record creation.
   */
  Blacklisted = 'blacklisted'
}

export enum ValidateError {
  /// The message has an invalid signature,
  InvalidSignature = 'invalid_signature',
  /// The sequence number was the incorrect size
  InvalidSeqno = 'invalid_seqno',
  /// The PeerId was invalid
  InvalidPeerId = 'invalid_peerid',
  /// Signature existed when validation has been sent to
  /// [`crate::behaviour::MessageAuthenticity::Anonymous`].
  SignaturePresent = 'signature_present',
  /// Sequence number existed when validation has been sent to
  /// [`crate::behaviour::MessageAuthenticity::Anonymous`].
  SeqnoPresent = 'seqno_present',
  /// Message source existed when validation has been sent to
  /// [`crate::behaviour::MessageAuthenticity::Anonymous`].
  FromPresent = 'from_present',
  /// The data transformation failed.
  TransformFailed = 'transform_failed'
}

export enum MessageStatus {
  duplicate = 'duplicate',
  invalid = 'invalid',
  valid = 'valid'
}

/**
 * Typesafe conversion of MessageAcceptance -> RejectReason. TS ensures all values covered
 */
export function rejectReasonFromAcceptance(
  acceptance: Exclude<MessageAcceptance, MessageAcceptance.Accept>
): RejectReason.Ignore | RejectReason.Reject {
  switch (acceptance) {
    case MessageAcceptance.Ignore:
      return RejectReason.Ignore
    case MessageAcceptance.Reject:
      return RejectReason.Reject
  }
}

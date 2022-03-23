import { randomBytes } from 'iso-random-stream'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { keys } from 'libp2p-crypto'
import PeerId, { createFromBytes } from 'peer-id'
import { RPC } from '../message/rpc'
import { PublishConfig, PublishConfigType, SignaturePolicy, TopicStr, ValidateError } from '../types'

type PublicKey = ReturnType<typeof keys.unmarshalPublicKey>
export const SignPrefix = uint8ArrayFromString('libp2p-pubsub:')

export async function buildRawMessage(
  publishConfig: PublishConfig,
  topic: TopicStr,
  transformedData: Uint8Array
): Promise<RPC.IMessage> {
  switch (publishConfig.type) {
    case PublishConfigType.Signing: {
      const rpcMsg: RPC.IMessage = {
        from: publishConfig.author.toBytes(),
        data: transformedData,
        seqno: randomBytes(8),
        topic,
        signature: undefined, // Exclude signature field for signing
        key: undefined // Exclude key field for signing
      }

      // Get the message in bytes, and prepend with the pubsub prefix
      // the signature is over the bytes "libp2p-pubsub:<protobuf-message>"
      const bytes = uint8ArrayConcat([SignPrefix, RPC.Message.encode(rpcMsg).finish()])

      rpcMsg.signature = await publishConfig.privateKey.sign(bytes)
      rpcMsg.key = publishConfig.key

      return rpcMsg
    }

    case PublishConfigType.Author: {
      return {
        from: publishConfig.author.toBytes(),
        data: transformedData,
        seqno: randomBytes(8),
        topic,
        signature: undefined,
        key: undefined
      }
    }

    case PublishConfigType.Anonymous: {
      return {
        from: undefined,
        data: transformedData,
        seqno: undefined,
        topic,
        signature: undefined,
        key: undefined
      }
    }
  }
}

export type ValidationResult = { valid: true; fromPeerId: PeerId | null } | { valid: false; error: ValidateError }

export async function validateToRawMessage(
  signaturePolicy: SignaturePolicy,
  msg: RPC.IMessage
): Promise<ValidationResult> {
  // If strict-sign, verify all
  // If anonymous (no-sign), ensure no preven

  switch (signaturePolicy) {
    case SignaturePolicy.StrictNoSign:
      if (msg.signature != null) return { valid: false, error: ValidateError.SignaturePresent }
      if (msg.seqno != null) return { valid: false, error: ValidateError.SeqnoPresent }
      if (msg.key != null) return { valid: false, error: ValidateError.FromPresent }

      return { valid: true, fromPeerId: null }

    case SignaturePolicy.StrictSign: {
      // Verify seqno
      if (msg.seqno == null) return { valid: false, error: ValidateError.InvalidSeqno }
      if (msg.seqno.length !== 8) {
        return { valid: false, error: ValidateError.InvalidSeqno }
      }

      if (msg.signature == null) return { valid: false, error: ValidateError.InvalidSignature }
      if (msg.from == null) return { valid: false, error: ValidateError.InvalidPeerId }

      let fromPeerId: PeerId
      try {
        // TODO: Fix PeerId types
        fromPeerId = createFromBytes(msg.from)
      } catch (e) {
        return { valid: false, error: ValidateError.InvalidPeerId }
      }

      // - check from defined
      // - transform source to PeerId
      // - parse signature
      // - get .key, else from source
      // - check key == source if present
      // - verify sig

      let publicKey: PublicKey
      if (msg.key) {
        publicKey = keys.unmarshalPublicKey(msg.key)
        // TODO: Should `fromPeerId.pubKey` be optional?
        if (fromPeerId.pubKey !== undefined && !publicKey.equals(fromPeerId.pubKey)) {
          return { valid: false, error: ValidateError.InvalidPeerId }
        }
      } else {
        if (fromPeerId.pubKey === undefined) {
          return { valid: false, error: ValidateError.InvalidPeerId }
        }
        publicKey = fromPeerId.pubKey
      }

      const rpcMsgPreSign: RPC.IMessage = {
        from: msg.from,
        data: msg.data,
        seqno: msg.seqno,
        topic: msg.topic,
        signature: undefined, // Exclude signature field for signing
        key: undefined // Exclude key field for signing
      }

      // Get the message in bytes, and prepend with the pubsub prefix
      // the signature is over the bytes "libp2p-pubsub:<protobuf-message>"
      const bytes = uint8ArrayConcat([SignPrefix, RPC.Message.encode(rpcMsgPreSign).finish()])

      if (!(await publicKey.verify(bytes, msg.signature))) {
        return { valid: false, error: ValidateError.InvalidSignature }
      }

      return { valid: true, fromPeerId }
    }
  }
}

// import { keys } from 'libp2p-crypto'
import PeerId from 'peer-id'
import { PublishConfig, PublishConfigType, SignaturePolicy } from '../types'

/**
 * Prepare a PublishConfig object from a PeerId.
 */
export function getPublishConfigFromPeerId(signaturePolicy: SignaturePolicy, peerId?: PeerId): PublishConfig {
  switch (signaturePolicy) {
    case SignaturePolicy.StrictSign: {
      if (!peerId) {
        throw Error('Must provide PeerId')
      }

      if (peerId.privKey == null) {
        throw Error('Cannot sign message, no private key present')
      }

      if (peerId.pubKey == null) {
        throw Error('Cannot sign message, no public key present')
      }

      // Transform privateKey once at initialization time instead of once per message
      // const privateKey = await keys.unmarshalPrivateKey(peerId.privateKey)
      const privateKey = peerId.privKey

      return {
        type: PublishConfigType.Signing,
        author: peerId,
        key: peerId.pubKey.bytes,
        privateKey
      }
    }

    case SignaturePolicy.StrictNoSign:
      return {
        type: PublishConfigType.Anonymous
      }
  }
}

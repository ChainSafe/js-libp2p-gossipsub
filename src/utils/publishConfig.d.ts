import PeerId from 'peer-id';
import { PublishConfig, SignaturePolicy } from '../types';
/**
 * Prepare a PublishConfig object from a PeerId.
 */
export declare function getPublishConfigFromPeerId(signaturePolicy: SignaturePolicy, peerId?: PeerId): PublishConfig;

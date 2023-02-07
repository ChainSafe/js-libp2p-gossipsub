import { StrictSign, StrictNoSign } from '@libp2p/interface-pubsub';
import type { PeerId } from '@libp2p/interface-peer-id';
import { PublishConfig } from '../types.js';
/**
 * Prepare a PublishConfig object from a PeerId.
 */
export declare function getPublishConfigFromPeerId(signaturePolicy: typeof StrictSign | typeof StrictNoSign, peerId?: PeerId): Promise<PublishConfig>;
//# sourceMappingURL=publishConfig.d.ts.map
import { GossipsubMessage } from '../types';
export declare type PeerIdStr = string;
/**
 * Generate a message id, based on the `key` and `seqno`
 */
export declare function msgIdFnStrictSign(msg: GossipsubMessage): Uint8Array;
/**
 * Generate a message id, based on message `data`
 */
export declare function msgIdFnStrictNoSign(msg: GossipsubMessage): Promise<Uint8Array>;

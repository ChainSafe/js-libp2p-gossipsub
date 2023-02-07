import type { Message } from '@libp2p/interface-pubsub';
/**
 * Generate a message id, based on the `key` and `seqno`
 */
export declare function msgIdFnStrictSign(msg: Message): Uint8Array;
/**
 * Generate a message id, based on message `data`
 */
export declare function msgIdFnStrictNoSign(msg: Message): Promise<Uint8Array>;
//# sourceMappingURL=msgIdFn.d.ts.map
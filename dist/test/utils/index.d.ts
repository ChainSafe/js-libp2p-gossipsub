import type { TopicStr } from '../../src/types.js';
import type { PeerId } from '@libp2p/interface-peer-id';
import type { RPC } from '../../src/message/rpc.js';
export * from './msgId.js';
export declare const createPeerId: () => Promise<PeerId>;
export declare function makeTestMessage(i: number, topic: TopicStr, from?: PeerId): RPC.IMessage;
//# sourceMappingURL=index.d.ts.map
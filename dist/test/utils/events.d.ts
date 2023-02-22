import type { EventEmitter } from '@libp2p/interfaces/events';
import { GossipsubEvents } from '../../src/index.js';
import { GossipSubAndComponents } from './create-pubsub.js';
export declare const checkReceivedSubscription: (node: GossipSubAndComponents, peerIdStr: string, topic: string, peerIdx: number, timeout?: number) => Promise<void>;
export declare const checkReceivedSubscriptions: (node: GossipSubAndComponents, peerIdStrs: string[], topic: string, timeout?: number) => Promise<void>;
export declare const awaitEvents: <Events extends {
    [s: string]: any;
} = GossipsubEvents>(emitter: EventEmitter<Events>, event: keyof Events, number: number, timeout?: number) => Promise<void>;
//# sourceMappingURL=events.d.ts.map
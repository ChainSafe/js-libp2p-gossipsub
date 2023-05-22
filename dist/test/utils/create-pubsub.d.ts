import { GossipSub, GossipSubComponents, GossipsubOpts } from '../../src/index.js';
import { PubSub } from '@libp2p/interface-pubsub';
import { EventEmitter } from '@libp2p/interfaces/events';
import { Libp2pEvents } from '@libp2p/interface-libp2p';
export interface CreateComponentsOpts {
    init?: Partial<GossipsubOpts>;
    pubsub?: {
        new (opts?: any): PubSub;
    };
}
export interface GossipSubTestComponents extends GossipSubComponents {
    events: EventEmitter<Libp2pEvents>;
}
export interface GossipSubAndComponents {
    pubsub: GossipSub;
    components: GossipSubTestComponents;
}
export declare const createComponents: (opts: CreateComponentsOpts) => Promise<GossipSubAndComponents>;
export declare const createComponentsArray: (opts?: CreateComponentsOpts & {
    number: number;
    connected?: boolean;
}) => Promise<GossipSubAndComponents[]>;
export declare const connectPubsubNodes: (a: GossipSubAndComponents, b: GossipSubAndComponents) => Promise<void>;
export declare const connectAllPubSubNodes: (components: GossipSubAndComponents[]) => Promise<void>;
/**
 * Connect some gossipsub nodes to others, ensure each has num peers
 * @param {GossipSubAndComponents[]} gss
 * @param {number} num number of peers to connect
 */
export declare function connectSome(gss: GossipSubAndComponents[], num: number): Promise<void>;
export declare function sparseConnect(gss: GossipSubAndComponents[]): Promise<void>;
export declare function denseConnect(gss: GossipSubAndComponents[]): Promise<void>;
//# sourceMappingURL=create-pubsub.d.ts.map
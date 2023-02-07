import { createRSAPeerId } from '@libp2p/peer-id-factory';
import { mockRegistrar, mockConnectionManager, mockNetwork } from '@libp2p/interface-mocks';
import { MemoryDatastore } from 'datastore-core';
import { GossipSub } from '../../src/index.js';
import { setMaxListeners } from 'events';
import { PersistentPeerStore } from '@libp2p/peer-store';
import { start } from '@libp2p/interfaces/startable';
import { stubInterface } from 'ts-sinon';
export const createComponents = async (opts) => {
    const Ctor = opts.pubsub ?? GossipSub;
    const peerId = await createRSAPeerId({ bits: 512 });
    const components = {
        peerId,
        registrar: mockRegistrar(),
        connectionManager: stubInterface(),
        peerStore: new PersistentPeerStore({
            peerId,
            datastore: new MemoryDatastore()
        })
    };
    components.connectionManager = mockConnectionManager(components);
    const pubsub = new Ctor(components, opts.init);
    await start(...Object.entries(components), pubsub);
    mockNetwork.addNode(components);
    try {
        // not available everywhere
        setMaxListeners(Infinity, pubsub);
    }
    catch { }
    return { pubsub, components };
};
export const createComponentsArray = async (opts = { number: 1, connected: true }) => {
    const output = await Promise.all(Array.from({ length: opts.number }).map(async (_, i) => createComponents({ ...opts, init: { ...opts.init, debugName: `libp2p:gossipsub:${i}` } })));
    if (opts.connected) {
        await connectAllPubSubNodes(output);
    }
    return output;
};
export const connectPubsubNodes = async (a, b) => {
    const multicodecs = new Set([...a.pubsub.multicodecs, ...b.pubsub.multicodecs]);
    const connection = await a.components.connectionManager.openConnection(b.components.peerId);
    for (const multicodec of multicodecs) {
        for (const topology of a.components.registrar.getTopologies(multicodec)) {
            topology.onConnect(b.components.peerId, connection);
        }
    }
};
export const connectAllPubSubNodes = async (components) => {
    for (let i = 0; i < components.length; i++) {
        for (let j = i + 1; j < components.length; j++) {
            await connectPubsubNodes(components[i], components[j]);
        }
    }
};
/**
 * Connect some gossipsub nodes to others, ensure each has num peers
 * @param {GossipSubAndComponents[]} gss
 * @param {number} num number of peers to connect
 */
export async function connectSome(gss, num) {
    for (let i = 0; i < gss.length; i++) {
        let count = 0;
        // merely do a Math.random() and check for duplicate may take a lot of time to run a test
        // so we make an array of candidate peers
        // initially, don't populate i as a candidate to connect: candidatePeers[i] = i + 1
        const candidatePeers = Array.from({ length: gss.length - 1 }, (_, j) => (j >= i ? j + 1 : j));
        while (count < num) {
            const n = Math.floor(Math.random() * candidatePeers.length);
            const peer = candidatePeers[n];
            await connectPubsubNodes(gss[i], gss[peer]);
            // after connecting to a peer, update candidatePeers so that we don't connect to it again
            for (let j = n; j < candidatePeers.length - 1; j++) {
                candidatePeers[j] = candidatePeers[j + 1];
            }
            // remove the last item
            candidatePeers.splice(candidatePeers.length - 1, 1);
            count++;
        }
    }
}
export async function sparseConnect(gss) {
    await connectSome(gss, 3);
}
export async function denseConnect(gss) {
    await connectSome(gss, Math.min(gss.length - 1, 10));
}
//# sourceMappingURL=create-pubsub.js.map
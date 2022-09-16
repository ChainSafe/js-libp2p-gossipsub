'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGossipRpc = void 0;
/**
 * Create a gossipsub RPC object
 */
function createGossipRpc(messages = [], control = {}) {
    return {
        subscriptions: [],
        messages,
        control: {
            ihave: control.ihave ?? [],
            iwant: control.iwant ?? [],
            graft: control.graft ?? [],
            prune: control.prune ?? []
        }
    };
}
exports.createGossipRpc = createGossipRpc;

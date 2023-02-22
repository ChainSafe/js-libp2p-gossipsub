/**
 * Create a gossipsub RPC object
 */
export function createGossipRpc(messages = [], control) {
    return {
        subscriptions: [],
        messages,
        control: control
            ? {
                graft: control.graft || [],
                prune: control.prune || [],
                ihave: control.ihave || [],
                iwant: control.iwant || []
            }
            : undefined
    };
}
//# sourceMappingURL=create-gossip-rpc.js.map
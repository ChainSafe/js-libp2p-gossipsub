import type { RPC } from '../message/rpc.js'

/**
 * Create a gossipsub RPC object
 */
export function createGossipRpc(messages: RPC.Message[] = [], control: Partial<RPC.ControlMessage> = {}): RPC {
  return {
    subscriptions: [],
    messages,
    control: {
      ihave: control.ihave ?? [],
      iwant: control.iwant ?? [],
      graft: control.graft ?? [],
      prune: control.prune ?? []
    }
  }
}

import type { IRPC, RPC } from '../message/rpc.js'

/**
 * Create a gossipsub RPC object
 */
export function createGossipRpc(messages: RPC.IMessage[] = [], control?: Partial<RPC.IControlMessage>): IRPC {
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
  }
}

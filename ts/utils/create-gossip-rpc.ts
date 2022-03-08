'use strict'

import { RPC, IRPC } from '../message/rpc'

/**
 * Create a gossipsub RPC object
 */
export function createGossipRpc(messages: RPC.IMessage[] = [], control: Partial<RPC.IControlMessage> = {}): IRPC {
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

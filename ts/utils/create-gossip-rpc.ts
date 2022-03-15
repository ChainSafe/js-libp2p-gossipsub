'use strict'

import { RPC, IRPC } from '../message/rpc'

/**
 * Create a gossipsub RPC object
 */
export function createGossipRpc(msgs: RPC.IMessage[] = [], control: Partial<RPC.IControlMessage> = {}): IRPC {
  return {
    subscriptions: [],
    msgs: msgs,
    control: {
      ihave: [],
      iwant: [],
      graft: [],
      prune: [],
      ...control
    }
  }
}

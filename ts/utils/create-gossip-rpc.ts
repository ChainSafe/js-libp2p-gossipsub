'use strict'

import { RPC, IRPC } from '../message/rpc'

/**
 * Create a gossipsub RPC object
 * @param {Array<RPC.IMessage>} msgs
 * @param {Partial<RPC.IControlMessage>} control
 * @returns {IRPC}
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
      ...control,
    },
  }
}

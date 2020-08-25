'use strict'

import { RPC, Message, ControlMessage } from '../message'

/**
 * Create a gossipsub RPC object
 * @param {Array<RPC.Message>} msgs
 * @param {Partial<RPC.ControlMessage>} control
 * @returns {RPC}
 */
export function createGossipRpc (msgs: Message[] = [], control: Partial<ControlMessage> = {}): RPC {
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

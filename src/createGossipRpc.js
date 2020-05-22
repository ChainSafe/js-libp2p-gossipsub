'use strict'

/**
 * Create a gossipsub RPC object
 * @param {Array<rpc.RPC.Message>} msgs
 * @param {Partial<rpc.RPC.ControlMessage>} control
 * @returns {rpc.RPC}
 */
exports.createGossipRpc = (msgs = [], control = {}) => {
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

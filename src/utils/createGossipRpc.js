'use strict'

/**
 * Create a gossipsub RPC object
 * @param {Array<RPC.Message>} msgs
 * @param {Partial<RPC.ControlMessage>} control
 * @returns {RPC}
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

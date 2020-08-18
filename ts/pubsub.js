'use strict'

const Pubsub = require('libp2p-interfaces/src/pubsub')

class BasicPubSub extends Pubsub {
  /**
   * @param {Object} props
   * @param {String} props.debugName log namespace
   * @param {string[]} props.multicodecs protocol identifiers to connect
   * @param {Libp2p} props.libp2p
   * @param {Object} [props.options]
   * @param {boolean} [props.options.emitSelf] if publish should emit to self, if subscribed, defaults to false
   * @constructor
   */
  constructor ({ debugName, multicodecs, libp2p, options = {} }) {
    super({
      debugName,
      multicodecs,
      libp2p,
      ...options
    })
  }
}

module.exports = BasicPubSub

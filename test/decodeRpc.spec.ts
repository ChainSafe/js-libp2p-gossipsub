import { expect } from 'aegir/chai'
import { decodeRpc, DecodeRPCLimits, defaultDecodeRpcLimits } from '../src/message/decodeRpc.js'
import { RPC, IRPC } from '../src/message/index.js'

describe('decodeRpc', () => {
  const topicID = 'topic'
  const msgID = new Uint8Array(8)

  const subscription: RPC.ISubOpts = { subscribe: true, topic: topicID }
  const message: RPC.IMessage = { topic: topicID, data: new Uint8Array(100) }
  const peerInfo: RPC.IPeerInfo = { peerID: msgID, signedPeerRecord: msgID }
  const ihave: RPC.IControlIHave = { topicID, messageIDs: [msgID] }
  const iwant: RPC.IControlIWant = { messageIDs: [msgID] }
  const graft: RPC.IControlGraft = { topicID }
  const prune: RPC.IControlPrune = { topicID, peers: [peerInfo] }

  describe('decode correctness', () => {
    it('Should decode full RPC', () => {
      const rpc: IRPC = {
        subscriptions: [subscription, subscription],
        messages: [message, message],
        control: {
          ihave: [ihave, ihave],
          iwant: [iwant, iwant],
          graft: [graft, graft],
          prune: [prune, prune]
        }
      }

      const bytes = RPC.encode(rpc).finish()

      // Compare as JSON
      expect(RPC.fromObject(decodeRpc(bytes, defaultDecodeRpcLimits)).toJSON()).deep.equals(RPC.decode(bytes).toJSON())
    })
  })

  describe('decode limits', () => {
    const decodeRpcLimits: DecodeRPCLimits = {
      maxSubscriptions: 2,
      maxMessages: 2,
      maxMessageIDs: 2,
      maxControlMessages: 2
    }

    const rpcEmpty: IRPC = {
      subscriptions: [],
      messages: [],
      control: {
        ihave: [],
        iwant: [],
        graft: [],
        prune: []
      }
    }

    const rpcEmptyBytes = RPC.encode(rpcEmpty).finish()

    it('max subscriptions', () => {
      // Decode a fresh instance to allow safe mutations
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.subscriptions = [subscription, subscription, subscription]
      expect(endecode(rpc).subscriptions).length(2, 'wrong subscriptions.length after decode')
    })

    it('max messages', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.messages = [message, message, message]
      expect(endecode(rpc).messages).length(2, 'wrong messages.length after decode')
    })

    it('max ihave', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { ihave: [ihave, ihave, ihave] }
      expect(endecode(rpc).control?.ihave).length(2, 'wrong control.ihave.length after decode')
    })

    it('max iwant', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { iwant: [iwant, iwant, iwant] }
      expect(endecode(rpc).control?.iwant).length(2, 'wrong control.iwant.length after decode')
    })

    it('max graft', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { graft: [graft, graft, graft] }
      expect(endecode(rpc).control?.graft).length(2, 'wrong control.graft.length after decode')
    })

    it('max prune', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { prune: [prune, prune, prune] }
      expect(endecode(rpc).control?.prune).length(2, 'wrong control.prune.length after decode')
    })

    it('max ihave.messageIDs', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { ihave: [{ messageIDs: [msgID, msgID, msgID] }] }
      expect(endecode(rpc).control?.ihave?.[0].messageIDs).length(2, 'wrong ihave.[0].messageIDs.length after decode')
    })

    it('max iwant.messageIDs', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { iwant: [{ messageIDs: [msgID, msgID, msgID] }] }
      expect(endecode(rpc).control?.iwant?.[0].messageIDs).length(2, 'wrong iwant.[0].messageIDs.length after decode')
    })

    it('max prune.peers', () => {
      const rpc = RPC.decode(rpcEmptyBytes)
      rpc.control = { prune: [{ peers: [peerInfo, peerInfo, peerInfo] }] }
      expect(endecode(rpc).control?.prune?.[0].peers).length(2, 'wrong peers.[0].peers.length after decode')
    })

    function endecode(rpc: IRPC): IRPC {
      return decodeRpc(RPC.encode(rpc).finish(), decodeRpcLimits)
    }
  })
})

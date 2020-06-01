import rpcProtoStr from './rpc.proto'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import protons = require('protons')

const rpcProto = protons(rpcProtoStr)

export interface SubOpts {
  subscribe?: boolean
  topicID?: string
}

export interface Message {
  from?: Buffer
  data?: Buffer
  seqno?: Buffer
  topicIDs: string[]
  signature?: Buffer
  key?: Buffer
}

/**
 * Same as Message, but `from` is an optional string
 */
export interface InMessage {
  from?: string
  data?: Buffer
  seqno?: Buffer
  topicIDs: string[]
  signature?: Buffer
  key?: Buffer
}

export interface ControlIHave {
  topicID?: string
  messageIDs: string[]
}

export interface ControlIWant {
  messageIDs: string[]
}

export interface ControlGraft {
  topicID?: string
}

export interface ControlPrune {
  topicID?: string
}

export interface ControlMessage {
  ihave: ControlIHave[]
  iwant: ControlIWant[]
  graft: ControlGraft[]
  prune: ControlPrune[]
}

export interface RPC {
  subscriptions: SubOpts[]
  msgs: Message[]
  control?: ControlMessage
}

interface ProtoCodec<T> {
  encode(obj: T): Buffer
  decode(buf: Buffer): T
}

export const RPCCodec = rpcProto.RPC as ProtoCodec<RPC>

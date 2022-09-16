import { RPC, IRPC } from '../message/rpc';
/**
 * Create a gossipsub RPC object
 */
export declare function createGossipRpc(messages?: RPC.IMessage[], control?: Partial<RPC.IControlMessage>): IRPC;

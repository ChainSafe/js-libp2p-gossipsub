import type { IRPC } from './rpc.js';
export type DecodeRPCLimits = {
    maxSubscriptions: number;
    maxMessages: number;
    maxIhaveMessageIDs: number;
    maxIwantMessageIDs: number;
    maxControlMessages: number;
    maxPeerInfos: number;
};
export declare const defaultDecodeRpcLimits: DecodeRPCLimits;
/**
 * Copied code from src/message/rpc.cjs but with decode limits to prevent OOM attacks
 */
export declare function decodeRpc(bytes: Uint8Array, opts: DecodeRPCLimits): IRPC;
//# sourceMappingURL=decodeRpc.d.ts.map
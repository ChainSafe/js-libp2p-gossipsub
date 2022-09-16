import PeerId from 'peer-id';
import { RPC } from '../message/rpc';
import { PublishConfig, SignaturePolicy, TopicStr, ValidateError } from '../types';
export declare const SignPrefix: Uint8Array;
export declare function buildRawMessage(publishConfig: PublishConfig, topic: TopicStr, transformedData: Uint8Array): Promise<RPC.IMessage>;
export declare type ValidationResult = {
    valid: true;
    fromPeerId: PeerId | null;
} | {
    valid: false;
    error: ValidateError;
};
export declare function validateToRawMessage(signaturePolicy: SignaturePolicy, msg: RPC.IMessage): Promise<ValidationResult>;

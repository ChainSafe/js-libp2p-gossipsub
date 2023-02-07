import { Stream } from '@libp2p/interface-connection';
import { Uint8ArrayList } from 'uint8arraylist';
type OutboundStreamOpts = {
    /** Max size in bytes for pushable buffer. If full, will throw on .push */
    maxBufferSize?: number;
};
type InboundStreamOpts = {
    /** Max size in bytes for reading messages from the stream */
    maxDataLength?: number;
};
export declare class OutboundStream {
    private readonly rawStream;
    private readonly pushable;
    private readonly closeController;
    private readonly maxBufferSize;
    constructor(rawStream: Stream, errCallback: (e: Error) => void, opts: OutboundStreamOpts);
    get protocol(): string;
    push(data: Uint8Array): void;
    close(): void;
}
export declare class InboundStream {
    readonly source: AsyncIterable<Uint8ArrayList>;
    private readonly rawStream;
    private readonly closeController;
    constructor(rawStream: Stream, opts?: InboundStreamOpts);
    close(): void;
}
export {};
//# sourceMappingURL=stream.d.ts.map
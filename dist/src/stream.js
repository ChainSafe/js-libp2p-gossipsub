import { abortableSource } from 'abortable-iterator';
import { pipe } from 'it-pipe';
import { pushable } from 'it-pushable';
import { encode, decode } from 'it-length-prefixed';
export class OutboundStream {
    constructor(rawStream, errCallback, opts) {
        this.rawStream = rawStream;
        this.pushable = pushable({ objectMode: false });
        this.closeController = new AbortController();
        this.maxBufferSize = opts.maxBufferSize ?? Infinity;
        pipe(abortableSource(this.pushable, this.closeController.signal, { returnOnAbort: true }), encode(), this.rawStream).catch(errCallback);
    }
    get protocol() {
        // TODO remove this non-nullish assertion after https://github.com/libp2p/js-libp2p-interfaces/pull/265 is incorporated
        return this.rawStream.stat.protocol;
    }
    push(data) {
        if (this.pushable.readableLength > this.maxBufferSize) {
            throw Error(`OutboundStream buffer full, size > ${this.maxBufferSize}`);
        }
        this.pushable.push(data);
    }
    close() {
        this.closeController.abort();
        // similar to pushable.end() but clear the internal buffer
        this.pushable.return();
        this.rawStream.close();
    }
}
export class InboundStream {
    constructor(rawStream, opts = {}) {
        this.rawStream = rawStream;
        this.closeController = new AbortController();
        this.source = abortableSource(pipe(this.rawStream, decode(opts)), this.closeController.signal, {
            returnOnAbort: true
        });
    }
    close() {
        this.closeController.abort();
        this.rawStream.close();
    }
}
//# sourceMappingURL=stream.js.map
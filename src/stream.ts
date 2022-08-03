import { Stream } from '@libp2p/interface-connection'
import { abortableSource } from 'abortable-iterator'
import { pipe } from 'it-pipe'
import { pushable, Pushable } from 'it-pushable'
import { encode, decode } from 'it-length-prefixed'
import { Uint8ArrayList } from 'uint8arraylist'

export class OutboundStream {
  private readonly rawStream: Stream
  private readonly pushable: Pushable<Uint8Array>
  private readonly closeController: AbortController

  constructor(rawStream: Stream, errCallback: (e: Error) => void) {
    this.rawStream = rawStream
    this.pushable = pushable()
    this.closeController = new AbortController()

    pipe(
      abortableSource(this.pushable, this.closeController.signal, { returnOnAbort: true }),
      encode(),
      this.rawStream
    ).catch(errCallback)
  }

  get protocol(): string {
    // TODO remove this non-nullish assertion after https://github.com/libp2p/js-libp2p-interfaces/pull/265 is incorporated
    return this.rawStream.stat.protocol!
  }

  push(data: Uint8Array): void {
    this.pushable.push(data)
  }

  close(): void {
    this.closeController.abort()
    this.rawStream.close()
  }
}

export class InboundStream {
  public readonly source: AsyncIterable<Uint8ArrayList>

  private readonly rawStream: Stream
  private readonly closeController: AbortController

  constructor(rawStream: Stream) {
    this.rawStream = rawStream
    this.closeController = new AbortController()

    this.source = abortableSource(pipe(this.rawStream, decode()), this.closeController.signal, { returnOnAbort: true })
  }

  close(): void {
    this.closeController.abort()
    this.rawStream.close()
  }
}

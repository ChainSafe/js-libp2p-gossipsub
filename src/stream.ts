import { Stream } from '@libp2p/interface-connection'
import { abortableSource } from 'abortable-iterator'
import { pipe } from 'it-pipe'
import { encode, decode } from 'it-length-prefixed'
import { Uint8ArrayList } from 'uint8arraylist'
import { PushableAbortable } from './utils/pushable'

type OutboundStreamOpts = {
  /** Max size in bytes for pushable buffer. If full, will throw on .push */
  maxBufferSize?: number
}

type InboundStreamOpts = {
  /** Max size in bytes for reading messages from the stream */
  maxDataLength?: number
}

export class OutboundStream {
  private readonly pushable = new PushableAbortable()
  private readonly maxBufferSize: number

  constructor(private readonly rawStream: Stream, errCallback: (e: Error) => void, opts: OutboundStreamOpts) {
    this.maxBufferSize = opts.maxBufferSize ?? Infinity

    pipe(
      //
      this.pushable,
      (source) => encode(source),
      this.rawStream
    ).catch(errCallback)
  }

  get protocol(): string {
    // TODO remove this non-nullish assertion after https://github.com/libp2p/js-libp2p-interfaces/pull/265 is incorporated
    return this.rawStream.stat.protocol!
  }

  push(data: Uint8Array): void {
    if (this.pushable.bufferSize > this.maxBufferSize) {
      throw Error(`OutboundStream buffer full, size > ${this.maxBufferSize}`)
    }

    this.pushable.push(data)
  }

  close(): void {
    this.pushable.abort()
    this.rawStream.close()
  }
}

export class InboundStream {
  public readonly source: AsyncIterable<Uint8ArrayList>

  private readonly rawStream: Stream
  private readonly closeController: AbortController

  constructor(rawStream: Stream, opts: InboundStreamOpts = {}) {
    this.rawStream = rawStream
    this.closeController = new AbortController()

    this.source = abortableSource(
      pipe(this.rawStream, (source) => decode(source, opts)),
      this.closeController.signal,
      {
        returnOnAbort: true
      }
    )
  }

  close(): void {
    this.closeController.abort()
    this.rawStream.close()
  }
}

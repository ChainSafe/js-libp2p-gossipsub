import PeerId from 'peer-id'
import { Pushable } from 'it-pushable'
import { DuplexIterableStream } from './interfaces'

export interface PeerStreams {
  id: PeerId
  protocol: string
  outboundStream: Pushable<Uint8Array>
  inboundStream: DuplexIterableStream
  readonly isReadable: boolean
  readonly isWritable: boolean
  attachInboundConnection (stream: DuplexIterableStream): void
  attachOutboundConnection (stream: DuplexIterableStream): Promise<void>
  write (buf: Uint8Array): void
  close (): void
}

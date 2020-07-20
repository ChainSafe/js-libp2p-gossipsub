import PeerId from 'peer-id'
import { Pushable } from 'it-pushable'
import { Stream } from './interfaces'

export interface PeerStreams {
  id: PeerId
  protocol: string
  outboundStream: Pushable<Buffer>
  inboundStream: Stream
  readonly isReadable: boolean
  readonly isWritable: boolean
  attachInboundConnection (stream: Stream): void
  attachOutboundConnection (stream: Stream): Promise<void>
  write (buf: Buffer): void
  close (): void
}

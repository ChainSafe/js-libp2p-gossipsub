import PeerId from 'peer-id'
import { Pushable } from 'it-pushable'
import { Message, SubOpts } from './message'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Connection {}

export interface Peer {
  id: PeerId
  protocols: string[]
  conn: Connection
  topics: Set<string>
  stream: Pushable<Buffer>
  readonly isConnected: boolean
  readonly isWritable: boolean
  write (buf: Buffer): void
  attachConnection (conn: Connection): void
  sendSubscriptions (topics: string[]): void
  sendUnsubscriptions (topics: string[]): void
  sendMessages (msgs: Message[]): void
  updateSubscriptions (subOpts: SubOpts[]): void
  close (): void
}

export interface Registrar {
  handle (): void
  register (): void
  unregister (): void
}

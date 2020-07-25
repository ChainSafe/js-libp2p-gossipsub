import PeerId = require('peer-id')
import Multiaddr = require('multiaddr')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DuplexIterableStream<T=any, U=any, V=any> {
  sink(source: T): Promise<U>
  source(): AsyncIterator<V>
}

export interface Connection {
  remoteAddr: Multiaddr
  remotePeer: PeerId
  stat: {
    direction: 'inbound' | 'outbound'
  }
  registry: Map<string, {protocol: string}>
}

export interface ConnectionManager {
  getAll(peerId: PeerId): Connection[]
}

export interface AddrInfo {
  id: PeerId
  addrs: Multiaddr[]
}

export interface Registrar {
  handle (): void
  register (): void
  unregister (): void
}

export interface Envelope {
  peerId: PeerId
  payloadType: Buffer
  payload: Buffer
  signature: Buffer

  marshal(): Buffer
  isEqual(other: Envelope): boolean
  validate(domain: string): Promise<boolean>
}

export interface EnvelopeClass {
  openAndCertify(data: Buffer, domain: string): Promise<Envelope>
}

interface Book<K, V> {
  add(k: K, v: V): this
  set(k: K, v: V[]): this
  get(k: K): V[]
}

export interface AddressBook extends Book<PeerId, Multiaddr[]> {
  consumePeerRecord(envelope: Envelope): boolean
  getRawEnvelope(peerId: PeerId): Buffer | undefined
}

export interface PeerStore {
  addressBook: AddressBook
}

export interface Libp2p {
  peerId: PeerId
  // eslint-disable-next-line @typescript-eslint/ban-types
  dialProtocol(peer: PeerId | Multiaddr | string, protocols: string | string[], options?: object): Promise<{stream: DuplexIterableStream, protocol: string}>
  connectionManager: ConnectionManager
  registrar: Registrar
  peerStore: PeerStore
}

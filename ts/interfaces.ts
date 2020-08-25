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
  payloadType: Uint8Array
  payload: Uint8Array
  signature: Uint8Array

  marshal(): Uint8Array
  isEqual(other: Envelope): boolean
  validate(domain: string): Promise<boolean>
}

export interface EnvelopeClass {
  openAndCertify(data: Uint8Array, domain: string): Promise<Envelope>
}

interface Book<K, V> {
  add(k: K, v: V): this
  set(k: K, v: V[]): this
  get(k: K): V[]
}

export interface AddressBook extends Book<PeerId, Multiaddr[]> {
  consumePeerRecord(envelope: Envelope): boolean
  getRawEnvelope(peerId: PeerId): Uint8Array | undefined
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

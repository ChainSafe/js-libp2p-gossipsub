import PeerId from 'peer-id';
import { Pushable } from 'it-pushable';
import { Message, SubOpts } from './message';
export interface Connection {
}
export interface Peer {
    id: PeerId;
    protocols: string[];
    conn: Connection;
    topics: Set<string>;
    stream: Pushable<Uint8Array>;
    readonly isConnected: boolean;
    readonly isWritable: boolean;
    write(buf: Uint8Array): void;
    attachConnection(conn: Connection): void;
    sendSubscriptions(topics: string[]): void;
    sendUnsubscriptions(topics: string[]): void;
    sendMessages(msgs: Message[]): void;
    updateSubscriptions(subOpts: SubOpts[]): void;
    close(): void;
}
export interface Registrar {
    handle(): void;
    register(): void;
    unregister(): void;
}

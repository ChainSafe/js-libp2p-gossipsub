import type { RPC } from './message/rpc.js';
import type { MessageId, MsgIdStr, PeerIdStr, TopicStr, MsgIdToStrFn } from './types.js';
export type CacheEntry = MessageId & {
    topic: TopicStr;
};
interface MessageCacheEntry {
    message: RPC.IMessage;
    /**
     * Tracks if the message has been validated by the app layer and thus forwarded
     */
    validated: boolean;
    /**
     * Tracks peers that sent this message before it has been validated by the app layer
     */
    originatingPeers: Set<PeerIdStr>;
    /**
     * For every message and peer the number of times this peer asked for the message
     */
    iwantCounts: Map<PeerIdStr, number>;
}
export declare class MessageCache {
    /**
     * The number of indices in the cache history used for gossiping. That means that a message
     * won't get gossiped anymore when shift got called `gossip` many times after inserting the
     * message in the cache.
     */
    private readonly gossip;
    msgs: Map<string, MessageCacheEntry>;
    msgIdToStrFn: MsgIdToStrFn;
    history: CacheEntry[][];
    /** Track with accounting of messages in the mcache that are not yet validated */
    notValidatedCount: number;
    /**
     * Holds history of messages in timebounded history arrays
     */
    constructor(
    /**
     * The number of indices in the cache history used for gossiping. That means that a message
     * won't get gossiped anymore when shift got called `gossip` many times after inserting the
     * message in the cache.
     */
    gossip: number, historyCapacity: number, msgIdToStrFn: MsgIdToStrFn);
    get size(): number;
    /**
     * Adds a message to the current window and the cache
     * Returns true if the message is not known and is inserted in the cache
     */
    put(messageId: MessageId, msg: RPC.IMessage, validated?: boolean): boolean;
    observeDuplicate(msgId: MsgIdStr, fromPeerIdStr: PeerIdStr): void;
    /**
     * Retrieves a message from the cache by its ID, if it is still present
     */
    get(msgId: Uint8Array): RPC.IMessage | undefined;
    /**
     * Increases the iwant count for the given message by one and returns the message together
     * with the iwant if the message exists.
     */
    getWithIWantCount(msgIdStr: string, p: string): {
        msg: RPC.IMessage;
        count: number;
    } | null;
    /**
     * Retrieves a list of message IDs for a set of topics
     */
    getGossipIDs(topics: Set<string>): Map<string, Uint8Array[]>;
    /**
     * Gets a message with msgId and tags it as validated.
     * This function also returns the known peers that have sent us this message. This is used to
     * prevent us sending redundant messages to peers who have already propagated it.
     */
    validate(msgId: MsgIdStr): {
        message: RPC.IMessage;
        originatingPeers: Set<PeerIdStr>;
    } | null;
    /**
     * Shifts the current window, discarding messages older than this.history.length of the cache
     */
    shift(): void;
    remove(msgId: MsgIdStr): MessageCacheEntry | null;
}
export {};
//# sourceMappingURL=message-cache.d.ts.map
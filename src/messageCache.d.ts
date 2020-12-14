import { InMessage } from './message';
export interface CacheEntry {
    msgID: string;
    topics: string[];
}
export declare class MessageCache {
    msgs: Map<string, InMessage>;
    history: CacheEntry[][];
    gossip: number;
    msgIdFn: (msg: InMessage) => string;
    /**
     * @param {Number} gossip
     * @param {Number} history
     * @param {msgIdFn} msgIdFn a function that returns message id from a message
     *
     * @constructor
     */
    constructor(gossip: number, history: number, msgIdFn: (msg: InMessage) => string);
    /**
     * Adds a message to the current window and the cache
     *
     * @param {RPC.Message} msg
     * @returns {void}
     */
    put(msg: InMessage): void;
    /**
     * Get message id of message.
     * @param {RPC.Message} msg
     * @returns {string}
     */
    getMsgId(msg: InMessage): string;
    /**
     * Retrieves a message from the cache by its ID, if it is still present
     *
     * @param {String} msgID
     * @returns {Message}
     */
    get(msgID: string): InMessage | undefined;
    /**
     * Retrieves a list of message IDs for a given topic
     *
     * @param {String} topic
     *
     * @returns {Array<String>}
     */
    getGossipIDs(topic: string): string[];
    /**
     * Shifts the current window, discarding messages older than this.history.length of the cache
     *
     * @returns {void}
     */
    shift(): void;
}

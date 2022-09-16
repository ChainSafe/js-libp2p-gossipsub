"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageCache = void 0;
const utils_1 = require("./utils");
class MessageCache {
    /**
     * Holds history of messages in timebounded history arrays
     */
    constructor(
    /**
     * he number of indices in the cache history used for gossiping. That means that a message
     * won't get gossiped anymore when shift got called `gossip` many times after inserting the
     * message in the cache.
     */
    gossip, historyCapacity) {
        this.gossip = gossip;
        this.msgs = new Map();
        this.history = [];
        for (let i = 0; i < historyCapacity; i++) {
            this.history[i] = [];
        }
    }
    get size() {
        return this.msgs.size;
    }
    /**
     * Adds a message to the current window and the cache
     * Returns true if the message is not known and is inserted in the cache
     */
    put(msgIdStr, msg, validated = false) {
        // Don't add duplicate entries to the cache.
        if (this.msgs.has(msgIdStr)) {
            return false;
        }
        this.msgs.set(msgIdStr, {
            message: msg,
            validated,
            originatingPeers: new Set(),
            iwantCounts: new Map()
        });
        const msgId = (0, utils_1.messageIdFromString)(msgIdStr);
        this.history[0].push({ msgId: msgId, topic: msg.topic });
        return true;
    }
    observeDuplicate(msgId, fromPeerIdStr) {
        const entry = this.msgs.get(msgId);
        if (entry &&
            // if the message is already validated, we don't need to store extra peers sending us
            // duplicates as the message has already been forwarded
            !entry.validated) {
            entry.originatingPeers.add(fromPeerIdStr);
        }
    }
    /**
     * Retrieves a message from the cache by its ID, if it is still present
     */
    get(msgId) {
        return this.msgs.get((0, utils_1.messageIdToString)(msgId))?.message;
    }
    /**
     * Increases the iwant count for the given message by one and returns the message together
     * with the iwant if the message exists.
     */
    getWithIWantCount(msgIdStr, p) {
        const msg = this.msgs.get(msgIdStr);
        if (!msg) {
            return null;
        }
        const count = (msg.iwantCounts.get(p) ?? 0) + 1;
        msg.iwantCounts.set(p, count);
        return { msg: msg.message, count };
    }
    /**
     * Retrieves a list of message IDs for a given topic
     */
    getGossipIDs(topic) {
        const msgIds = [];
        for (let i = 0; i < this.gossip; i++) {
            this.history[i].forEach((entry) => {
                const { msgId } = entry;
                if (entry.topic === topic && this.msgs.get((0, utils_1.messageIdToString)(msgId))?.validated) {
                    msgIds.push(msgId);
                }
            });
        }
        return msgIds;
    }
    /**
     * Gets a message with msgId and tags it as validated.
     * This function also returns the known peers that have sent us this message. This is used to
     * prevent us sending redundant messages to peers who have already propagated it.
     */
    validate(msgId) {
        const entry = this.msgs.get(msgId);
        if (!entry) {
            return null;
        }
        const { message, originatingPeers } = entry;
        entry.validated = true;
        // Clear the known peers list (after a message is validated, it is forwarded and we no
        // longer need to store the originating peers).
        entry.originatingPeers = new Set();
        return { message, originatingPeers };
    }
    /**
     * Shifts the current window, discarding messages older than this.history.length of the cache
     */
    shift() {
        const last = this.history[this.history.length - 1];
        last.forEach((entry) => {
            const msgIdStr = (0, utils_1.messageIdToString)(entry.msgId);
            this.msgs.delete(msgIdStr);
        });
        this.history.pop();
        this.history.unshift([]);
    }
    remove(msgId) {
        const entry = this.msgs.get(msgId);
        if (!entry) {
            return null;
        }
        // Keep the message on the history vector, it will be dropped on a shift()
        this.msgs.delete(msgId);
        return entry;
    }
}
exports.MessageCache = MessageCache;

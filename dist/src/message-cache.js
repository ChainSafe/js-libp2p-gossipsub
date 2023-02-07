export class MessageCache {
    /**
     * Holds history of messages in timebounded history arrays
     */
    constructor(
    /**
     * The number of indices in the cache history used for gossiping. That means that a message
     * won't get gossiped anymore when shift got called `gossip` many times after inserting the
     * message in the cache.
     */
    gossip, historyCapacity, msgIdToStrFn) {
        this.gossip = gossip;
        this.msgs = new Map();
        this.history = [];
        /** Track with accounting of messages in the mcache that are not yet validated */
        this.notValidatedCount = 0;
        this.msgIdToStrFn = msgIdToStrFn;
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
    put(messageId, msg, validated = false) {
        const { msgIdStr } = messageId;
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
        this.history[0].push({ ...messageId, topic: msg.topic });
        if (!validated) {
            this.notValidatedCount++;
        }
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
        return this.msgs.get(this.msgIdToStrFn(msgId))?.message;
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
     * Retrieves a list of message IDs for a set of topics
     */
    getGossipIDs(topics) {
        const msgIdsByTopic = new Map();
        for (let i = 0; i < this.gossip; i++) {
            this.history[i].forEach((entry) => {
                const msg = this.msgs.get(entry.msgIdStr);
                if (msg && msg.validated && topics.has(entry.topic)) {
                    let msgIds = msgIdsByTopic.get(entry.topic);
                    if (!msgIds) {
                        msgIds = [];
                        msgIdsByTopic.set(entry.topic, msgIds);
                    }
                    msgIds.push(entry.msgId);
                }
            });
        }
        return msgIdsByTopic;
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
        if (!entry.validated) {
            this.notValidatedCount--;
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
        const lastCacheEntries = this.history[this.history.length - 1];
        lastCacheEntries.forEach((cacheEntry) => {
            const entry = this.msgs.get(cacheEntry.msgIdStr);
            if (entry) {
                this.msgs.delete(cacheEntry.msgIdStr);
                if (!entry.validated) {
                    this.notValidatedCount--;
                }
            }
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
//# sourceMappingURL=message-cache.js.map
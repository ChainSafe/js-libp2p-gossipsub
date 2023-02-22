import { TimeCacheDuration } from '../constants.js';
import Denque from 'denque';
export var DeliveryRecordStatus;
(function (DeliveryRecordStatus) {
    /**
     * we don't know (yet) if the message is valid
     */
    DeliveryRecordStatus[DeliveryRecordStatus["unknown"] = 0] = "unknown";
    /**
     * we know the message is valid
     */
    DeliveryRecordStatus[DeliveryRecordStatus["valid"] = 1] = "valid";
    /**
     * we know the message is invalid
     */
    DeliveryRecordStatus[DeliveryRecordStatus["invalid"] = 2] = "invalid";
    /**
     * we were instructed by the validator to ignore the message
     */
    DeliveryRecordStatus[DeliveryRecordStatus["ignored"] = 3] = "ignored";
})(DeliveryRecordStatus || (DeliveryRecordStatus = {}));
/**
 * Map of canonical message ID to DeliveryRecord
 *
 * Maintains an internal queue for efficient gc of old messages
 */
export class MessageDeliveries {
    constructor() {
        this.records = new Map();
        this.queue = new Denque();
    }
    ensureRecord(msgIdStr) {
        let drec = this.records.get(msgIdStr);
        if (drec) {
            return drec;
        }
        // record doesn't exist yet
        // create record
        drec = {
            status: DeliveryRecordStatus.unknown,
            firstSeen: Date.now(),
            validated: 0,
            peers: new Set()
        };
        this.records.set(msgIdStr, drec);
        // and add msgId to the queue
        const entry = {
            msgId: msgIdStr,
            expire: Date.now() + TimeCacheDuration
        };
        this.queue.push(entry);
        return drec;
    }
    gc() {
        const now = Date.now();
        // queue is sorted by expiry time
        // remove expired messages, remove from queue until first un-expired message found
        let head = this.queue.peekFront();
        while (head && head.expire < now) {
            this.records.delete(head.msgId);
            this.queue.shift();
            head = this.queue.peekFront();
        }
    }
    clear() {
        this.records.clear();
        this.queue.clear();
    }
}
//# sourceMappingURL=message-deliveries.js.map
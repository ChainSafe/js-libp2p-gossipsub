import Denque from 'denque';
export declare enum DeliveryRecordStatus {
    /**
     * we don't know (yet) if the message is valid
     */
    unknown = 0,
    /**
     * we know the message is valid
     */
    valid = 1,
    /**
     * we know the message is invalid
     */
    invalid = 2,
    /**
     * we were instructed by the validator to ignore the message
     */
    ignored = 3
}
export interface DeliveryRecord {
    status: DeliveryRecordStatus;
    firstSeen: number;
    validated: number;
    peers: Set<string>;
}
interface DeliveryQueueEntry {
    msgId: string;
    expire: number;
}
/**
 * Map of canonical message ID to DeliveryRecord
 *
 * Maintains an internal queue for efficient gc of old messages
 */
export declare class MessageDeliveries {
    private records;
    queue: Denque<DeliveryQueueEntry>;
    constructor();
    ensureRecord(msgIdStr: string): DeliveryRecord;
    gc(): void;
    clear(): void;
}
export {};
//# sourceMappingURL=message-deliveries.d.ts.map
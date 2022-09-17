/// <reference types="node" />
import Libp2p, { Connection, EventEmitter } from 'libp2p';
import PeerId from 'peer-id';
import { MessageCache } from './message-cache';
import { RPC, IRPC } from './message/rpc';
import { PeerScoreParams, PeerScoreThresholds, PeerScoreStatsDump } from './score';
import { IWantTracer } from './tracer';
import { MetricsRegister, TopicStrToLabel } from './metrics';
import { GossipsubMessage, MessageAcceptance, MsgIdFn, SignaturePolicy, TopicStr, MsgIdStr, PeerIdStr, MessageStatus, RejectReasonObj, FastMsgIdFn, AddrInfo, DataTransform } from './types';
import { GossipsubOptsSpec } from './config';
interface BufferList {
    slice(): Buffer;
}
declare type ReceivedMessageResult = {
    code: MessageStatus.duplicate;
    msgId: MsgIdStr;
} | ({
    code: MessageStatus.invalid;
    msgId?: MsgIdStr;
} & RejectReasonObj) | {
    code: MessageStatus.valid;
    msgIdStr: MsgIdStr;
    msg: GossipsubMessage;
};
export declare const multicodec: string;
export declare type GossipsubOpts = GossipsubOptsSpec & {
    emitSelf: boolean;
    /** if can relay messages not subscribed */
    canRelayMessage: boolean;
    /** if incoming messages on a subscribed topic should be automatically gossiped */
    gossipIncoming: boolean;
    /** if dial should fallback to floodsub */
    fallbackToFloodsub: boolean;
    /** if self-published messages should be sent to all peers */
    floodPublish: boolean;
    /** whether PX is enabled; this should be enabled in bootstrappers and other well connected/trusted nodes. */
    doPX: boolean;
    /** peers with which we will maintain direct connections */
    directPeers: AddrInfo[];
    /**
     * If true will not forward messages to mesh peers until reportMessageValidationResult() is called.
     * Messages will be cached in mcache for some time after which they are evicted. Calling
     * reportMessageValidationResult() after the message is dropped from mcache won't forward the message.
     */
    asyncValidation: boolean;
    /** Do not throw `InsufficientPeers` error if publishing to zero peers */
    allowPublishToZeroPeers: boolean;
    /** For a single stream, await processing each RPC before processing the next */
    awaitRpcHandler: boolean;
    /** For a single RPC, await processing each message before processing the next */
    awaitRpcMessageHandler: boolean;
    msgIdFn: MsgIdFn;
    /** fast message id function */
    fastMsgIdFn: FastMsgIdFn;
    /** override the default MessageCache */
    messageCache: MessageCache;
    /** signing policy to apply across all messages */
    globalSignaturePolicy: SignaturePolicy | undefined;
    /** peer score parameters */
    scoreParams: Partial<PeerScoreParams>;
    /** peer score thresholds */
    scoreThresholds: Partial<PeerScoreThresholds>;
    /** customize GossipsubIWantFollowupTime in order not to apply IWANT penalties */
    gossipsubIWantFollowupMs: number;
    dataTransform?: DataTransform;
    metricsRegister?: MetricsRegister | null;
    metricsTopicStrToLabel?: TopicStrToLabel;
    /** Prefix tag for debug logs */
    debugName?: string;
    dandelionD?: number;
    dandelionStemHi?: number;
    dandelionStemLo?: number;
};
export declare type GossipsubEvents = {
    'gossipsub:message': {
        propagationSource: PeerId;
        msgId: MsgIdStr;
        msg: GossipsubMessage;
    };
};
interface GossipOptions extends GossipsubOpts {
    scoreParams: PeerScoreParams;
    scoreThresholds: PeerScoreThresholds;
}
export default class Gossipsub extends EventEmitter {
    /**
     * The signature policy to follow by default
     */
    private readonly globalSignaturePolicy;
    private readonly publishConfig;
    private readonly dataTransform;
    private readonly peers;
    /** Direct peers */
    private readonly direct;
    /** Floodsub peers */
    private readonly floodsubPeers;
    /** Cache of seen messages */
    private readonly seenCache;
    /**
     * Map of peer id and AcceptRequestWhileListEntry
     */
    private readonly acceptFromWhitelist;
    /**
     * Map of topics to which peers are subscribed to
     */
    private readonly topics;
    /**
     * List of our subscriptions
     */
    private readonly subscriptions;
    /**
     * Map of topic meshes
     * topic => peer id set
     */
    private readonly mesh;
    /**
     * Map of topics to set of peers. These mesh peers are the ones to which we are publishing without a topic membership
     * topic => peer id set
     */
    private readonly fanout;
    /**
     * Map of last publish time for fanout topics
     * topic => last publish time
     */
    private readonly fanoutLastpub;
    /**
     * Map of pending messages to gossip
     * peer id => control messages
     */
    private readonly gossip;
    /**
     * Map of control messages
     * peer id => control message
     */
    private readonly control;
    /**
     * Number of IHAVEs received from peer in the last heartbeat
     */
    private readonly peerhave;
    /** Number of messages we have asked from peer in the last heartbeat */
    private readonly iasked;
    /** Prune backoff map */
    private readonly backoff;
    /**
     * Connection direction cache, marks peers with outbound connections
     * peer id => direction
     */
    private readonly outbound;
    private readonly msgIdFn;
    /**
     * A fast message id function used for internal message de-duplication
     */
    private readonly fastMsgIdFn;
    /** Maps fast message-id to canonical message-id */
    private readonly fastMsgIdCache;
    /**
     * Short term cache for published message ids. This is used for penalizing peers sending
     * our own messages back if the messages are anonymous or use a random author.
     */
    private readonly publishedMessageIds;
    /**
     * A message cache that contains the messages for last few heartbeat ticks
     */
    private readonly mcache;
    /** Peer score tracking */
    private readonly score;
    private readonly topicValidators;
    /**
     * Number of heartbeats since the beginning of time
     * This allows us to amortize some resource cleanup -- eg: backoff cleanup
     */
    private heartbeatTicks;
    /**
     * Tracks IHAVE/IWANT promises broken by peers
     */
    readonly gossipTracer: IWantTracer;
    readonly _libp2p: Libp2p;
    readonly peerId: PeerId;
    readonly multicodecs: string[];
    private directPeerInitial;
    private log;
    static multicodec: string;
    readonly opts: GossipOptions;
    private readonly registrar;
    private readonly metrics;
    private status;
    private heartbeatTimer;
    constructor(libp2p: Libp2p, options?: Partial<GossipsubOpts>);
    /**
     * Mounts the gossipsub protocol onto the libp2p node and sends our
     * our subscriptions to every peer connected
     */
    start(): Promise<void>;
    /**
     * Unmounts the gossipsub protocol and shuts down every connection
     */
    stop(): Promise<void>;
    /** FOR DEBUG ONLY - Dump peer stats for all peers. Data is cloned, safe to mutate */
    dumpPeerScoreStats(): PeerScoreStatsDump;
    /**
     * On an inbound stream opened
     */
    private onIncomingStream;
    /**
     * Registrar notifies an established connection with pubsub protocol
     */
    protected onPeerConnected(peerId: PeerId, conn: Connection): Promise<void>;
    /**
     * Registrar notifies a closing connection with pubsub protocol
     */
    protected onPeerDisconnected(peerId: PeerId, err?: Error): void;
    /**
     * Add a peer to the router
     */
    private addPeer;
    /**
     * Removes a peer from the router
     */
    private removePeer;
    get started(): boolean;
    /**
     * Get a the peer-ids in a topic mesh
     */
    getMeshPeers(topic: TopicStr): PeerIdStr[];
    /**
     * Get a list of the peer-ids that are subscribed to one topic.
     */
    getSubscribers(topic: TopicStr): PeerIdStr[];
    /**
     * Get the list of topics which the peer is subscribed to.
     */
    getTopics(): TopicStr[];
    /**
     * Responsible for processing each RPC message received by other peers.
     */
    pipePeerReadStream(peerId: PeerId, stream: AsyncIterable<Uint8Array | BufferList>): Promise<void>;
    /**
     * Handles an rpc request from a peer
     */
    handleReceivedRpc(from: PeerId, rpc: IRPC): Promise<void>;
    /**
     * Handles a subscription change from a peer
     */
    handleReceivedSubscription(from: PeerId, subOpt: RPC.ISubOpts): void;
    /**
     * Handles a newly received message from an RPC.
     * May forward to all peers in the mesh.
     */
    handleReceivedMessage(from: PeerId, rpcMsg: RPC.IMessage): Promise<void>;
    /**
     * Handles a newly received message from an RPC.
     * May forward to all peers in the mesh.
     */
    validateReceivedMessage(propagationSource: PeerId, rpcMsg: RPC.IMessage): Promise<ReceivedMessageResult>;
    /**
     * Return score of a peer.
     */
    getScore(peerId: PeerIdStr): number;
    /**
     * Send an rpc object to a peer with subscriptions
     */
    private sendSubscriptions;
    /**
     * Handles an rpc control message from a peer
     */
    private handleControlMessage;
    /**
     * Whether to accept a message from a peer
     */
    private acceptFrom;
    /**
     * Handles IHAVE messages
     */
    private handleIHave;
    /**
     * Handles IWANT messages
     * Returns messages to send back to peer
     */
    private handleIWant;
    /**
     * Handles Graft messages
     */
    private handleGraft;
    /**
     * Handles Prune messages
     */
    private handlePrune;
    /**
     * Add standard backoff log for a peer in a topic
     */
    private addBackoff;
    /**
     * Add backoff expiry interval for a peer in a topic
     * @param interval backoff duration in milliseconds
     */
    private doAddBackoff;
    /**
     * Apply penalties from broken IHAVE/IWANT promises
     */
    private applyIwantPenalties;
    /**
     * Clear expired backoff expiries
     */
    private clearBackoff;
    /**
     * Maybe reconnect to direct peers
     */
    private directConnect;
    /**
     * Maybe attempt connection given signed peer records
     */
    private pxConnect;
    /**
     * Connect to a peer using the gossipsub protocol
     */
    private connect;
    /**
     * Subscribes to a topic
     */
    subscribe(topic: TopicStr): void;
    /**
     * Unsubscribe to a topic
     */
    unsubscribe(topic: TopicStr): void;
    /**
     * Join topic
     */
    join(topic: TopicStr): void;
    /**
     * Leave topic
     */
    leave(topic: TopicStr): void;
    private selectPeersToForward;
    private selectPeersToPublish;
    /**
     * Forwards a message from our peers.
     *
     * For messages published by us (the app layer), this class uses `publish`
     */
    private forwardMessage;
    /**
     * App layer publishes a message to peers, return number of peers this message is published to
     * Note: `async` due to crypto only if `StrictSign`, otherwise it's a sync fn.
     *
     * For messages not from us, this class uses `forwardMessage`.
     */
    publish(topic: TopicStr, data: Uint8Array): Promise<number>;
    reportMessageValidationResult(msgId: MsgIdStr, propagationSource: PeerId, acceptance: MessageAcceptance): void;
    /**
     * Sends a GRAFT message to a peer
     */
    private sendGraft;
    /**
     * Sends a PRUNE message to a peer
     */
    private sendPrune;
    /**
     * Send an rpc object to a peer
     */
    private sendRpc;
    private piggybackControl;
    private piggybackGossip;
    /**
     * Send graft and prune messages
     * @param tograft peer id => topic[]
     * @param toprune peer id => topic[]
     */
    private sendGraftPrune;
    /**
     * Emits gossip to peers in a particular topic
     * @param exclude peers to exclude
     */
    private emitGossip;
    /**
     * Flush gossip and control messages
     */
    private flush;
    /**
     * Adds new IHAVE messages to pending gossip
     */
    private pushGossip;
    /**
     * Returns the current time in milliseconds
     */
    _now(): number;
    /**
     * Make a PRUNE control message for a peer in a topic
     */
    private makePrune;
    private runHeartbeat;
    /**
     * Maintains the mesh and fanout maps in gossipsub.
     */
    private heartbeat;
    /**
     * Given a topic, returns up to count peers subscribed to that topic
     * that pass an optional filter function
     *
     * @param filter a function to filter acceptable peers
     */
    private getRandomGossipPeers;
    private onScrapeMetrics;
}
export {};

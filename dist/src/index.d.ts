import { Logger } from '@libp2p/logger';
import type { PeerId } from '@libp2p/interface-peer-id';
import { EventEmitter } from '@libp2p/interfaces/events';
import { MessageCache } from './message-cache.js';
import { RPC, IRPC } from './message/rpc.js';
import { PeerScore, PeerScoreParams, PeerScoreThresholds, PeerScoreStatsDump } from './score/index.js';
import { IWantTracer } from './tracer.js';
import { MetricsRegister, TopicStrToLabel } from './metrics.js';
import { MsgIdFn, TopicStr, MsgIdStr, PeerIdStr, FastMsgIdFn, AddrInfo, DataTransform, MsgIdToStrFn, PublishOpts } from './types.js';
import type { GossipsubOptsSpec } from './config.js';
import { Message, PublishResult, PubSub, PubSubEvents, PubSubInit, StrictNoSign, StrictSign, TopicValidatorFn, TopicValidatorResult } from '@libp2p/interface-pubsub';
import type { Registrar } from '@libp2p/interface-registrar';
import { InboundStream, OutboundStream } from './stream.js';
import { DecodeRPCLimits } from './message/decodeRpc.js';
import { ConnectionManager } from '@libp2p/interface-connection-manager';
import { PeerStore } from '@libp2p/interface-peer-store';
export declare const multicodec: string;
export interface GossipsubOpts extends GossipsubOptsSpec, PubSubInit {
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
    /** Do not throw `PublishError.Duplicate` if publishing duplicate messages */
    ignoreDuplicatePublishError: boolean;
    /** For a single stream, await processing each RPC before processing the next */
    awaitRpcHandler: boolean;
    /** For a single RPC, await processing each message before processing the next */
    awaitRpcMessageHandler: boolean;
    /** message id function */
    msgIdFn: MsgIdFn;
    /** fast message id function */
    fastMsgIdFn: FastMsgIdFn;
    /** Uint8Array message id to string function */
    msgIdToStrFn: MsgIdToStrFn;
    /** override the default MessageCache */
    messageCache: MessageCache;
    /** peer score parameters */
    scoreParams: Partial<PeerScoreParams>;
    /** peer score thresholds */
    scoreThresholds: Partial<PeerScoreThresholds>;
    /** customize GossipsubIWantFollowupTime in order not to apply IWANT penalties */
    gossipsubIWantFollowupMs: number;
    /** override constants for fine tuning */
    prunePeers?: number;
    pruneBackoff?: number;
    graftFloodThreshold?: number;
    opportunisticGraftPeers?: number;
    opportunisticGraftTicks?: number;
    directConnectTicks?: number;
    dataTransform?: DataTransform;
    metricsRegister?: MetricsRegister | null;
    metricsTopicStrToLabel?: TopicStrToLabel;
    /** Prefix tag for debug logs */
    debugName?: string;
    /**
     * Specify the maximum number of inbound gossipsub protocol
     * streams that are allowed to be open concurrently
     */
    maxInboundStreams?: number;
    /**
     * Specify the maximum number of outbound gossipsub protocol
     * streams that are allowed to be open concurrently
     */
    maxOutboundStreams?: number;
    /**
     * Specify max buffer size in bytes for OutboundStream.
     * If full it will throw and reject sending any more data.
     */
    maxOutboundBufferSize?: number;
    /**
     * Specify max size to skip decoding messages whose data
     * section exceeds this size.
     *
     */
    maxInboundDataLength?: number;
    /**
     * If provided, only allow topics in this list
     */
    allowedTopics?: string[] | Set<string>;
    /**
     * Limits to bound protobuf decoding
     */
    decodeRpcLimits?: DecodeRPCLimits;
}
export interface GossipsubMessage {
    propagationSource: PeerId;
    msgId: MsgIdStr;
    msg: Message;
}
export interface GossipsubEvents extends PubSubEvents {
    'gossipsub:heartbeat': CustomEvent;
    'gossipsub:message': CustomEvent<GossipsubMessage>;
}
interface GossipOptions extends GossipsubOpts {
    scoreParams: PeerScoreParams;
    scoreThresholds: PeerScoreThresholds;
}
export interface GossipSubComponents {
    peerId: PeerId;
    peerStore: PeerStore;
    registrar: Registrar;
    connectionManager: ConnectionManager;
}
export declare class GossipSub extends EventEmitter<GossipsubEvents> implements PubSub<GossipsubEvents> {
    /**
     * The signature policy to follow by default
     */
    readonly globalSignaturePolicy: typeof StrictSign | typeof StrictNoSign;
    multicodecs: string[];
    private publishConfig;
    private readonly dataTransform;
    readonly peers: Set<string>;
    readonly streamsInbound: Map<string, InboundStream>;
    readonly streamsOutbound: Map<string, OutboundStream>;
    /** Ensures outbound streams are created sequentially */
    private outboundInflightQueue;
    /** Direct peers */
    readonly direct: Set<string>;
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
    readonly mesh: Map<string, Set<string>>;
    /**
     * Map of topics to set of peers. These mesh peers are the ones to which we are publishing without a topic membership
     * topic => peer id set
     */
    readonly fanout: Map<string, Set<string>>;
    /**
     * Map of last publish time for fanout topics
     * topic => last publish time
     */
    private readonly fanoutLastpub;
    /**
     * Map of pending messages to gossip
     * peer id => control messages
     */
    readonly gossip: Map<string, RPC.IControlIHave[]>;
    /**
     * Map of control messages
     * peer id => control message
     */
    readonly control: Map<string, RPC.IControlMessage>;
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
    private readonly msgIdToStrFn;
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
    readonly score: PeerScore;
    /**
     * Custom validator function per topic.
     * Must return or resolve quickly (< 100ms) to prevent causing penalties for late messages.
     * If you need to apply validation that may require longer times use `asyncValidation` option and callback the
     * validation result through `Gossipsub.reportValidationResult`
     */
    readonly topicValidators: Map<string, TopicValidatorFn>;
    /**
     * Make this protected so child class may want to redirect to its own log.
     */
    protected readonly log: Logger;
    /**
     * Number of heartbeats since the beginning of time
     * This allows us to amortize some resource cleanup -- eg: backoff cleanup
     */
    private heartbeatTicks;
    /**
     * Tracks IHAVE/IWANT promises broken by peers
     */
    readonly gossipTracer: IWantTracer;
    private readonly components;
    private directPeerInitial;
    static multicodec: string;
    readonly opts: Required<GossipOptions>;
    private readonly decodeRpcLimits;
    private readonly metrics;
    private status;
    private maxInboundStreams?;
    private maxOutboundStreams?;
    private allowedTopics;
    private heartbeatTimer;
    constructor(components: GossipSubComponents, options?: Partial<GossipsubOpts>);
    getPeers(): PeerId[];
    isStarted(): boolean;
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
    private onPeerConnected;
    /**
     * Registrar notifies a closing connection with pubsub protocol
     */
    private onPeerDisconnected;
    private createOutboundStream;
    private createInboundStream;
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
    getSubscribers(topic: TopicStr): PeerId[];
    /**
     * Get the list of topics which the peer is subscribed to.
     */
    getTopics(): TopicStr[];
    /**
     * Responsible for processing each RPC message received by other peers.
     */
    private pipePeerReadStream;
    /**
     * Handle error when read stream pipe throws, less of the functional use but more
     * to for testing purposes to spy on the error handling
     * */
    private handlePeerReadStreamError;
    /**
     * Handles an rpc request from a peer
     */
    handleReceivedRpc(from: PeerId, rpc: IRPC): Promise<void>;
    /**
     * Handles a subscription change from a peer
     */
    private handleReceivedSubscription;
    /**
     * Handles a newly received message from an RPC.
     * May forward to all peers in the mesh.
     */
    private handleReceivedMessage;
    /**
     * Handles a newly received message from an RPC.
     * May forward to all peers in the mesh.
     */
    private validateReceivedMessage;
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
    acceptFrom(id: PeerIdStr): boolean;
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
     *
     * @param id
     * @param topic
     * @param interval - backoff duration in milliseconds
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
    private join;
    /**
     * Leave topic
     */
    private leave;
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
    publish(topic: TopicStr, data: Uint8Array, opts?: PublishOpts): Promise<PublishResult>;
    /**
     * This function should be called when `asyncValidation` is `true` after
     * the message got validated by the caller. Messages are stored in the `mcache` and
     * validation is expected to be fast enough that the messages should still exist in the cache.
     * There are three possible validation outcomes and the outcome is given in acceptance.
     *
     * If acceptance = `MessageAcceptance.Accept` the message will get propagated to the
     * network. The `propagation_source` parameter indicates who the message was received by and
     * will not be forwarded back to that peer.
     *
     * If acceptance = `MessageAcceptance.Reject` the message will be deleted from the memcache
     * and the P₄ penalty will be applied to the `propagationSource`.
     *
     * If acceptance = `MessageAcceptance.Ignore` the message will be deleted from the memcache
     * but no P₄ penalty will be applied.
     *
     * This function will return true if the message was found in the cache and false if was not
     * in the cache anymore.
     *
     * This should only be called once per message.
     */
    reportMessageValidationResult(msgId: MsgIdStr, propagationSource: PeerId, acceptance: TopicValidatorResult): void;
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
    /** Mutates `outRpc` adding graft and prune control messages */
    piggybackControl(id: PeerIdStr, outRpc: IRPC, ctrl: RPC.IControlMessage): void;
    /** Mutates `outRpc` adding ihave control messages */
    private piggybackGossip;
    /**
     * Send graft and prune messages
     *
     * @param tograft - peer id => topic[]
     * @param toprune - peer id => topic[]
     */
    private sendGraftPrune;
    /**
     * Emits gossip - Send IHAVE messages to a random set of gossip peers
     */
    private emitGossip;
    /**
     * Send gossip messages to GossipFactor peers above threshold with a minimum of D_lazy
     * Peers are randomly selected from the heartbeat which exclude mesh + fanout peers
     * We also exclude direct peers, as there is no reason to emit gossip to them
     * @param topic
     * @param candidateToGossip - peers to gossip
     * @param messageIDs - message ids to gossip
     */
    private doEmitGossip;
    /**
     * Flush gossip and control messages
     */
    private flush;
    /**
     * Adds new IHAVE messages to pending gossip
     */
    private pushGossip;
    /**
     * Make a PRUNE control message for a peer in a topic
     */
    private makePrune;
    private readonly runHeartbeat;
    /**
     * Maintains the mesh and fanout maps in gossipsub.
     */
    heartbeat(): Promise<void>;
    /**
     * Given a topic, returns up to count peers subscribed to that topic
     * that pass an optional filter function
     *
     * @param topic
     * @param count
     * @param filter - a function to filter acceptable peers
     */
    private getRandomGossipPeers;
    private onScrapeMetrics;
}
export declare function gossipsub(init?: Partial<GossipsubOpts>): (components: GossipSubComponents) => PubSub<GossipsubEvents>;
export {};
//# sourceMappingURL=index.d.ts.map
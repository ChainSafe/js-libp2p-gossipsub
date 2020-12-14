export = BasicPubSub;
declare const BasicPubSub_base: any;
declare class BasicPubSub extends BasicPubSub_base {
    [x: string]: any;
    /**
     * @param {Object} props
     * @param {String} props.debugName log namespace
     * @param {string[]} props.multicodecs protocol identifiers to connect
     * @param {PeerId} props.peerId peer's peerId
     * @param {Object} props.registrar registrar for libp2p protocols
     * @param {function} props.registrar.handle
     * @param {function} props.registrar.register
     * @param {function} props.registrar.unregister
     * @param {Object} [props.options]
     * @param {boolean} [props.options.emitSelf] if publish should emit to self, if subscribed, defaults to false
     * @constructor
     */
    constructor({ debugName, multicodecs, peerId, registrar, options }: {
        debugName: string;
        multicodecs: string[];
        peerId: import("peer-id");
        registrar: {
            handle: Function;
            register: Function;
            unregister: Function;
        };
        options: {
            emitSelf: boolean;
        };
    });
    /**
     * A set of subscriptions
     */
    subscriptions: Set<any>;
    /**
     * Pubsub options
     */
    _options: {
        emitSelf: boolean;
    };
    /**
     * The default msgID implementation
     * @param {RPC.Message} msg the message object
     * @returns {string} message id as string
     */
    defaultMsgIdFn: (msg: any) => string;
    /**
     * Topic validator function
     * @typedef {function(string, Peer, RPC): boolean} validator
     */
    /**
     * Topic validator map
     *
     * Keyed by topic
     * Topic validators are functions with the following input:
     * @type {Map<string, validator>}
     */
    topicValidators: Map<string, (arg0: string, arg1: any, arg2: any) => boolean>;
    /**
     * Peer connected successfully with pubsub protocol.
     * @override
     * @param {PeerId} peerId peer id
     * @param {Connection} conn connection to the peer
     * @returns {Promise<void>}
     */
    _onPeerConnected(peerId: import("peer-id"), conn: any): Promise<void>;
    /**
     * Overriding the implementation of _processConnection should keep the connection and is
     * responsible for processing each RPC message received by other peers.
     * @override
     * @param {string} idB58Str peer id string in base58
     * @param {Connection} conn connection
     * @param {Peer} peer PubSub peer
     * @returns {void}
     *
     */
    _processMessages(idB58Str: string, conn: any, peer: any): void;
    /**
     * Decode a Uint8Array into an RPC object
     *
     * Override to use an extended protocol-specific protobuf decoder
     *
     * @param {Uint8Array} buf
     * @returns {RPC}
     */
    _decodeRpc(buf: Uint8Array): any;
    /**
     * Handles an rpc request from a peer
     *
     * @param {String} idB58Str
     * @param {Peer} peer
     * @param {RPC} rpc
     * @returns {void}
     */
    _processRpc(idB58Str: string, peer: any, rpc: any): void;
    /**
     * Validates the given message.
     * @param {RPC.Message} message
     * @param {Peer} [peer]
     * @returns {Promise<Boolean>}
     */
    validate(message: any, peer?: any): Promise<boolean>;
    /**
     * Coerces topic validator result to determine message validity
     *
     * Defaults to true if truthy
     *
     * Override this method to provide custom topic validator result processing (eg: scoring)
     *
     * @param {String} topic
     * @param {Peer} peer
     * @param {RPC.Message} message
     * @param {unknown} result
     * @returns {Boolean}
     */
    _processTopicValidatorResult(topic: string, peer: any, message: any, result: unknown): boolean;
    /**
     * Handles an subscription change from a peer
     *
     * @param {Peer} peer
     * @param {RPC.SubOpt} subOpt
     */
    _processRpcSubOpt(peer: any, subOpt: any): void;
    /**
     * Handles an message from a peer
     *
     * @param {Peer} peer
     * @param {RPC.Message} msg
     */
    _processRpcMessage(peer: any, msg: any): void;
    _emitMessage(topics: any, message: any): void;
    /**
     * Unmounts the protocol and shuts down every connection
     * @override
     * @returns {void}
     */
    stop(): void;
    /**
     * Subscribes to topics
     * @override
     * @param {Array<string>|string} topics
     * @returns {void}
     */
    subscribe(topics: Array<string> | string): void;
    /**
     * Subscribes to topics
     *
     * @param {Array<string>} topics
     * @returns {void}
     */
    _subscribe(topics: Array<string>): void;
    /**
     * Leaves a topic
     * @override
     * @param {Array<string>|string} topics
     * @returns {void}
     */
    unsubscribe(topics: Array<string> | string): void;
    /**
     * Unsubscribes to topics
     *
     * @param {Array<string>} topics
     * @returns {void}
     */
    _unsubscribe(topics: Array<string>): void;
    /**
     * Publishes messages to all subscribed peers
     * @override
     * @param {Array<string>|string} topics
     * @param {Array<any>|any} messages
     * @returns {void}
     */
    publish(topics: Array<string> | string, messages: Array<any> | any): void;
    /**
     * Get the list of topics which the peer is subscribed to.
     * @override
     * @returns {Array<String>}
     */
    getTopics(): Array<string>;
    /**
     * Child class can override this.
     * @param {RPC.Message} msg the message object
     * @returns {string} message id as string
     */
    getMsgId(msg: any): string;
    _emitMessages(topics: any, messages: any): void;
    /**
     * Publish messages
     *
     * Note: this function assumes all messages are well-formed RPC objects
     * @param {Array<Message>} msgs
     * @returns {void}
     */
    _publish(msgs: Array<any>): void;
}

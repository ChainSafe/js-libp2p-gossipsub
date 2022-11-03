// @ts-nocheck
import protobuf from "protobufjs/minimal.js";

// Common aliases
var $Reader = protobuf.Reader, $Writer = protobuf.Writer, $util = protobuf.util;
var $root = protobuf.roots["default"] || (protobuf.roots["default"] = {});
class RPC implements IRPC {

    /** RPC subscriptions. */
    public subscriptions: RPC.ISubOpts[];

    /** RPC messages. */
    public messages: RPC.IMessage[];

    /** RPC control. */
    public control?: (RPC.IControlMessage | null);

    /** RPC _control. */
    public _control?: "control";


    /**
     * Constructs a new RPC.
     * @param [p] Properties to set
     */
    constructor(p?: IRPC) {
        this.subscriptions = [];
        this.messages = [];
        if (p) {
            for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null)
                    this[ks[i]] = p[ks[i]];
        }

    };



    /**
     * Encodes the specified RPC message. Does not implicitly {@link RPC.verify|verify} messages.
     * @param m RPC message or plain object to encode
     * @param [w] Writer to encode to
     * @returns Writer
     */
    public static encode(m: IRPC, w?: protobuf.Writer): protobuf.Writer {
        if (!w)
            w = $Writer.create();
        if (m.subscriptions != null && m.subscriptions.length) {
            for (var i = 0; i < m.subscriptions.length; ++i)
                $root.RPC.SubOpts.encode(m.subscriptions[i], w.uint32(10).fork()).ldelim();
        }
        if (m.messages != null && m.messages.length) {
            for (var i = 0; i < m.messages.length; ++i)
                $root.RPC.Message.encode(m.messages[i], w.uint32(18).fork()).ldelim();
        }
        if (m.control != null && Object.hasOwnProperty.call(m, "control"))
            $root.RPC.ControlMessage.encode(m.control, w.uint32(26).fork()).ldelim();
        return w;
    }

    /**
     * Decodes a RPC message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns RPC
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC();
        while (r.pos < c) {
            var t = r.uint32();
            switch (t >>> 3) {
                case 1:
                    if (!(m.subscriptions && m.subscriptions.length))
                        m.subscriptions = [];
                    m.subscriptions.push($root.RPC.SubOpts.decode(r, r.uint32()));
                    break;
                case 2:
                    if (!(m.messages && m.messages.length))
                        m.messages = [];
                    m.messages.push($root.RPC.Message.decode(r, r.uint32()));
                    break;
                case 3:
                    m.control = $root.RPC.ControlMessage.decode(r, r.uint32());
                    break;
                default:
                    r.skipType(t & 7);
                    break;
            }
        }
        return m;
    }

    /**
     * Creates a RPC message from a plain object. Also converts values to their respective internal types.
     * @param d Plain object
     * @returns RPC
     */
    public static fromObject(d: { [k: string]: any }): RPC {
        if (d instanceof $root.RPC)
            return d;
        var m = new $root.RPC();
        if (d.subscriptions) {
            if (!Array.isArray(d.subscriptions))
                throw TypeError(".RPC.subscriptions: array expected");
            m.subscriptions = [];
            for (var i = 0; i < d.subscriptions.length; ++i) {
                if (typeof d.subscriptions[i] !== "object")
                    throw TypeError(".RPC.subscriptions: object expected");
                m.subscriptions[i] = $root.RPC.SubOpts.fromObject(d.subscriptions[i]);
            }
        }
        if (d.messages) {
            if (!Array.isArray(d.messages))
                throw TypeError(".RPC.messages: array expected");
            m.messages = [];
            for (var i = 0; i < d.messages.length; ++i) {
                if (typeof d.messages[i] !== "object")
                    throw TypeError(".RPC.messages: object expected");
                m.messages[i] = $root.RPC.Message.fromObject(d.messages[i]);
            }
        }
        if (d.control != null) {
            if (typeof d.control !== "object")
                throw TypeError(".RPC.control: object expected");
            m.control = $root.RPC.ControlMessage.fromObject(d.control);
        }
        return m;
    }

    /**
     * Creates a plain object from a RPC message. Also converts values to other types if specified.
     * @param m RPC
     * @param [o] Conversion options
     * @returns Plain object
     */
    public static toObject(m: RPC, o?: protobuf.IConversionOptions): { [k: string]: any } {
        if (!o)
            o = {};
        var d = {};
        if (o.arrays || o.defaults) {
            d.subscriptions = [];
            d.messages = [];
        }
        if (m.subscriptions && m.subscriptions.length) {
            d.subscriptions = [];
            for (var j = 0; j < m.subscriptions.length; ++j) {
                d.subscriptions[j] = $root.RPC.SubOpts.toObject(m.subscriptions[j], o);
            }
        }
        if (m.messages && m.messages.length) {
            d.messages = [];
            for (var j = 0; j < m.messages.length; ++j) {
                d.messages[j] = $root.RPC.Message.toObject(m.messages[j], o);
            }
        }
        if (m.control != null && m.hasOwnProperty("control")) {
            d.control = $root.RPC.ControlMessage.toObject(m.control, o);
            if (o.oneofs)
                d._control = "control";
        }
        return d;
    }

    /**
     * Converts this RPC to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any } {
        return this.constructor.toObject(this, protobuf.util.toJSONOptions)
    }



}

$root.RPC = RPC;
namespace RPC {


    /** Properties of a SubOpts. */
    export interface ISubOpts {

        /** SubOpts subscribe */
        subscribe?: (boolean | null);

        /** SubOpts topic */
        topic?: (string | null);
    }


    /** Represents a SubOpts. */
    export class SubOpts implements ISubOpts {

        /**
         * Constructs a new SubOpts.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.ISubOpts) {
            this.topic = null;
            this.subscribe = null;
            if (p) {
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
            }

        }



        /** SubOpts subscribe. */
        public subscribe?: (boolean | null);

        /** SubOpts topic. */
        public topic?: (string | null);

        /** SubOpts _subscribe. */
        public _subscribe?: "subscribe";

        /** SubOpts _topic. */
        public _topic?: "topic";

        /**
         * Encodes the specified SubOpts message. Does not implicitly {@link RPC.SubOpts.verify|verify} messages.
         * @param m SubOpts message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.ISubOpts, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.subscribe != null && Object.hasOwnProperty.call(m, "subscribe"))
                w.uint32(8).bool(m.subscribe);
            if (m.topic != null && Object.hasOwnProperty.call(m, "topic"))
                w.uint32(18).string(m.topic);
            return w;
        }

        /**
         * Decodes a SubOpts message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns SubOpts
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.SubOpts {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.SubOpts();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        m.subscribe = r.bool();
                        break;
                    case 2:
                        m.topic = r.string();
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a SubOpts message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns SubOpts
         */
        public static fromObject(d: { [k: string]: any }): RPC.SubOpts {
            if (d instanceof $root.RPC.SubOpts)
                return d;
            var m = new $root.RPC.SubOpts();
            if (d.subscribe != null) {
                m.subscribe = Boolean(d.subscribe);
            }
            if (d.topic != null) {
                m.topic = String(d.topic);
            }
            return m;
        }

        /**
         * Creates a plain object from a SubOpts message. Also converts values to other types if specified.
         * @param m SubOpts
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.SubOpts, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (m.subscribe != null && m.hasOwnProperty("subscribe")) {
                d.subscribe = m.subscribe;
                if (o.oneofs)
                    d._subscribe = "subscribe";
            }
            if (m.topic != null && m.hasOwnProperty("topic")) {
                d.topic = m.topic;
                if (o.oneofs)
                    d._topic = "topic";
            }
            return d;
        }

        /**
         * Converts this SubOpts to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);
        }
    }

    /** Properties of a Message. */
    export interface IMessage {

        /** Message from */
        from?: (Uint8Array | null);

        /** Message data */
        data?: (Uint8Array | null);

        /** Message seqno */
        seqno?: (Uint8Array | null);

        /** Message topic */
        topic: string;

        /** Message signature */
        signature?: (Uint8Array | null);

        /** Message key */
        key?: (Uint8Array | null);
    }

    /** Represents a Message. */
    export class Message implements IMessage {

        /**
         * Constructs a new Message.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IMessage) {
            this.topic = "",
                this.from = null;
            this.data = null;
            this.seqno = null;
            this.signature = null;
            this.key = null;

            if (p) {
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
            }

        }

        /** Message from. */
        public from?: (Uint8Array | null);

        /** Message data. */
        public data?: (Uint8Array | null);

        /** Message seqno. */
        public seqno?: (Uint8Array | null);

        /** Message topic. */
        public topic: string;

        /** Message signature. */
        public signature?: (Uint8Array | null);

        /** Message key. */
        public key?: (Uint8Array | null);

        /** Message _from. */
        public _from?: "from";

        /** Message _data. */
        public _data?: "data";

        /** Message _seqno. */
        public _seqno?: "seqno";

        /** Message _signature. */
        public _signature?: "signature";

        /** Message _key. */
        public _key?: "key";

        /**
         * Encodes the specified Message message. Does not implicitly {@link RPC.Message.verify|verify} messages.
         * @param m Message message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IMessage, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.from != null && Object.hasOwnProperty.call(m, "from"))
                w.uint32(10).bytes(m.from);
            if (m.data != null && Object.hasOwnProperty.call(m, "data"))
                w.uint32(18).bytes(m.data);
            if (m.seqno != null && Object.hasOwnProperty.call(m, "seqno"))
                w.uint32(26).bytes(m.seqno);
            w.uint32(34).string(m.topic);
            if (m.signature != null && Object.hasOwnProperty.call(m, "signature"))
                w.uint32(42).bytes(m.signature);
            if (m.key != null && Object.hasOwnProperty.call(m, "key"))
                w.uint32(50).bytes(m.key);
            return w;
        }

        /**
         * Decodes a Message message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.Message {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.Message();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        m.from = r.bytes();
                        break;
                    case 2:
                        m.data = r.bytes();
                        break;
                    case 3:
                        m.seqno = r.bytes();
                        break;
                    case 4:
                        m.topic = r.string();
                        break;
                    case 5:
                        m.signature = r.bytes();
                        break;
                    case 6:
                        m.key = r.bytes();
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            if (!m.hasOwnProperty("topic"))
                throw $util.ProtocolError("missing required 'topic'", { instance: m });
            return m;
        }

        /**
         * Creates a Message message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns Message
         */
        public static fromObject(d: { [k: string]: any }): RPC.Message {
            if (d instanceof $root.RPC.Message)
                return d;
            var m = new $root.RPC.Message();
            if (d.from != null) {
                if (typeof d.from === "string")
                    $util.base64.decode(d.from, m.from = $util.newBuffer($util.base64.length(d.from)), 0);
                else if (d.from.length)
                    m.from = d.from;
            }
            if (d.data != null) {
                if (typeof d.data === "string")
                    $util.base64.decode(d.data, m.data = $util.newBuffer($util.base64.length(d.data)), 0);
                else if (d.data.length)
                    m.data = d.data;
            }
            if (d.seqno != null) {
                if (typeof d.seqno === "string")
                    $util.base64.decode(d.seqno, m.seqno = $util.newBuffer($util.base64.length(d.seqno)), 0);
                else if (d.seqno.length)
                    m.seqno = d.seqno;
            }
            if (d.topic != null) {
                m.topic = String(d.topic);
            }
            if (d.signature != null) {
                if (typeof d.signature === "string")
                    $util.base64.decode(d.signature, m.signature = $util.newBuffer($util.base64.length(d.signature)), 0);
                else if (d.signature.length)
                    m.signature = d.signature;
            }
            if (d.key != null) {
                if (typeof d.key === "string")
                    $util.base64.decode(d.key, m.key = $util.newBuffer($util.base64.length(d.key)), 0);
                else if (d.key.length)
                    m.key = d.key;
            }
            return m;
        }

        /**
         * Creates a plain object from a Message message. Also converts values to other types if specified.
         * @param m Message
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.Message, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (o.defaults) {
                d.topic = "";
            }
            if (m.from != null && m.hasOwnProperty("from")) {
                d.from = o.bytes === String ? $util.base64.encode(m.from, 0, m.from.length) : o.bytes === Array ? Array.prototype.slice.call(m.from) : m.from;
                if (o.oneofs)
                    d._from = "from";
            }
            if (m.data != null && m.hasOwnProperty("data")) {
                d.data = o.bytes === String ? $util.base64.encode(m.data, 0, m.data.length) : o.bytes === Array ? Array.prototype.slice.call(m.data) : m.data;
                if (o.oneofs)
                    d._data = "data";
            }
            if (m.seqno != null && m.hasOwnProperty("seqno")) {
                d.seqno = o.bytes === String ? $util.base64.encode(m.seqno, 0, m.seqno.length) : o.bytes === Array ? Array.prototype.slice.call(m.seqno) : m.seqno;
                if (o.oneofs)
                    d._seqno = "seqno";
            }
            if (m.topic != null && m.hasOwnProperty("topic")) {
                d.topic = m.topic;
            }
            if (m.signature != null && m.hasOwnProperty("signature")) {
                d.signature = o.bytes === String ? $util.base64.encode(m.signature, 0, m.signature.length) : o.bytes === Array ? Array.prototype.slice.call(m.signature) : m.signature;
                if (o.oneofs)
                    d._signature = "signature";
            }
            if (m.key != null && m.hasOwnProperty("key")) {
                d.key = o.bytes === String ? $util.base64.encode(m.key, 0, m.key.length) : o.bytes === Array ? Array.prototype.slice.call(m.key) : m.key;
                if (o.oneofs)
                    d._key = "key";
            }
            return d;
        }

        /**
         * Converts this Message to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);
        }
    }

    /** Properties of a ControlMessage. */
    export interface IControlMessage {

        /** ControlMessage ihave */
        ihave?: (RPC.IControlIHave[] | null);

        /** ControlMessage iwant */
        iwant?: (RPC.IControlIWant[] | null);

        /** ControlMessage graft */
        graft?: (RPC.IControlGraft[] | null);

        /** ControlMessage prune */
        prune?: (RPC.IControlPrune[] | null);
    }

    /** Represents a ControlMessage. */
    export class ControlMessage implements IControlMessage {

        /**
         * Constructs a new ControlMessage.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IControlMessage) {
            this.ihave = [];
            this.iwant = [];
            this.graft = [];
            this.prune = [];
            if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
        }

        /** ControlMessage ihave. */
        public ihave: RPC.IControlIHave[];

        /** ControlMessage iwant. */
        public iwant: RPC.IControlIWant[];

        /** ControlMessage graft. */
        public graft: RPC.IControlGraft[];

        /** ControlMessage prune. */
        public prune: RPC.IControlPrune[];

        /**
         * Encodes the specified ControlMessage message. Does not implicitly {@link RPC.ControlMessage.verify|verify} messages.
         * @param m ControlMessage message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IControlMessage, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.ihave != null && m.ihave.length) {
                for (var i = 0; i < m.ihave.length; ++i)
                    $root.RPC.ControlIHave.encode(m.ihave[i], w.uint32(10).fork()).ldelim();
            }
            if (m.iwant != null && m.iwant.length) {
                for (var i = 0; i < m.iwant.length; ++i)
                    $root.RPC.ControlIWant.encode(m.iwant[i], w.uint32(18).fork()).ldelim();
            }
            if (m.graft != null && m.graft.length) {
                for (var i = 0; i < m.graft.length; ++i)
                    $root.RPC.ControlGraft.encode(m.graft[i], w.uint32(26).fork()).ldelim();
            }
            if (m.prune != null && m.prune.length) {
                for (var i = 0; i < m.prune.length; ++i)
                    $root.RPC.ControlPrune.encode(m.prune[i], w.uint32(34).fork()).ldelim();
            }
            return w;
        }

        /**
         * Decodes a ControlMessage message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns ControlMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.ControlMessage {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.ControlMessage();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        if (!(m.ihave && m.ihave.length))
                            m.ihave = [];
                        m.ihave.push($root.RPC.ControlIHave.decode(r, r.uint32()));
                        break;
                    case 2:
                        if (!(m.iwant && m.iwant.length))
                            m.iwant = [];
                        m.iwant.push($root.RPC.ControlIWant.decode(r, r.uint32()));
                        break;
                    case 3:
                        if (!(m.graft && m.graft.length))
                            m.graft = [];
                        m.graft.push($root.RPC.ControlGraft.decode(r, r.uint32()));
                        break;
                    case 4:
                        if (!(m.prune && m.prune.length))
                            m.prune = [];
                        m.prune.push($root.RPC.ControlPrune.decode(r, r.uint32()));
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a ControlMessage message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns ControlMessage
         */
        public static fromObject(d: { [k: string]: any }): RPC.ControlMessage {
            if (d instanceof $root.RPC.ControlMessage)
                return d;
            var m = new $root.RPC.ControlMessage();
            if (d.ihave) {
                if (!Array.isArray(d.ihave))
                    throw TypeError(".RPC.ControlMessage.ihave: array expected");
                m.ihave = [];
                for (var i = 0; i < d.ihave.length; ++i) {
                    if (typeof d.ihave[i] !== "object")
                        throw TypeError(".RPC.ControlMessage.ihave: object expected");
                    m.ihave[i] = $root.RPC.ControlIHave.fromObject(d.ihave[i]);
                }
            }
            if (d.iwant) {
                if (!Array.isArray(d.iwant))
                    throw TypeError(".RPC.ControlMessage.iwant: array expected");
                m.iwant = [];
                for (var i = 0; i < d.iwant.length; ++i) {
                    if (typeof d.iwant[i] !== "object")
                        throw TypeError(".RPC.ControlMessage.iwant: object expected");
                    m.iwant[i] = $root.RPC.ControlIWant.fromObject(d.iwant[i]);
                }
            }
            if (d.graft) {
                if (!Array.isArray(d.graft))
                    throw TypeError(".RPC.ControlMessage.graft: array expected");
                m.graft = [];
                for (var i = 0; i < d.graft.length; ++i) {
                    if (typeof d.graft[i] !== "object")
                        throw TypeError(".RPC.ControlMessage.graft: object expected");
                    m.graft[i] = $root.RPC.ControlGraft.fromObject(d.graft[i]);
                }
            }
            if (d.prune) {
                if (!Array.isArray(d.prune))
                    throw TypeError(".RPC.ControlMessage.prune: array expected");
                m.prune = [];
                for (var i = 0; i < d.prune.length; ++i) {
                    if (typeof d.prune[i] !== "object")
                        throw TypeError(".RPC.ControlMessage.prune: object expected");
                    m.prune[i] = $root.RPC.ControlPrune.fromObject(d.prune[i]);
                }
            }
            return m;
        }

        /**
         * Creates a plain object from a ControlMessage message. Also converts values to other types if specified.
         * @param m ControlMessage
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.ControlMessage, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (o.arrays || o.defaults) {
                d.ihave = [];
                d.iwant = [];
                d.graft = [];
                d.prune = [];
            }
            if (m.ihave && m.ihave.length) {
                d.ihave = [];
                for (var j = 0; j < m.ihave.length; ++j) {
                    d.ihave[j] = $root.RPC.ControlIHave.toObject(m.ihave[j], o);
                }
            }
            if (m.iwant && m.iwant.length) {
                d.iwant = [];
                for (var j = 0; j < m.iwant.length; ++j) {
                    d.iwant[j] = $root.RPC.ControlIWant.toObject(m.iwant[j], o);
                }
            }
            if (m.graft && m.graft.length) {
                d.graft = [];
                for (var j = 0; j < m.graft.length; ++j) {
                    d.graft[j] = $root.RPC.ControlGraft.toObject(m.graft[j], o);
                }
            }
            if (m.prune && m.prune.length) {
                d.prune = [];
                for (var j = 0; j < m.prune.length; ++j) {
                    d.prune[j] = $root.RPC.ControlPrune.toObject(m.prune[j], o);
                }
            }
            return d;
        }

        /**
         * Converts this ControlMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);

        }
    }

    /** Properties of a ControlIHave. */
    export interface IControlIHave {

        /** ControlIHave topicID */
        topicID?: (string | null);

        /** ControlIHave messageIDs */
        messageIDs?: (Uint8Array[] | null);
    }

    /** Represents a ControlIHave. */
    export class ControlIHave implements IControlIHave {

        /**
         * Constructs a new ControlIHave.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IControlIHave) {
            this.messageIDs = [];
            this.topicID = null;
            if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
        }

        /** ControlIHave topicID. */
        public topicID?: (string | null);

        /** ControlIHave messageIDs. */
        public messageIDs: Uint8Array[];

        /** ControlIHave _topicID. */
        public _topicID?: "topicID";

        /**
         * Encodes the specified ControlIHave message. Does not implicitly {@link RPC.ControlIHave.verify|verify} messages.
         * @param m ControlIHave message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IControlIHave, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.topicID != null && Object.hasOwnProperty.call(m, "topicID"))
                w.uint32(10).string(m.topicID);
            if (m.messageIDs != null && m.messageIDs.length) {
                for (var i = 0; i < m.messageIDs.length; ++i)
                    w.uint32(18).bytes(m.messageIDs[i]);
            }
            return w;
        }

        /**
         * Decodes a ControlIHave message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns ControlIHave
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.ControlIHave {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.ControlIHave();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        m.topicID = r.string();
                        break;
                    case 2:
                        if (!(m.messageIDs && m.messageIDs.length))
                            m.messageIDs = [];
                        m.messageIDs.push(r.bytes());
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a ControlIHave message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns ControlIHave
         */
        public static fromObject(d: { [k: string]: any }): RPC.ControlIHave {
            if (d instanceof $root.RPC.ControlIHave)
                return d;
            var m = new $root.RPC.ControlIHave();
            if (d.topicID != null) {
                m.topicID = String(d.topicID);
            }
            if (d.messageIDs) {
                if (!Array.isArray(d.messageIDs))
                    throw TypeError(".RPC.ControlIHave.messageIDs: array expected");
                m.messageIDs = [];
                for (var i = 0; i < d.messageIDs.length; ++i) {
                    if (typeof d.messageIDs[i] === "string")
                        $util.base64.decode(d.messageIDs[i], m.messageIDs[i] = $util.newBuffer($util.base64.length(d.messageIDs[i])), 0);
                    else if (d.messageIDs[i].length)
                        m.messageIDs[i] = d.messageIDs[i];
                }
            }
            return m;
        }

        /**
         * Creates a plain object from a ControlIHave message. Also converts values to other types if specified.
         * @param m ControlIHave
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.ControlIHave, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (o.arrays || o.defaults) {
                d.messageIDs = [];
            }
            if (m.topicID != null && m.hasOwnProperty("topicID")) {
                d.topicID = m.topicID;
                if (o.oneofs)
                    d._topicID = "topicID";
            }
            if (m.messageIDs && m.messageIDs.length) {
                d.messageIDs = [];
                for (var j = 0; j < m.messageIDs.length; ++j) {
                    d.messageIDs[j] = o.bytes === String ? $util.base64.encode(m.messageIDs[j], 0, m.messageIDs[j].length) : o.bytes === Array ? Array.prototype.slice.call(m.messageIDs[j]) : m.messageIDs[j];
                }
            }
            return d;
        }

        /**
         * Converts this ControlIHave to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);
        }
    }

    /** Properties of a ControlIWant. */
    export interface IControlIWant {

        /** ControlIWant messageIDs */
        messageIDs?: (Uint8Array[] | null);
    }

    /** Represents a ControlIWant. */
    export class ControlIWant implements IControlIWant {

        /**
         * Constructs a new ControlIWant.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IControlIWant) {
            this.messageIDs = [];
            if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
        }

        /** ControlIWant messageIDs. */
        public messageIDs: Uint8Array[];

        /**
         * Encodes the specified ControlIWant message. Does not implicitly {@link RPC.ControlIWant.verify|verify} messages.
         * @param m ControlIWant message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IControlIWant, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.messageIDs != null && m.messageIDs.length) {
                for (var i = 0; i < m.messageIDs.length; ++i)
                    w.uint32(10).bytes(m.messageIDs[i]);
            }
            return w;
        }

        /**
         * Decodes a ControlIWant message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns ControlIWant
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.ControlIWant {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.ControlIWant();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        if (!(m.messageIDs && m.messageIDs.length))
                            m.messageIDs = [];
                        m.messageIDs.push(r.bytes());
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a ControlIWant message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns ControlIWant
         */
        public static fromObject(d: { [k: string]: any }): RPC.ControlIWant {
            if (d instanceof $root.RPC.ControlIWant)
                return d;
            var m = new $root.RPC.ControlIWant();
            if (d.messageIDs) {
                if (!Array.isArray(d.messageIDs))
                    throw TypeError(".RPC.ControlIWant.messageIDs: array expected");
                m.messageIDs = [];
                for (var i = 0; i < d.messageIDs.length; ++i) {
                    if (typeof d.messageIDs[i] === "string")
                        $util.base64.decode(d.messageIDs[i], m.messageIDs[i] = $util.newBuffer($util.base64.length(d.messageIDs[i])), 0);
                    else if (d.messageIDs[i].length)
                        m.messageIDs[i] = d.messageIDs[i];
                }
            }
            return m;
        }

        /**
         * Creates a plain object from a ControlIWant message. Also converts values to other types if specified.
         * @param m ControlIWant
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.ControlIWant, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (o.arrays || o.defaults) {
                d.messageIDs = [];
            }
            if (m.messageIDs && m.messageIDs.length) {
                d.messageIDs = [];
                for (var j = 0; j < m.messageIDs.length; ++j) {
                    d.messageIDs[j] = o.bytes === String ? $util.base64.encode(m.messageIDs[j], 0, m.messageIDs[j].length) : o.bytes === Array ? Array.prototype.slice.call(m.messageIDs[j]) : m.messageIDs[j];
                }
            }
            return d;
        }

        /**
         * Converts this ControlIWant to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);
        }
    }

    /** Properties of a ControlGraft. */
    export interface IControlGraft {

        /** ControlGraft topicID */
        topicID?: (string | null);
    }

    /** Represents a ControlGraft. */
    export class ControlGraft implements IControlGraft {

        /**
         * Constructs a new ControlGraft.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IControlGraft) {
            this.topicID = null;
            if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
        }

        /** ControlGraft topicID. */
        public topicID?: (string | null);

        /** ControlGraft _topicID. */
        public _topicID?: "topicID";

        /**
         * Encodes the specified ControlGraft message. Does not implicitly {@link RPC.ControlGraft.verify|verify} messages.
         * @param m ControlGraft message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IControlGraft, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.topicID != null && Object.hasOwnProperty.call(m, "topicID"))
                w.uint32(10).string(m.topicID);
            return w;
        }

        /**
         * Decodes a ControlGraft message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns ControlGraft
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.ControlGraft {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.ControlGraft();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        m.topicID = r.string();
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a ControlGraft message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns ControlGraft
         */
        public static fromObject(d: { [k: string]: any }): RPC.ControlGraft {
            if (d instanceof $root.RPC.ControlGraft)
                return d;
            var m = new $root.RPC.ControlGraft();
            if (d.topicID != null) {
                m.topicID = String(d.topicID);
            }
            return m;
        }

        /**
         * Creates a plain object from a ControlGraft message. Also converts values to other types if specified.
         * @param m ControlGraft
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.ControlGraft, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (m.topicID != null && m.hasOwnProperty("topicID")) {
                d.topicID = m.topicID;
                if (o.oneofs)
                    d._topicID = "topicID";
            }
            return d;
        }

        /**
         * Converts this ControlGraft to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);
        }
    }

    /** Properties of a ControlPrune. */
    export interface IControlPrune {

        /** ControlPrune topicID */
        topicID?: (string | null);

        /** ControlPrune peers */
        peers?: (RPC.IPeerInfo[] | null);

        /** ControlPrune backoff */
        backoff?: (number | null);
    }

    /** Represents a ControlPrune. */
    export class ControlPrune implements IControlPrune {

        /**
         * Constructs a new ControlPrune.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IControlPrune) {
            this.topicID = null;
            this.backoff = null;
            this.peers = [];
            if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
        }

        /** ControlPrune topicID. */
        public topicID?: (string | null);

        /** ControlPrune peers. */
        public peers: RPC.IPeerInfo[];

        /** ControlPrune backoff. */
        public backoff?: (number | null);

        /** ControlPrune _topicID. */
        public _topicID?: "topicID";

        /** ControlPrune _backoff. */
        public _backoff?: "backoff";

        /**
         * Encodes the specified ControlPrune message. Does not implicitly {@link RPC.ControlPrune.verify|verify} messages.
         * @param m ControlPrune message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IControlPrune, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.topicID != null && Object.hasOwnProperty.call(m, "topicID"))
                w.uint32(10).string(m.topicID);
            if (m.peers != null && m.peers.length) {
                for (var i = 0; i < m.peers.length; ++i)
                    $root.RPC.PeerInfo.encode(m.peers[i], w.uint32(18).fork()).ldelim();
            }
            if (m.backoff != null && Object.hasOwnProperty.call(m, "backoff"))
                w.uint32(24).uint64(m.backoff);
            return w;
        }

        /**
         * Decodes a ControlPrune message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns ControlPrune
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.ControlPrune {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.ControlPrune();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        m.topicID = r.string();
                        break;
                    case 2:
                        if (!(m.peers && m.peers.length))
                            m.peers = [];
                        m.peers.push($root.RPC.PeerInfo.decode(r, r.uint32()));
                        break;
                    case 3:
                        m.backoff = r.uint64();
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a ControlPrune message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns ControlPrune
         */
        public static fromObject(d: { [k: string]: any }): RPC.ControlPrune {
            if (d instanceof $root.RPC.ControlPrune)
                return d;
            var m = new $root.RPC.ControlPrune();
            if (d.topicID != null) {
                m.topicID = String(d.topicID);
            }
            if (d.peers) {
                if (!Array.isArray(d.peers))
                    throw TypeError(".RPC.ControlPrune.peers: array expected");
                m.peers = [];
                for (var i = 0; i < d.peers.length; ++i) {
                    if (typeof d.peers[i] !== "object")
                        throw TypeError(".RPC.ControlPrune.peers: object expected");
                    m.peers[i] = $root.RPC.PeerInfo.fromObject(d.peers[i]);
                }
            }
            if (d.backoff != null) {
                if ($util.Long)
                    (m.backoff = $util.Long.fromValue(d.backoff)).unsigned = true;
                else if (typeof d.backoff === "string")
                    m.backoff = parseInt(d.backoff, 10);
                else if (typeof d.backoff === "number")
                    m.backoff = d.backoff;
                else if (typeof d.backoff === "object")
                    m.backoff = new $util.LongBits(d.backoff.low >>> 0, d.backoff.high >>> 0).toNumber(true);
            }
            return m;
        }

        /**
         * Creates a plain object from a ControlPrune message. Also converts values to other types if specified.
         * @param m ControlPrune
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.ControlPrune, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (o.arrays || o.defaults) {
                d.peers = [];
            }
            if (m.topicID != null && m.hasOwnProperty("topicID")) {
                d.topicID = m.topicID;
                if (o.oneofs)
                    d._topicID = "topicID";
            }
            if (m.peers && m.peers.length) {
                d.peers = [];
                for (var j = 0; j < m.peers.length; ++j) {
                    d.peers[j] = $root.RPC.PeerInfo.toObject(m.peers[j], o);
                }
            }
            if (m.backoff != null && m.hasOwnProperty("backoff")) {
                if (typeof m.backoff === "number")
                    d.backoff = o.longs === String ? String(m.backoff) : m.backoff;
                else
                    d.backoff = o.longs === String ? $util.Long.prototype.toString.call(m.backoff) : o.longs === Number ? new $util.LongBits(m.backoff.low >>> 0, m.backoff.high >>> 0).toNumber(true) : m.backoff;
                if (o.oneofs)
                    d._backoff = "backoff";
            }
            return d;
        }

        /**
         * Converts this ControlPrune to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);

        }
    }

    /** Properties of a PeerInfo. */
    export interface IPeerInfo {

        /** PeerInfo peerID */
        peerID?: (Uint8Array | null);

        /** PeerInfo signedPeerRecord */
        signedPeerRecord?: (Uint8Array | null);
    }

    /** Represents a PeerInfo. */
    export class PeerInfo implements IPeerInfo {

        /**
         * Constructs a new PeerInfo.
         * @param [p] Properties to set
         */
        constructor(p?: RPC.IPeerInfo) {
            this.peerID = null;
            this.signedPeerRecord = null;
            if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                    if (p[ks[i]] != null)
                        this[ks[i]] = p[ks[i]];
        }

        /** PeerInfo peerID. */
        public peerID?: (Uint8Array | null);

        /** PeerInfo signedPeerRecord. */
        public signedPeerRecord?: (Uint8Array | null);

        /** PeerInfo _peerID. */
        public _peerID?: "peerID";

        /** PeerInfo _signedPeerRecord. */
        public _signedPeerRecord?: "signedPeerRecord";

        /**
         * Encodes the specified PeerInfo message. Does not implicitly {@link RPC.PeerInfo.verify|verify} messages.
         * @param m PeerInfo message or plain object to encode
         * @param [w] Writer to encode to
         * @returns Writer
         */
        public static encode(m: RPC.IPeerInfo, w?: protobuf.Writer): protobuf.Writer {
            if (!w)
                w = $Writer.create();
            if (m.peerID != null && Object.hasOwnProperty.call(m, "peerID"))
                w.uint32(10).bytes(m.peerID);
            if (m.signedPeerRecord != null && Object.hasOwnProperty.call(m, "signedPeerRecord"))
                w.uint32(18).bytes(m.signedPeerRecord);
            return w;
        }

        /**
         * Decodes a PeerInfo message from the specified reader or buffer.
         * @param r Reader or buffer to decode from
         * @param [l] Message length if known beforehand
         * @returns PeerInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(r: (protobuf.Reader | Uint8Array), l?: number): RPC.PeerInfo {
            if (!(r instanceof $Reader))
                r = $Reader.create(r);
            var c = l === undefined ? r.len : r.pos + l, m = new $root.RPC.PeerInfo();
            while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                    case 1:
                        m.peerID = r.bytes();
                        break;
                    case 2:
                        m.signedPeerRecord = r.bytes();
                        break;
                    default:
                        r.skipType(t & 7);
                        break;
                }
            }
            return m;
        }

        /**
         * Creates a PeerInfo message from a plain object. Also converts values to their respective internal types.
         * @param d Plain object
         * @returns PeerInfo
         */
        public static fromObject(d: { [k: string]: any }): RPC.PeerInfo {
            if (d instanceof $root.RPC.PeerInfo)
                return d;
            var m = new $root.RPC.PeerInfo();
            if (d.peerID != null) {
                if (typeof d.peerID === "string")
                    $util.base64.decode(d.peerID, m.peerID = $util.newBuffer($util.base64.length(d.peerID)), 0);
                else if (d.peerID.length)
                    m.peerID = d.peerID;
            }
            if (d.signedPeerRecord != null) {
                if (typeof d.signedPeerRecord === "string")
                    $util.base64.decode(d.signedPeerRecord, m.signedPeerRecord = $util.newBuffer($util.base64.length(d.signedPeerRecord)), 0);
                else if (d.signedPeerRecord.length)
                    m.signedPeerRecord = d.signedPeerRecord;
            }
            return m;
        }

        /**
         * Creates a plain object from a PeerInfo message. Also converts values to other types if specified.
         * @param m PeerInfo
         * @param [o] Conversion options
         * @returns Plain object
         */
        public static toObject(m: RPC.PeerInfo, o?: protobuf.IConversionOptions): { [k: string]: any } {
            if (!o)
                o = {};
            var d = {};
            if (m.peerID != null && m.hasOwnProperty("peerID")) {
                d.peerID = o.bytes === String ? $util.base64.encode(m.peerID, 0, m.peerID.length) : o.bytes === Array ? Array.prototype.slice.call(m.peerID) : m.peerID;
                if (o.oneofs)
                    d._peerID = "peerID";
            }
            if (m.signedPeerRecord != null && m.hasOwnProperty("signedPeerRecord")) {
                d.signedPeerRecord = o.bytes === String ? $util.base64.encode(m.signedPeerRecord, 0, m.signedPeerRecord.length) : o.bytes === Array ? Array.prototype.slice.call(m.signedPeerRecord) : m.signedPeerRecord;
                if (o.oneofs)
                    d._signedPeerRecord = "signedPeerRecord";
            }
            return d;
        }

        /**
         * Converts this PeerInfo to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any } {
            return this.constructor.toObject(this, protobuf.util.toJSONOptions);
        }
    }
}


/** Properties of a RPC. */
export interface IRPC {

    /** RPC subscriptions */
    subscriptions?: (RPC.ISubOpts[] | null);

    /** RPC messages */
    messages?: (RPC.IMessage[] | null);

    /** RPC control */
    control?: (RPC.IControlMessage | null);
}

// Exported root namespace
export { RPC }
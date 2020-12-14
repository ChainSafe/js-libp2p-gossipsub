"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGossipPeers = void 0;
const constants = __importStar(require("./constants"));
const utils_1 = require("./utils");
/**
 * Given a topic, returns up to count peers subscribed to that topic
 *
 * @param {Gossipsub} router
 * @param {String} topic
 * @param {Number} count
 * @returns {Set<Peer>}
 *
 */
function getGossipPeers(router, topic, count) {
    const peersInTopic = router.topics.get(topic);
    if (!peersInTopic) {
        return new Set();
    }
    // Adds all peers using our protocol
    let peers = [];
    peersInTopic.forEach((peer) => {
        if (peer.protocols.includes(constants.GossipsubID)) {
            peers.push(peer);
        }
    });
    // Pseudo-randomly shuffles peers
    peers = utils_1.shuffle(peers);
    if (count > 0 && peers.length > count) {
        peers = peers.slice(0, count);
    }
    return new Set(peers);
}
exports.getGossipPeers = getGossipPeers;

import { Peer } from './peer';
import Gossipsub = require('./index');
/**
 * Given a topic, returns up to count peers subscribed to that topic
 *
 * @param {Gossipsub} router
 * @param {String} topic
 * @param {Number} count
 * @returns {Set<Peer>}
 *
 */
export declare function getGossipPeers(router: Gossipsub, topic: string, count: number): Set<Peer>;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublishConfigFromPeerId = void 0;
const types_1 = require("../types");
/**
 * Prepare a PublishConfig object from a PeerId.
 */
function getPublishConfigFromPeerId(signaturePolicy, peerId) {
    switch (signaturePolicy) {
        case types_1.SignaturePolicy.StrictSign: {
            if (!peerId) {
                throw Error('Must provide PeerId');
            }
            if (peerId.privKey == null) {
                throw Error('Cannot sign message, no private key present');
            }
            if (peerId.pubKey == null) {
                throw Error('Cannot sign message, no public key present');
            }
            // Transform privateKey once at initialization time instead of once per message
            // const privateKey = await keys.unmarshalPrivateKey(peerId.privateKey)
            const privateKey = peerId.privKey;
            return {
                type: types_1.PublishConfigType.Signing,
                author: peerId,
                key: peerId.pubKey.bytes,
                privateKey
            };
        }
        case types_1.SignaturePolicy.StrictNoSign:
            return {
                type: types_1.PublishConfigType.Anonymous
            };
    }
}
exports.getPublishConfigFromPeerId = getPublishConfigFromPeerId;

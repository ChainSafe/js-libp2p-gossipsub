"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectReasonFromAcceptance = exports.MessageStatus = exports.ValidateError = exports.RejectReason = exports.MessageAcceptance = exports.PublishConfigType = exports.SignaturePolicy = void 0;
var SignaturePolicy;
(function (SignaturePolicy) {
    /**
     * On the producing side:
     * - Build messages with the signature, key (from may be enough for certain inlineable public key types), from and seqno fields.
     *
     * On the consuming side:
     * - Enforce the fields to be present, reject otherwise.
     * - Propagate only if the fields are valid and signature can be verified, reject otherwise.
     */
    SignaturePolicy["StrictSign"] = "StrictSign";
    /**
     * On the producing side:
     * - Build messages without the signature, key, from and seqno fields.
     * - The corresponding protobuf key-value pairs are absent from the marshalled message, not just empty.
     *
     * On the consuming side:
     * - Enforce the fields to be absent, reject otherwise.
     * - Propagate only if the fields are absent, reject otherwise.
     * - A message_id function will not be able to use the above fields, and should instead rely on the data field. A commonplace strategy is to calculate a hash.
     */
    SignaturePolicy["StrictNoSign"] = "StrictNoSign";
})(SignaturePolicy = exports.SignaturePolicy || (exports.SignaturePolicy = {}));
var PublishConfigType;
(function (PublishConfigType) {
    PublishConfigType[PublishConfigType["Signing"] = 0] = "Signing";
    PublishConfigType[PublishConfigType["Author"] = 1] = "Author";
    PublishConfigType[PublishConfigType["Anonymous"] = 2] = "Anonymous";
})(PublishConfigType = exports.PublishConfigType || (exports.PublishConfigType = {}));
var MessageAcceptance;
(function (MessageAcceptance) {
    /// The message is considered valid, and it should be delivered and forwarded to the network.
    MessageAcceptance["Accept"] = "accept";
    /// The message is neither delivered nor forwarded to the network, but the router does not
    /// trigger the P₄ penalty.
    MessageAcceptance["Ignore"] = "ignore";
    /// The message is considered invalid, and it should be rejected and trigger the P₄ penalty.
    MessageAcceptance["Reject"] = "reject";
})(MessageAcceptance = exports.MessageAcceptance || (exports.MessageAcceptance = {}));
var RejectReason;
(function (RejectReason) {
    /**
     * The message failed the configured validation during decoding.
     * SelfOrigin is considered a ValidationError
     */
    RejectReason["Error"] = "error";
    /**
     * Custom validator fn reported status IGNORE.
     */
    RejectReason["Ignore"] = "ignore";
    /**
     * Custom validator fn reported status REJECT.
     */
    RejectReason["Reject"] = "reject";
    /**
     * The peer that sent the message OR the source from field is blacklisted.
     * Causes messages to be ignored, not penalized, neither do score record creation.
     */
    RejectReason["Blacklisted"] = "blacklisted";
})(RejectReason = exports.RejectReason || (exports.RejectReason = {}));
var ValidateError;
(function (ValidateError) {
    /// The message has an invalid signature,
    ValidateError["InvalidSignature"] = "invalid_signature";
    /// The sequence number was the incorrect size
    ValidateError["InvalidSeqno"] = "invalid_seqno";
    /// The PeerId was invalid
    ValidateError["InvalidPeerId"] = "invalid_peerid";
    /// Signature existed when validation has been sent to
    /// [`crate::behaviour::MessageAuthenticity::Anonymous`].
    ValidateError["SignaturePresent"] = "signature_present";
    /// Sequence number existed when validation has been sent to
    /// [`crate::behaviour::MessageAuthenticity::Anonymous`].
    ValidateError["SeqnoPresent"] = "seqno_present";
    /// Message source existed when validation has been sent to
    /// [`crate::behaviour::MessageAuthenticity::Anonymous`].
    ValidateError["FromPresent"] = "from_present";
    /// The data transformation failed.
    ValidateError["TransformFailed"] = "transform_failed";
})(ValidateError = exports.ValidateError || (exports.ValidateError = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["duplicate"] = "duplicate";
    MessageStatus["invalid"] = "invalid";
    MessageStatus["valid"] = "valid";
})(MessageStatus = exports.MessageStatus || (exports.MessageStatus = {}));
/**
 * Typesafe conversion of MessageAcceptance -> RejectReason. TS ensures all values covered
 */
function rejectReasonFromAcceptance(acceptance) {
    switch (acceptance) {
        case MessageAcceptance.Ignore:
            return RejectReason.Ignore;
        case MessageAcceptance.Reject:
            return RejectReason.Reject;
    }
}
exports.rejectReasonFromAcceptance = rejectReasonFromAcceptance;

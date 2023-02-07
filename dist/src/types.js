import { TopicValidatorResult } from '@libp2p/interface-pubsub';
export var SignaturePolicy;
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
})(SignaturePolicy || (SignaturePolicy = {}));
export var PublishConfigType;
(function (PublishConfigType) {
    PublishConfigType[PublishConfigType["Signing"] = 0] = "Signing";
    PublishConfigType[PublishConfigType["Anonymous"] = 1] = "Anonymous";
})(PublishConfigType || (PublishConfigType = {}));
export var RejectReason;
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
})(RejectReason || (RejectReason = {}));
export var ValidateError;
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
})(ValidateError || (ValidateError = {}));
export var MessageStatus;
(function (MessageStatus) {
    MessageStatus["duplicate"] = "duplicate";
    MessageStatus["invalid"] = "invalid";
    MessageStatus["valid"] = "valid";
})(MessageStatus || (MessageStatus = {}));
/**
 * Typesafe conversion of MessageAcceptance -> RejectReason. TS ensures all values covered
 */
export function rejectReasonFromAcceptance(acceptance) {
    switch (acceptance) {
        case TopicValidatorResult.Ignore:
            return RejectReason.Ignore;
        case TopicValidatorResult.Reject:
            return RejectReason.Reject;
    }
}
//# sourceMappingURL=types.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageIdFromString = exports.messageIdToString = void 0;
const from_string_1 = require("uint8arrays/from-string");
const to_string_1 = require("uint8arrays/to-string");
function messageIdToString(msgId) {
    return (0, to_string_1.toString)(msgId, 'base64');
}
exports.messageIdToString = messageIdToString;
function messageIdFromString(msgId) {
    return (0, from_string_1.fromString)(msgId, 'base64');
}
exports.messageIdFromString = messageIdFromString;

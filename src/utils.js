MIT License

Copyright (c) 2016 libp2p

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

'use strict'

const crypto = require('libp2p-crypto')
const bs58 = require('bs58')

exports = module.exports

/**
 * Generatea random sequence number.
 *
 * @returns {string}
 * @private
 */
exports.randomSeqno = () => {
  return crypto.randomBytes(20).toString('hex')
}

/**
 * Generate a message id, based on the `from` and `seqno`.
 *
 * @param {string} from
 * @param {string} seqno
 * @returns {string}
 * @private
 */
exports.msgId = (from, seqno) => {
  return from + seqno
}

/**
 * Check if any member of the first set is also a member
 * of the second set.
 *
 * @param {Set|Array} a
 * @param {Set|Array} b
 * @returns {boolean}
 * @private
 */
exports.anyMatch = (a, b) => {
  let bHas
  if (Array.isArray(b)) {
    bHas = (val) => b.indexOf(val) > -1
  } else {
    bHas = (val) => b.has(val)
  }

  for (let val of a) {
    if (bHas(val)) {
      return true
    }
  }

  return false
}

/**
 * Make everything an array.
 *
 * @param {any} maybeArray
 * @returns {Array}
 * @private
 */
exports.ensureArray = (maybeArray) => {
  if (!Array.isArray(maybeArray)) {
    return [maybeArray]
  }

  return maybeArray
}

exports.normalizeInRpcMessages = (messages) => {
  if (!messages) {
    return messages
  }
  return messages.map((msg) => {
    const m = Object.assign({}, msg)
    if (Buffer.isBuffer(msg.from)) {
      m.from = bs58.encode(msg.from)
    }
    return m
  })
}

exports.normalizeOutRpcMessages = (messages) => {
  if (!messages) {
    return messages
  }
  return messages.map((msg) => {
    const m = Object.assign({}, msg)
    if (typeof msg.from === 'string' || msg.from instanceof String) {
      m.from = bs58.decode(msg.from)
    }
    return m
  })
}

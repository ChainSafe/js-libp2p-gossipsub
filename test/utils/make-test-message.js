const makeTestMessage = (i, topicIDs = []) => {
  return {
    seqno: Uint8Array.from(new Array(8).fill(i)),
    data: Uint8Array.from([i]),
    from: "test",
    topicIDs
  }
}

module.exports.makeTestMessage = makeTestMessage

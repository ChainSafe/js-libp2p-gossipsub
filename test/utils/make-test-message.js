const makeTestMessage = (i, topicIDs = []) => {
  return {
    seqno: Buffer.alloc(8, i),
    data: Buffer.from([i]),
    from: "test",
    topicIDs
  }
}

module.exports.makeTestMessage = makeTestMessage

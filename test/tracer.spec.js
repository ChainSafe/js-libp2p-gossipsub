const { expect } = require('chai')
const delay = require('delay')
const { utils } = require('libp2p-pubsub')

const { IWantTracer } = require('../src/tracer')
const constants = require('../src/constants')
const { makeTestMessage } = require('./utils')

const getMsgId = (msg) => utils.msgId(msg.from, msg.seqno)

describe('IWantTracer', () => {
  it('should track broken promises', async function () {
    // tests that unfullfilled promises are tracked correctly
    this.timeout(6000)
    const t = new IWantTracer(getMsgId)
    const peerA = 'A'
    const peerB = 'B'

    const msgIds = []
    for (let i = 0; i < 100; i++) {
      const m = makeTestMessage(i)
      m.from = Buffer.from(peerA)
      msgIds.push(getMsgId(m))
    }

    t.addPromise(peerA, msgIds)
    t.addPromise(peerB, msgIds)

    // no broken promises yet
    let brokenPromises = t.getBrokenPromises()
    expect(brokenPromises.size).to.be.equal(0)

    // make promises break
    await delay(constants.GossipsubIWantFollowupTime + 10)

    brokenPromises = t.getBrokenPromises()
    expect(brokenPromises.size).to.be.equal(2)
    expect(brokenPromises.get(peerA)).to.be.equal(1)
    expect(brokenPromises.get(peerB)).to.be.equal(1)
  })
  it('should track unbroken promises', async function () {
    // like above, but this time we deliver messages to fullfil the promises
    this.timeout(6000)
    const t = new IWantTracer(getMsgId)
    const peerA = 'A'
    const peerB = 'B'

    const msgs = []
    const msgIds = []
    for (let i = 0; i < 100; i++) {
      const m = makeTestMessage(i)
      m.from = Buffer.from(peerA)
      msgs.push(m)
      msgIds.push(getMsgId(m))
    }

    t.addPromise(peerA, msgIds)
    t.addPromise(peerB, msgIds)

    msgs.forEach(msg => t.deliverMessage(msg))

    await delay(constants.GossipsubIWantFollowupTime + 10)

    // there should be no broken promises
    const brokenPromises = t.getBrokenPromises()
    expect(brokenPromises.size).to.be.equal(0)
  })
})

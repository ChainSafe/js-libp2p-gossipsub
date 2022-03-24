import { expect } from 'chai'
import delay from 'delay'
import { IWantTracer } from '../ts/tracer'
import * as constants from '../ts/constants'
import { makeTestMessage, getMsgId, getMsgIdStr } from './utils'

describe('IWantTracer', () => {
  it('should track broken promises', async function () {
    // tests that unfullfilled promises are tracked correctly
    this.timeout(6000)
    const t = new IWantTracer(constants.GossipsubIWantFollowupTime, null)
    const peerA = 'A'
    const peerB = 'B'

    const msgIds = []
    for (let i = 0; i < 100; i++) {
      const m = makeTestMessage(i, 'test_topic')
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
    const t = new IWantTracer(constants.GossipsubIWantFollowupTime, null)
    const peerA = 'A'
    const peerB = 'B'

    const msgs = []
    const msgIds = []
    for (let i = 0; i < 100; i++) {
      const m = makeTestMessage(i, 'test_topic')
      msgs.push(m)
      msgIds.push(getMsgId(m))
    }

    t.addPromise(peerA, msgIds)
    t.addPromise(peerB, msgIds)

    msgs.forEach((msg) => t.deliverMessage(getMsgIdStr(msg)))

    await delay(constants.GossipsubIWantFollowupTime + 10)

    // there should be no broken promises
    const brokenPromises = t.getBrokenPromises()
    expect(brokenPromises.size).to.be.equal(0)
  })
})

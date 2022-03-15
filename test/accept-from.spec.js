const { expect } = require('chai')
const sinon = require('sinon')
const Gossipsub = require('../src')
const { fastMsgIdFn } = require('./utils/msgId')

describe('Gossipsub acceptFrom', () => {
  let gossipsub
  let sandbox
  let scoreSpy

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
    sandbox.useFakeTimers(Date.now())
    gossipsub = new Gossipsub({}, { emitSelf: false, fastMsgIdFn })
    // stubbing PeerScore causes some pending issue in firefox browser environment
    // we can only spy it
    // using scoreSpy.withArgs("peerA").calledOnce causes the pending issue in firefox
    // while spy.getCall() is fine
    scoreSpy = sandbox.spy(gossipsub.score, 'score')
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should only white list peer with positive score', () => {
    // by default the score is 0
    gossipsub._acceptFrom('peerA')
    // 1st time, we have to compute score
    expect(scoreSpy.getCall(0).args[0]).to.be.equal('peerA')
    expect(scoreSpy.getCall(0).returnValue).to.be.equal(0)
    expect(scoreSpy.getCall(1)).to.be.undefined
    // 2nd time, use a cached score since it's white listed
    gossipsub._acceptFrom('peerA')
    expect(scoreSpy.getCall(1)).to.be.undefined
  })

  it('should recompute score after 1s', () => {
    // by default the score is 0
    gossipsub._acceptFrom('peerA')
    // 1st time, we have to compute score
    expect(scoreSpy.getCall(0).args[0]).to.be.equal('peerA')
    expect(scoreSpy.getCall(1)).to.be.undefined
    gossipsub._acceptFrom('peerA')
    // score is cached
    expect(scoreSpy.getCall(1)).to.be.undefined

    // after 1s
    sandbox.clock.tick(1001)

    gossipsub._acceptFrom('peerA')
    expect(scoreSpy.getCall(1).args[0]).to.be.equal('peerA')
    expect(scoreSpy.getCall(2)).to.be.undefined
  })

  it('should recompute score after max messages accepted', () => {
    // by default the score is 0
    gossipsub._acceptFrom('peerA')
    // 1st time, we have to compute score
    expect(scoreSpy.getCall(0).args[0]).to.be.equal('peerA')
    expect(scoreSpy.getCall(1)).to.be.undefined

    for (let i = 0; i < 128; i++) {
      gossipsub._acceptFrom('peerA')
    }
    expect(scoreSpy.getCall(1)).to.be.undefined

    // max messages reached
    gossipsub._acceptFrom('peerA')
    expect(scoreSpy.getCall(1).args[0]).to.be.equal('peerA')
    expect(scoreSpy.getCall(2)).to.be.undefined
  })

  // TODO: run this in a unit test setup
  // this causes the test to not finish in firefox environment
  it.skip('should NOT white list peer with negative score', () => {
    // peerB is not white listed since score is negative
    scoreStub.score.withArgs('peerB').returns(-1)
    gossipsub._acceptFrom('peerB')
    // 1st time, we have to compute score
    expect(scoreStub.score.withArgs('peerB').calledOnce).to.be.true
    // 2nd time, still have to compute score since it's NOT white listed
    gossipsub._acceptFrom('peerB')
    expect(scoreStub.score.withArgs('peerB').calledTwice).to.be.true
  })
})

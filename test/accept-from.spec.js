const {expect} = require('chai')
const sinon = require('sinon')
const {PeerScore} = require('../src/score')
const Gossipsub = require('../src')
const {
  createPeer,
} = require('./utils')

describe('Gossipsub acceptFrom', () => {
  let gossipsub
  let sandbox
  let scoreStub

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
    sandbox.useFakeTimers()
    gossipsub = new Gossipsub(await createPeer({ started: false }), { emitSelf: true })
    scoreStub = sandbox.createStubInstance(PeerScore)
    gossipsub.score = scoreStub
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should only white list peer with positive score', () => {
    scoreStub.score.withArgs("peerA").returns(1000)
    gossipsub._acceptFrom("peerA")
    // 1st time, we have to compute score
    expect(scoreStub.score.withArgs("peerA").calledOnce).to.be.true
    // 2nd time, use a cached score since it's white listed
    gossipsub._acceptFrom("peerA")
    expect(scoreStub.score.withArgs("peerA").calledOnce).to.be.true
  })

  it('should recompute score after 1s', () => {
    scoreStub.score.returns(1000)
    gossipsub._acceptFrom("peerA")
    // 1st time, we have to compute score
    expect(scoreStub.score.withArgs("peerA").calledOnce).to.be.true
    gossipsub._acceptFrom("peerA")
    expect(scoreStub.score.withArgs("peerA").calledOnce).to.be.true

    // after 1s
    sandbox.clock.tick(1001)

    gossipsub._acceptFrom("peerA")
    expect(scoreStub.score.withArgs("peerA").calledTwice).to.be.true
  })

  it('should recompute score after max messages accepted', () => {
    scoreStub.score.returns(1000)
    gossipsub._acceptFrom("peerA")
    // 1st time, we have to compute score
    expect(scoreStub.score.withArgs("peerA").calledOnce).to.be.true

    for (let i = 0; i < 128; i++) {
      gossipsub._acceptFrom("peerA")
    }
    expect(scoreStub.score.withArgs("peerA").calledOnce).to.be.true

    // max messages reached
    gossipsub._acceptFrom("peerA")
    expect(scoreStub.score.withArgs("peerA").calledTwice).to.be.true
  })

  it('should NOT white list peer with negative score', () => {
    // peerB is not white listed since score is negative
    scoreStub.score.withArgs("peerB").returns(-1)
    gossipsub._acceptFrom("peerB")
    // 1st time, we have to compute score
    expect(scoreStub.score.withArgs("peerB").calledOnce).to.be.true
    // 2nd time, still have to compute score since it's NOT white listed
    gossipsub._acceptFrom("peerB")
    expect(scoreStub.score.withArgs("peerB").calledTwice).to.be.true
  })



})

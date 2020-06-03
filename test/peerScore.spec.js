const { expect } = require('chai')
const PeerId = require('peer-id')
const { utils } = require('libp2p-pubsub')
const { PeerScore, createPeerScoreParams, createTopicScoreParams } = require('../src/score')

const addrBook = new Map()
addrBook.getMultiaddrsForPeer = () => ([])

const makeTestMessage = (i) => {
  return {
    seqno: Buffer.alloc(8, i),
    data: Buffer.from([i]),
    from: "test",
    topicIDs: []
  }
}

describe('PeerScore', () => {
  it('should score based on time in mesh', async () => {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 0.5,
      timeInMeshWeight: 1,
      timeInMeshQuantum: 1,
      timeInMeshCap: 3600,
      invalidMessageDeliveriesDecay: 0.1,
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, utils.msgId)
    ps.addPeer(peerA)

    let aScore = ps.score(peerA)
    expect(aScore, 'expected score to start at zero').to.equal(0)

    // The time in mesh depends on how long the peer has been grafted
    ps.graft(peerA, mytopic)
    const elapsed = tparams.timeInMeshQuantum * 100
    await new Promise(resolve => setTimeout(resolve, elapsed))

    ps._refreshScores()
    aScore = ps.score(peerA)
    expect(aScore).to.be.gte(
      tparams.topicWeight * tparams.timeInMeshWeight / tparams.timeInMeshQuantum * elapsed
    )
  })
  it('should cap time in mesh score', async () => {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 0.5,
      timeInMeshWeight: 1,
      timeInMeshQuantum: 1,
      timeInMeshCap: 10,
      invalidMessageDeliveriesDecay: 0.1,
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, utils.msgId)
    ps.addPeer(peerA)

    let aScore = ps.score(peerA)
    expect(aScore, 'expected score to start at zero').to.equal(0)

    // The time in mesh depends on how long the peer has been grafted
    ps.graft(peerA, mytopic)
    const elapsed = tparams.timeInMeshQuantum * 40
    await new Promise(resolve => setTimeout(resolve, elapsed))

    ps._refreshScores()
    aScore = ps.score(peerA)
    expect(aScore).to.be.gt(
      tparams.topicWeight * tparams.timeInMeshWeight * tparams.timeInMeshCap * 0.5
    )
    expect(aScore).to.be.lt(
      tparams.topicWeight * tparams.timeInMeshWeight * tparams.timeInMeshCap * 1.5
    )
  })
  it('should score first message deliveries', async () => {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      firstMessageDeliveriesWeight: 1,
      firstMessageDeliveriesDecay: 0.9,
      invalidMessageDeliveriesDecay: 0.9,
      firstMessageDeliveriesCap: 50000,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)

    let aScore = ps.score(peerA)
    expect(aScore, 'expected score to start at zero').to.equal(0)

    // The time in mesh depends on how long the peer has been grafted
    ps.graft(peerA, mytopic)

    // deliver a bunch of messages from peer A
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]
      ps.validateMessage(peerA, msg)
      ps.deliverMessage(peerA, msg)
    }

    ps._refreshScores()
    aScore = ps.score(peerA)
    expect(aScore).to.be.equal(
      tparams.topicWeight * tparams.firstMessageDeliveriesWeight * nMessages * tparams.firstMessageDeliveriesDecay
    )
  })
  it('should cap first message deliveries score', async () => {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      firstMessageDeliveriesWeight: 1,
      firstMessageDeliveriesDecay: 0.9,
      invalidMessageDeliveriesDecay: 0.9,
      firstMessageDeliveriesCap: 50,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)

    let aScore = ps.score(peerA)
    expect(aScore, 'expected score to start at zero').to.equal(0)

    // The time in mesh depends on how long the peer has been grafted
    ps.graft(peerA, mytopic)

    // deliver a bunch of messages from peer A
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]
      ps.validateMessage(peerA, msg)
      ps.deliverMessage(peerA, msg)
    }

    ps._refreshScores()
    aScore = ps.score(peerA)
    expect(aScore).to.be.equal(
      tparams.topicWeight * tparams.firstMessageDeliveriesWeight * tparams.firstMessageDeliveriesCap * tparams.firstMessageDeliveriesDecay
    )
  })
  it('should decay first message deliveries score', async () => {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      firstMessageDeliveriesWeight: 1,
      firstMessageDeliveriesDecay: 0.9, // decay 10% per decay interval
      invalidMessageDeliveriesDecay: 0.9,
      firstMessageDeliveriesCap: 50,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)

    let aScore = ps.score(peerA)
    expect(aScore, 'expected score to start at zero').to.equal(0)

    // The time in mesh depends on how long the peer has been grafted
    ps.graft(peerA, mytopic)

    // deliver a bunch of messages from peer A
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]
      ps.validateMessage(peerA, msg)
      ps.deliverMessage(peerA, msg)
    }

    ps._refreshScores()
    aScore = ps.score(peerA)
    let expected = tparams.topicWeight * tparams.firstMessageDeliveriesWeight * tparams.firstMessageDeliveriesCap * tparams.firstMessageDeliveriesDecay
    expect(aScore).to.be.equal(expected)

    // refreshing the scores applies the decay param
    const decayInterals = 10
    for (let i = 0; i < decayInterals; i++) {
      ps._refreshScores()
      expected *= tparams.firstMessageDeliveriesDecay
    }
    aScore = ps.score(peerA)
    expect(aScore).to.be.equal(expected)
  })
  it('should score mesh message deliveries', async function () {
    this.timeout(5000)
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      meshMessageDeliveriesWeight: -1,
      meshMessageDeliveriesActivation: 1000,
      meshMessageDeliveriesWindow: 10,
      meshMessageDeliveriesThreshold: 20,
      meshMessageDeliveriesCap: 100,
      meshMessageDeliveriesDecay: 0.9,
      invalidMessageDeliveriesDecay: 0.9,
      firstMessageDeliveriesWeight: 0,
      timeInMeshQuantum: 1000
    })
    // peer A always delivers the message first
    // peer B delivers next (within the delivery window)
    // peer C delivers outside the delivery window
    // we expect peers A and B to have a score of zero, since all other param weights are zero
    // peer C should have a negative score
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const peerB = await PeerId.create({keyType: 'secp256k1'})
    const peerC = await PeerId.create({keyType: 'secp256k1'})
    const peers = [peerA, peerB, peerC]
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    peers.forEach(p => {
      ps.addPeer(p)
      ps.graft(p, mytopic)
    })

    // assert that nobody has been penalized yet for not delivering messages before activation time
    ps._refreshScores()
    peers.forEach(p => {
      const score = ps.score(p)
      expect(
        score,
        'expected no mesh delivery penalty before activation time'
      ).to.equal(0)
    })
    // wait for the activation time to kick in
    await new Promise(resolve => setTimeout(resolve, tparams.meshMessageDeliveriesActivation))

    // deliver a bunch of messages from peers
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]

      ps.validateMessage(peerA, msg)
      ps.deliverMessage(peerA, msg)

      ps.duplicateMessage(peerB, msg)

      // deliver duplicate from peer C after the window
      await new Promise(resolve => setTimeout(resolve, tparams.meshMessageDeliveriesWindow + 5))
      ps.duplicateMessage(peerC, msg)
    }
    ps._refreshScores()
    const aScore = ps.score(peerA)
    const bScore = ps.score(peerB)
    const cScore = ps.score(peerC)
    expect(aScore).to.be.gte(0)
    expect(bScore).to.be.gte(0)

    // the penalty is the difference between the threshold and the actual mesh deliveries, squared.
    // since we didn't deliver anything, this is just the value of the threshold
    const penalty = tparams.meshMessageDeliveriesThreshold * tparams.meshMessageDeliveriesThreshold
    const expected = tparams.topicWeight * tparams.meshMessageDeliveriesWeight * penalty
    expect(cScore).to.be.equal(expected)
  })
  it('should decay mesh message deliveries score', async function () {
    this.timeout(5000)
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      meshMessageDeliveriesWeight: -1,
      meshMessageDeliveriesActivation: 1000,
      meshMessageDeliveriesWindow: 10,
      meshMessageDeliveriesThreshold: 20,
      meshMessageDeliveriesCap: 100,
      meshMessageDeliveriesDecay: 0.9,
      invalidMessageDeliveriesDecay: 0.9,
      firstMessageDeliveriesWeight: 0,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)
    ps.graft(peerA, mytopic)

    // wait for the activation time to kick in
    await new Promise(resolve => setTimeout(resolve, tparams.meshMessageDeliveriesActivation))

    // deliver a bunch of messages from peer A
    const nMessages = 40
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]

      ps.validateMessage(peerA, msg)
      ps.deliverMessage(peerA, msg)
    }
    ps._refreshScores()
    let aScore = ps.score(peerA)
    expect(aScore).to.be.gte(0)

    // we need to refresh enough times for the decay to bring us below the threshold
    let decayedDeliveryCount = nMessages * tparams.meshMessageDeliveriesDecay
    for (let i = 0; i < 20; i++) {
      ps._refreshScores()
      decayedDeliveryCount *= tparams.meshMessageDeliveriesDecay
    }
    aScore = ps.score(peerA)
    // the penalty is the difference between the threshold and the (decayed) mesh deliveries, squared.
    const deficit = tparams.meshMessageDeliveriesThreshold - decayedDeliveryCount
    const penalty = deficit * deficit
    const expected = tparams.topicWeight * tparams.meshMessageDeliveriesWeight * penalty
    expect(aScore).to.be.equal(expected)
  })
  it('should score mesh message failures', async function () {
    this.timeout(5000)
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    // the mesh failure penalty is applied when a peer is pruned while their
    // mesh deliveries are under the threshold.
    // for this test, we set the mesh delivery threshold, but set
    // meshMessageDeliveriesWeight to zero, so the only affect on the score
    // is from the mesh failure penalty
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      meshFailurePenaltyWeight: -1,
      meshFailurePenaltyDecay: 0.9,

      meshMessageDeliveriesWeight: 0,
      meshMessageDeliveriesActivation: 1000,
      meshMessageDeliveriesWindow: 10,
      meshMessageDeliveriesThreshold: 20,
      meshMessageDeliveriesCap: 100,
      meshMessageDeliveriesDecay: 0.9,

      invalidMessageDeliveriesDecay: 0.9,
      firstMessageDeliveriesWeight: 0,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const peerB = await PeerId.create({keyType: 'secp256k1'})
    const peers = [peerA, peerB]
    // Peer score should start at 0
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    peers.forEach(p => {
      ps.addPeer(p)
      ps.graft(p, mytopic)
    })

    // wait for the activation time to kick in
    await new Promise(resolve => setTimeout(resolve, tparams.meshMessageDeliveriesActivation))

    // deliver a bunch of messages from peer A. peer B does nothing
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]

      ps.validateMessage(peerA, msg)
      ps.deliverMessage(peerA, msg)
    }
    // peers A and B should both have zero scores, since the failure penalty hasn't been applied yet
    ps._refreshScores()
    let aScore = ps.score(peerA)
    let bScore = ps.score(peerB)
    expect(aScore).to.be.equal(0)
    expect(bScore).to.be.equal(0)

    // prune peer B to apply the penalty
    ps.prune(peerB, mytopic)
    ps._refreshScores()
    aScore = ps.score(peerA)
    bScore = ps.score(peerB)
    expect(aScore).to.be.equal(0)

    // penalty calculation is the same as for meshMessageDeliveries, but multiplied by meshFailurePenaltyWeight
    // instead of meshMessageDeliveriesWeight
    const penalty = tparams.meshMessageDeliveriesThreshold * tparams.meshMessageDeliveriesThreshold
    const expected = tparams.topicWeight * tparams.meshFailurePenaltyWeight * penalty * tparams.meshFailurePenaltyDecay
    expect(bScore).to.be.equal(expected)
  })
  it('should score invalid message deliveries', async function () {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      invalidMessageDeliveriesWeight: -1,
      invalidMessageDeliveriesDecay: 0.9,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)
    ps.graft(peerA, mytopic)

    // deliver a bunch of messages from peer A
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]

      ps.rejectMessage(peerA, msg)
    }
    ps._refreshScores()
    let aScore = ps.score(peerA)

    const expected = tparams.topicWeight * tparams.invalidMessageDeliveriesWeight * (nMessages * tparams.invalidMessageDeliveriesDecay) ** 2
    expect(aScore).to.be.equal(expected)
  })
  it('should decay invalid message deliveries score', async function () {
    // Create parameters with reasonable default values
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      invalidMessageDeliveriesWeight: -1,
      invalidMessageDeliveriesDecay: 0.9,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)
    ps.graft(peerA, mytopic)

    // deliver a bunch of messages from peer A
    const nMessages = 100
    for (let i = 0; i < nMessages; i++) {
      const msg = makeTestMessage(i)
      msg.topicIDs = [mytopic]

      ps.rejectMessage(peerA, msg)
    }
    ps._refreshScores()
    let aScore = ps.score(peerA)

    let expected = tparams.topicWeight * tparams.invalidMessageDeliveriesWeight * (nMessages * tparams.invalidMessageDeliveriesDecay) ** 2
    expect(aScore).to.be.equal(expected)

    // refresh scores a few times to apply decay
    for (let i = 0; i < 10; i++) {
      ps._refreshScores()
      expected *= tparams.invalidMessageDeliveriesDecay ** 2
    }
    aScore = ps.score(peerA)
    expect(aScore).to.be.equal(expected)
  })
  it('should score invalid/ignored messages', async function () {
    // this test adds coverage for the dark corners of message rejection
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const tparams = params.topics[mytopic] = createTopicScoreParams({
      topicWeight: 1,
      invalidMessageDeliveriesWeight: -1,
      invalidMessageDeliveriesDecay: 0.9,
      timeInMeshQuantum: 1000
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const peerB = await PeerId.create({keyType: 'secp256k1'})
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)
    ps.addPeer(peerB)

    const msg = makeTestMessage(0)
    msg.topicIDs = [mytopic]

    // insert a record
    ps.validateMessage(peerA, msg)

    // this should have no effect in the score, and subsequent duplicate messages should have no effect either
    ps.ignoreMessage(peerA, msg)
    ps.duplicateMessage(peerB, msg)

    let aScore = ps.score(peerA)
    let bScore = ps.score(peerB)
    let expected = 0
    expect(aScore).to.equal(expected)
    expect(bScore).to.equal(expected)

    // now clear the delivery record
    ps.deliveryRecords.queue.peekFront().expire = Date.now()
    await new Promise(resolve => setTimeout(resolve, 1))
    ps.deliveryRecords.gc()

    // insert a new record in the message deliveries
    ps.validateMessage(peerA, msg)

    // and reject the message to make sure duplicates are also penalized
    ps.rejectMessage(peerA, msg)
    ps.duplicateMessage(peerB, msg)

    aScore = ps.score(peerA)
    bScore = ps.score(peerB)
    expected = -1
    expect(aScore).to.equal(expected)
    expect(bScore).to.equal(expected)

    // now clear the delivery record again
    ps.deliveryRecords.queue.peekFront().expire = Date.now()
    await new Promise(resolve => setTimeout(resolve, 1))
    ps.deliveryRecords.gc()

    // insert a new record in the message deliveries
    ps.validateMessage(peerA, msg)

    // and reject the message after a duplicate has arrived
    ps.duplicateMessage(peerB, msg)
    ps.rejectMessage(peerA, msg)

    aScore = ps.score(peerA)
    bScore = ps.score(peerB)
    expected = -4
    expect(aScore).to.equal(expected)
    expect(bScore).to.equal(expected)
  })
  it('should score w/ application score', async function () {
    const mytopic = 'mytopic'
    let appScoreValue = 0
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      appSpecificScore: () => appScoreValue,
      appSpecificWeight: 0.5,
      decayToZero: 0.1
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)
    ps.graft(peerA, mytopic)

    for (let i = -100; i < 100; i++) {
      appScoreValue = i
      ps._refreshScores()
      const aScore = ps.score(peerA)
      const expected = i * params.appSpecificWeight
      expect(aScore).to.equal(expected)
    }
  })
  it('should score w/ IP colocation', async function () {
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      invalidMessageDeliveriesDecay: 0.1,
      IPColocationFactorThreshold: 1,
      IPColocationFactorWeight: -1,
      decayToZero: 0.1
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})
    const peerB = await PeerId.create({keyType: 'secp256k1'})
    const peerC = await PeerId.create({keyType: 'secp256k1'})
    const peerD = await PeerId.create({keyType: 'secp256k1'})
    const peers = [peerA, peerB, peerC, peerD]

    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    peers.forEach(p => {
      ps.addPeer(p)
      ps.graft(p, mytopic)
    })

    const setIPsForPeer = (p, ips) => {
      ps._setIPs(p, ips, [])
      const pstats = ps.peerStats.get(p)
      pstats.ips = ips
    }
    // peerA should have no penalty, but B, C, and D should be penalized for sharing an IP
    setIPsForPeer(peerA, ['1.2.3.4'])
    setIPsForPeer(peerB, ['2.3.4.5'])
    setIPsForPeer(peerC, ['2.3.4.5', '3.4.5.6'])
    setIPsForPeer(peerD, ['2.3.4.5'])

    ps._refreshScores()
    const aScore = ps.score(peerA)
    const bScore = ps.score(peerB)
    const cScore = ps.score(peerC)
    const dScore = ps.score(peerD)

    expect(aScore).to.equal(0)

    const nShared = 3
    const ipSurplus = nShared - params.IPColocationFactorThreshold
    const penalty = ipSurplus ** 2
    const expected = params.IPColocationFactorWeight * penalty
    expect(bScore).to.equal(expected)
    expect(cScore).to.equal(expected)
    expect(dScore).to.equal(expected)
  })
  it('should score w/ behavior penalty', async function () {
    const params = createPeerScoreParams({
      decayInterval: 1000,
      behaviourPenaltyWeight: -1,
      behaviourPenaltyDecay: 0.99,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})

    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))

    // add penalty on a non-existent peer
    ps.addPenalty(peerA, 1)
    let aScore = ps.score(peerA)
    expect(aScore).to.equal(0)

    // add the peer and test penalties
    ps.addPeer(peerA)

    aScore = ps.score(peerA)
    expect(aScore).to.equal(0)

    ps.addPenalty(peerA, 1)
    aScore = ps.score(peerA)
    expect(aScore).to.equal(-1)

    ps.addPenalty(peerA, 1)
    aScore = ps.score(peerA)
    expect(aScore).to.equal(-4)

    ps._refreshScores()

    aScore = ps.score(peerA)
    expect(aScore).to.equal(-3.9204)
  })
  it('should handle score retention', async function () {
    const mytopic = 'mytopic'
    const params = createPeerScoreParams({
      decayInterval: 1000,
      appSpecificScore: () => -1000,
      appSpecificWeight: 1,
      invalidMessageDeliveriesDecay: 0.1,
      decayToZero: 0.1,
      retainScore: 800,
    })
    const peerA = await PeerId.create({keyType: 'secp256k1'})

    const ps = new PeerScore(params, addrBook, (msg) => utils.msgId(msg.from, msg.seqno))
    ps.addPeer(peerA)
    ps.graft(peerA, mytopic)
    
    // score should equal -1000 (app-specific score)
    const expected = -1000
    ps._refreshScores()
    let aScore = ps.score(peerA)
    expect(aScore).to.equal(expected)

    // disconnect & wait half of the retainScoreTime
    // should still have negative score
    ps.removePeer(peerA)
    const delay = params.retainScore / 2
    await new Promise(resolve => setTimeout(resolve, delay))
    ps._refreshScores()
    aScore = ps.score(peerA)
    expect(aScore).to.equal(expected)

    // wait remaining time (plus a little slop) and the score should reset to 0
    await new Promise(resolve => setTimeout(resolve, delay + 5))
    ps._refreshScores()
    aScore = ps.score(peerA)
    expect(aScore).to.equal(0)
  })
})

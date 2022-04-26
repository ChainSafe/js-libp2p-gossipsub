import { expect } from 'aegir/utils/chai.js'
import {
  createTopicScoreParams,
  validateTopicScoreParams,
  createPeerScoreParams,
  validatePeerScoreParams
} from '../ts/score/index.js'
import * as constants from '../ts/constants.js'

describe('TopicScoreParams validation', () => {
  it('should throw on invalid TopicScoreParams', () => {
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          topicWeight: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshWeight: -1,
          timeInMeshQuantum: 1000
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshWeight: 1,
          timeInMeshQuantum: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshWeight: 1,
          timeInMeshQuantum: 1000,
          timeInMeshCap: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          firstMessageDeliveriesWeight: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          firstMessageDeliveriesWeight: 1,
          firstMessageDeliveriesDecay: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          firstMessageDeliveriesWeight: 1,
          firstMessageDeliveriesDecay: 2
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          firstMessageDeliveriesWeight: 1,
          firstMessageDeliveriesDecay: 0.5,
          firstMessageDeliveriesCap: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: 1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: 2
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: 0.5,
          meshMessageDeliveriesCap: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: 5,
          meshMessageDeliveriesThreshold: -3
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: 5,
          meshMessageDeliveriesThreshold: 3,
          meshMessageDeliveriesWindow: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: 5,
          meshMessageDeliveriesThreshold: 3,
          meshMessageDeliveriesWindow: 1,
          meshMessageDeliveriesActivation: 1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshFailurePenaltyWeight: 1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshFailurePenaltyWeight: -1,
          meshFailurePenaltyDecay: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          meshFailurePenaltyWeight: -1,
          meshFailurePenaltyDecay: 2
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          invalidMessageDeliveriesWeight: 1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          invalidMessageDeliveriesWeight: -1,
          invalidMessageDeliveriesDecay: -1
        })
      )
    ).to.throw()
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          timeInMeshQuantum: 1000,
          invalidMessageDeliveriesWeight: -1,
          invalidMessageDeliveriesDecay: 2
        })
      )
    ).to.throw()
  })
  it('should not throw on valid TopicScoreParams', () => {
    expect(() =>
      validateTopicScoreParams(
        createTopicScoreParams({
          topicWeight: 2,
          timeInMeshWeight: 0.01,
          timeInMeshQuantum: 1000,
          timeInMeshCap: 10,
          firstMessageDeliveriesWeight: 1,
          firstMessageDeliveriesDecay: 0.5,
          firstMessageDeliveriesCap: 10,
          meshMessageDeliveriesWeight: -1,
          meshMessageDeliveriesDecay: 0.5,
          meshMessageDeliveriesCap: 10,
          meshMessageDeliveriesThreshold: 5,
          meshMessageDeliveriesWindow: 1,
          meshMessageDeliveriesActivation: 1000,
          meshFailurePenaltyWeight: -1,
          meshFailurePenaltyDecay: 0.5,
          invalidMessageDeliveriesWeight: -1,
          invalidMessageDeliveriesDecay: 0.5
        })
      )
    ).to.not.throw()
  })
})

describe('PeerScoreParams validation', () => {
  const appScore = () => 0

  it('should throw on invalid PeerScoreParams', () => {
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: -1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01
        })
      )
    ).to.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          decayInterval: 999,
          decayToZero: 0.01
        })
      )
    ).to.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          IPColocationFactorWeight: 1
        })
      )
    ).to.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: -1
        })
      )
    ).to.throw()
    /*
    TODO: appears to be valid config?
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1
        })
      )
    ).to.throw()
    */
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: -1,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1
        })
      )
    ).to.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 2,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1
        })
      )
    ).to.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          behaviourPenaltyWeight: 1
        })
      )
    ).to.throw()
    /*
    TODO: appears to be valid config?
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          behaviourPenaltyWeight: -1
        })
      )
    ).to.throw()
    */
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          behaviourPenaltyWeight: -1,
          behaviourPenaltyDecay: 2
        })
      )
    ).to.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1,
          topics: {
            test: {
              topicWeight: -1,
              timeInMeshWeight: 0.01,
              timeInMeshQuantum: Number(constants.second),
              timeInMeshCap: 10,
              firstMessageDeliveriesWeight: 1,
              firstMessageDeliveriesDecay: 0.5,
              firstMessageDeliveriesCap: 10,
              meshMessageDeliveriesWeight: -1,
              meshMessageDeliveriesDecay: 0.5,
              meshMessageDeliveriesCap: 10,
              meshMessageDeliveriesThreshold: 5,
              meshMessageDeliveriesWindow: 1,
              meshMessageDeliveriesActivation: 1000,
              meshFailurePenaltyWeight: -1,
              meshFailurePenaltyDecay: 0.5,
              invalidMessageDeliveriesWeight: -1,
              invalidMessageDeliveriesDecay: 0.5
            }
          }
        })
      )
    ).to.throw()
  })
  it('should not throw on valid PeerScoreParams', () => {
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1,
          behaviourPenaltyWeight: -1,
          behaviourPenaltyDecay: 0.999
        })
      )
    ).to.not.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: 1000,
          decayToZero: 0.01,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1,
          behaviourPenaltyWeight: -1,
          behaviourPenaltyDecay: 0.999
        })
      )
    ).to.not.throw()
    expect(() =>
      validatePeerScoreParams(
        createPeerScoreParams({
          topicScoreCap: 1,
          appSpecificScore: appScore,
          decayInterval: Number(constants.second),
          decayToZero: 0.01,
          IPColocationFactorWeight: -1,
          IPColocationFactorThreshold: 1,
          topics: {
            test: {
              topicWeight: 1,
              timeInMeshWeight: 0.01,
              timeInMeshQuantum: 1000,
              timeInMeshCap: 10,
              firstMessageDeliveriesWeight: 1,
              firstMessageDeliveriesDecay: 0.5,
              firstMessageDeliveriesCap: 10,
              meshMessageDeliveriesWeight: -1,
              meshMessageDeliveriesDecay: 0.5,
              meshMessageDeliveriesCap: 10,
              meshMessageDeliveriesThreshold: 5,
              meshMessageDeliveriesWindow: 1,
              meshMessageDeliveriesActivation: 1000,
              meshFailurePenaltyWeight: -1,
              meshFailurePenaltyDecay: 0.5,
              invalidMessageDeliveriesWeight: -1,
              invalidMessageDeliveriesDecay: 0.5
            }
          }
        })
      )
    ).to.not.throw()
  })
})

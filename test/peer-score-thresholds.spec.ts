import { expect } from 'chai'
import { createPeerScoreThresholds, validatePeerScoreThresholds } from '../ts/score'

describe('PeerScoreThresholds validation', () => {
  it('should throw on invalid PeerScoreThresholds', () => {
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          gossipThreshold: 1
        })
      )
    ).to.throw
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          publishThreshold: 1
        })
      )
    ).to.throw
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          gossipThreshold: -1,
          publishThreshold: 0
        })
      )
    ).to.throw
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          gossipThreshold: -1,
          publishThreshold: -2
        })
      )
    ).to.throw
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          acceptPXThreshold: -1
        })
      )
    ).to.throw
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          opportunisticGraftThreshold: -1
        })
      )
    ).to.throw
  })
  it('should not throw on valid PeerScoreThresholds', () => {
    expect(() =>
      validatePeerScoreThresholds(
        createPeerScoreThresholds({
          gossipThreshold: -1,
          publishThreshold: -2,
          graylistThreshold: -3,
          acceptPXThreshold: 1,
          opportunisticGraftThreshold: 2
        })
      )
    ).to.not.throw
  })
})

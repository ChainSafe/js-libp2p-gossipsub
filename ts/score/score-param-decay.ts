const DefaultDecayInterval = 1000
const DefaultDecayToZero = 0.01

/**
 * ScoreParameterDecay computes the decay factor for a parameter, assuming the DecayInterval is 1s
 * and that the value decays to zero if it drops below 0.01
 */
export function scoreParameterDecay(decay: number): number {
  return scoreParameterDecayWithBase(decay, DefaultDecayInterval, DefaultDecayToZero)
}

/**
 * ScoreParameterDecay computes the decay factor for a parameter using base as the DecayInterval
 */
export function scoreParameterDecayWithBase(decay: number, base: number, decayToZero: number): number {
  // the decay is linear, so after n ticks the value is factor^n
  // so factor^n = decayToZero => factor = decayToZero^(1/n)
  const ticks = decay / base
  return decayToZero ** (1 / ticks)
}

/** Degree of the network, max number of peers to select for publishing dandelion messages */
export const DANDELION_D = 2
export const DANDELION_STEM_LO = 3
export const DANDELION_STEM_HI = 6

/**
 * Randomly select a stem length between STEM_LO and STEM_HI
 */
export function getDandelionStem(): number {
  return Math.floor(Math.random() * (DANDELION_STEM_HI - DANDELION_STEM_LO) + DANDELION_STEM_LO)
}

/**
 * Decrement the stem.
 * If the stem is null or too low, return undefined
 */
export function decrementStem(stem: number | null | undefined): number | undefined {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!stem) {
    return undefined
  }
  const newStem = stem - 1
  if (newStem < 1) {
    return undefined
  }
  return stem
}

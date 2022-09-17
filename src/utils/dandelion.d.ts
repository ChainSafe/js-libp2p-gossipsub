/** Degree of the network, max number of peers to select for publishing dandelion messages */
export declare const DANDELION_D = 2;
export declare const DANDELION_STEM_LO = 3;
export declare const DANDELION_STEM_HI = 6;
/**
 * Randomly select a stem length between STEM_LO and STEM_HI
 */
export declare function getDandelionStem(hi: number, lo: number): number;

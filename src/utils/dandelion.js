"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDandelionStem = exports.DANDELION_STEM_HI = exports.DANDELION_STEM_LO = exports.DANDELION_D = void 0;
/** Degree of the network, max number of peers to select for publishing dandelion messages */
exports.DANDELION_D = 2;
exports.DANDELION_STEM_LO = 3;
exports.DANDELION_STEM_HI = 6;
/**
 * Randomly select a stem length between STEM_LO and STEM_HI
 */
function getDandelionStem() {
    return Math.floor(Math.random() * (exports.DANDELION_STEM_HI - exports.DANDELION_STEM_LO) + exports.DANDELION_STEM_LO);
}
exports.getDandelionStem = getDandelionStem;

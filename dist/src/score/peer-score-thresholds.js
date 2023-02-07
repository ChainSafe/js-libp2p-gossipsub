import { ERR_INVALID_PEER_SCORE_THRESHOLDS } from './constants.js';
import { CodeError } from '@libp2p/interfaces/errors';
export const defaultPeerScoreThresholds = {
    gossipThreshold: -10,
    publishThreshold: -50,
    graylistThreshold: -80,
    acceptPXThreshold: 10,
    opportunisticGraftThreshold: 20
};
export function createPeerScoreThresholds(p = {}) {
    return {
        ...defaultPeerScoreThresholds,
        ...p
    };
}
export function validatePeerScoreThresholds(p) {
    if (p.gossipThreshold > 0) {
        throw new CodeError('invalid gossip threshold; it must be <= 0', ERR_INVALID_PEER_SCORE_THRESHOLDS);
    }
    if (p.publishThreshold > 0 || p.publishThreshold > p.gossipThreshold) {
        throw new CodeError('invalid publish threshold; it must be <= 0 and <= gossip threshold', ERR_INVALID_PEER_SCORE_THRESHOLDS);
    }
    if (p.graylistThreshold > 0 || p.graylistThreshold > p.publishThreshold) {
        throw new CodeError('invalid graylist threshold; it must be <= 0 and <= publish threshold', ERR_INVALID_PEER_SCORE_THRESHOLDS);
    }
    if (p.acceptPXThreshold < 0) {
        throw new CodeError('invalid accept PX threshold; it must be >= 0', ERR_INVALID_PEER_SCORE_THRESHOLDS);
    }
    if (p.opportunisticGraftThreshold < 0) {
        throw new CodeError('invalid opportunistic grafting threshold; it must be >= 0', ERR_INVALID_PEER_SCORE_THRESHOLDS);
    }
}
//# sourceMappingURL=peer-score-thresholds.js.map
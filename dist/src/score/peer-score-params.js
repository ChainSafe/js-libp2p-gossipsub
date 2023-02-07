import { ERR_INVALID_PEER_SCORE_PARAMS } from './constants.js';
import { CodeError } from '@libp2p/interfaces/errors';
export const defaultPeerScoreParams = {
    topics: {},
    topicScoreCap: 10.0,
    appSpecificScore: () => 0.0,
    appSpecificWeight: 10.0,
    IPColocationFactorWeight: -5.0,
    IPColocationFactorThreshold: 10.0,
    IPColocationFactorWhitelist: new Set(),
    behaviourPenaltyWeight: -10.0,
    behaviourPenaltyThreshold: 0.0,
    behaviourPenaltyDecay: 0.2,
    decayInterval: 1000.0,
    decayToZero: 0.1,
    retainScore: 3600 * 1000
};
export const defaultTopicScoreParams = {
    topicWeight: 0.5,
    timeInMeshWeight: 1,
    timeInMeshQuantum: 1,
    timeInMeshCap: 3600,
    firstMessageDeliveriesWeight: 1,
    firstMessageDeliveriesDecay: 0.5,
    firstMessageDeliveriesCap: 2000,
    meshMessageDeliveriesWeight: -1,
    meshMessageDeliveriesDecay: 0.5,
    meshMessageDeliveriesCap: 100,
    meshMessageDeliveriesThreshold: 20,
    meshMessageDeliveriesWindow: 10,
    meshMessageDeliveriesActivation: 5000,
    meshFailurePenaltyWeight: -1,
    meshFailurePenaltyDecay: 0.5,
    invalidMessageDeliveriesWeight: -1,
    invalidMessageDeliveriesDecay: 0.3
};
export function createPeerScoreParams(p = {}) {
    return {
        ...defaultPeerScoreParams,
        ...p,
        topics: p.topics
            ? Object.entries(p.topics).reduce((topics, [topic, topicScoreParams]) => {
                topics[topic] = createTopicScoreParams(topicScoreParams);
                return topics;
            }, {})
            : {}
    };
}
export function createTopicScoreParams(p = {}) {
    return {
        ...defaultTopicScoreParams,
        ...p
    };
}
// peer score parameter validation
export function validatePeerScoreParams(p) {
    for (const [topic, params] of Object.entries(p.topics)) {
        try {
            validateTopicScoreParams(params);
        }
        catch (e) {
            throw new CodeError(`invalid score parameters for topic ${topic}: ${e.message}`, ERR_INVALID_PEER_SCORE_PARAMS);
        }
    }
    // check that the topic score is 0 or something positive
    if (p.topicScoreCap < 0) {
        throw new CodeError('invalid topic score cap; must be positive (or 0 for no cap)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check that we have an app specific score; the weight can be anything (but expected positive)
    if (p.appSpecificScore === null || p.appSpecificScore === undefined) {
        throw new CodeError('missing application specific score function', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check the IP colocation factor
    if (p.IPColocationFactorWeight > 0) {
        throw new CodeError('invalid IPColocationFactorWeight; must be negative (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.IPColocationFactorWeight !== 0 && p.IPColocationFactorThreshold < 1) {
        throw new CodeError('invalid IPColocationFactorThreshold; must be at least 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check the behaviour penalty
    if (p.behaviourPenaltyWeight > 0) {
        throw new CodeError('invalid BehaviourPenaltyWeight; must be negative (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.behaviourPenaltyWeight !== 0 && (p.behaviourPenaltyDecay <= 0 || p.behaviourPenaltyDecay >= 1)) {
        throw new CodeError('invalid BehaviourPenaltyDecay; must be between 0 and 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check the decay parameters
    if (p.decayInterval < 1000) {
        throw new CodeError('invalid DecayInterval; must be at least 1s', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.decayToZero <= 0 || p.decayToZero >= 1) {
        throw new CodeError('invalid DecayToZero; must be between 0 and 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // no need to check the score retention; a value of 0 means that we don't retain scores
}
export function validateTopicScoreParams(p) {
    // make sure we have a sane topic weight
    if (p.topicWeight < 0) {
        throw new CodeError('invalid topic weight; must be >= 0', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check P1
    if (p.timeInMeshQuantum === 0) {
        throw new CodeError('invalid TimeInMeshQuantum; must be non zero', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.timeInMeshWeight < 0) {
        throw new CodeError('invalid TimeInMeshWeight; must be positive (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.timeInMeshWeight !== 0 && p.timeInMeshQuantum <= 0) {
        throw new CodeError('invalid TimeInMeshQuantum; must be positive', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.timeInMeshWeight !== 0 && p.timeInMeshCap <= 0) {
        throw new CodeError('invalid TimeInMeshCap; must be positive', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check P2
    if (p.firstMessageDeliveriesWeight < 0) {
        throw new CodeError('invallid FirstMessageDeliveriesWeight; must be positive (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.firstMessageDeliveriesWeight !== 0 &&
        (p.firstMessageDeliveriesDecay <= 0 || p.firstMessageDeliveriesDecay >= 1)) {
        throw new CodeError('invalid FirstMessageDeliveriesDecay; must be between 0 and 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.firstMessageDeliveriesWeight !== 0 && p.firstMessageDeliveriesCap <= 0) {
        throw new CodeError('invalid FirstMessageDeliveriesCap; must be positive', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check P3
    if (p.meshMessageDeliveriesWeight > 0) {
        throw new CodeError('invalid MeshMessageDeliveriesWeight; must be negative (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.meshMessageDeliveriesWeight !== 0 && (p.meshMessageDeliveriesDecay <= 0 || p.meshMessageDeliveriesDecay >= 1)) {
        throw new CodeError('invalid MeshMessageDeliveriesDecay; must be between 0 and 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.meshMessageDeliveriesWeight !== 0 && p.meshMessageDeliveriesCap <= 0) {
        throw new CodeError('invalid MeshMessageDeliveriesCap; must be positive', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.meshMessageDeliveriesWeight !== 0 && p.meshMessageDeliveriesThreshold <= 0) {
        throw new CodeError('invalid MeshMessageDeliveriesThreshold; must be positive', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.meshMessageDeliveriesWindow < 0) {
        throw new CodeError('invalid MeshMessageDeliveriesWindow; must be non-negative', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.meshMessageDeliveriesWeight !== 0 && p.meshMessageDeliveriesActivation < 1000) {
        throw new CodeError('invalid MeshMessageDeliveriesActivation; must be at least 1s', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check P3b
    if (p.meshFailurePenaltyWeight > 0) {
        throw new CodeError('invalid MeshFailurePenaltyWeight; must be negative (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.meshFailurePenaltyWeight !== 0 && (p.meshFailurePenaltyDecay <= 0 || p.meshFailurePenaltyDecay >= 1)) {
        throw new CodeError('invalid MeshFailurePenaltyDecay; must be between 0 and 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    // check P4
    if (p.invalidMessageDeliveriesWeight > 0) {
        throw new CodeError('invalid InvalidMessageDeliveriesWeight; must be negative (or 0 to disable)', ERR_INVALID_PEER_SCORE_PARAMS);
    }
    if (p.invalidMessageDeliveriesDecay <= 0 || p.invalidMessageDeliveriesDecay >= 1) {
        throw new CodeError('invalid InvalidMessageDeliveriesDecay; must be between 0 and 1', ERR_INVALID_PEER_SCORE_PARAMS);
    }
}
//# sourceMappingURL=peer-score-params.js.map
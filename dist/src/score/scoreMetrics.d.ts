import type { PeerScoreParams } from './peer-score-params.js';
import type { PeerStats } from './peer-stats.js';
type TopicLabel = string;
type TopicStr = string;
type TopicStrToLabel = Map<TopicStr, TopicLabel>;
export interface TopicScoreWeights<T> {
    p1w: T;
    p2w: T;
    p3w: T;
    p3bw: T;
    p4w: T;
}
export interface ScoreWeights<T> {
    byTopic: Map<TopicLabel, TopicScoreWeights<T>>;
    p5w: T;
    p6w: T;
    p7w: T;
    score: T;
}
export declare function computeScoreWeights(peer: string, pstats: PeerStats, params: PeerScoreParams, peerIPs: Map<string, Set<string>>, topicStrToLabel: TopicStrToLabel): ScoreWeights<number>;
export declare function computeAllPeersScoreWeights(peerIdStrs: Iterable<string>, peerStats: Map<string, PeerStats>, params: PeerScoreParams, peerIPs: Map<string, Set<string>>, topicStrToLabel: TopicStrToLabel): ScoreWeights<number[]>;
export {};
//# sourceMappingURL=scoreMetrics.d.ts.map
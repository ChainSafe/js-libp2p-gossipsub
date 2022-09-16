import { PeerScoreParams } from './peer-score-params';
import { PeerStats } from './peer-stats';
declare type TopicLabel = string;
declare type TopicStr = string;
declare type TopicStrToLabel = Map<TopicStr, TopicLabel>;
export declare type TopicScoreWeights<T> = {
    p1w: T;
    p2w: T;
    p3w: T;
    p3bw: T;
    p4w: T;
};
export declare type ScoreWeights<T> = {
    byTopic: Map<TopicLabel, TopicScoreWeights<T>>;
    p5w: T;
    p6w: T;
    p7w: T;
    score: T;
};
export declare function computeScoreWeights(peer: string, pstats: PeerStats, params: PeerScoreParams, peerIPs: Map<string, Set<string>>, topicStrToLabel: TopicStrToLabel): ScoreWeights<number>;
export declare function computeAllPeersScoreWeights(peerIdStrs: Iterable<string>, peerStats: Map<string, PeerStats>, params: PeerScoreParams, peerIPs: Map<string, Set<string>>, topicStrToLabel: TopicStrToLabel): ScoreWeights<number[]>;
export {};

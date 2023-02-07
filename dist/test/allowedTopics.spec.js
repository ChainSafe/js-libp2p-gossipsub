import { expect } from 'aegir/chai';
import { pEvent } from 'p-event';
import { connectAllPubSubNodes, createComponentsArray } from './utils/create-pubsub.js';
import { stop } from '@libp2p/interfaces/startable';
import { mockNetwork } from '@libp2p/interface-mocks';
/* eslint-disable dot-notation */
describe('gossip / allowedTopics', () => {
    let nodes;
    const allowedTopic = 'topic_allowed';
    const notAllowedTopic = 'topic_not_allowed';
    const allowedTopics = [allowedTopic];
    const allTopics = [allowedTopic, notAllowedTopic];
    // Create pubsub nodes
    beforeEach(async () => {
        mockNetwork.reset();
        nodes = await createComponentsArray({
            number: 2,
            connected: false,
            init: {
                allowedTopics
            }
        });
    });
    afterEach(async () => {
        await stop(...nodes.reduce((acc, curr) => acc.concat(curr.pubsub, ...Object.entries(curr.components)), []));
        mockNetwork.reset();
    });
    it('should send gossip to non-mesh peers in topic', async function () {
        this.timeout(10 * 1000);
        const [nodeA, nodeB] = nodes;
        // add subscriptions to each node
        for (const topic of allTopics) {
            nodeA.pubsub.subscribe(topic);
        }
        // every node connected to every other
        await Promise.all([
            connectAllPubSubNodes(nodes),
            // nodeA should send nodeB all its subscriptions on connection
            pEvent(nodeB.pubsub, 'subscription-change')
        ]);
        const nodeASubscriptions = Array.from(nodeA.pubsub['subscriptions'].keys());
        expect(nodeASubscriptions).deep.equals(allTopics, 'nodeA.subscriptions should be subcribed to all');
        const nodeBTopics = Array.from(nodeB.pubsub['topics'].keys());
        expect(nodeBTopics).deep.equals(allowedTopics, 'nodeB.topics should only contain allowedTopics');
    });
});
//# sourceMappingURL=allowedTopics.spec.js.map
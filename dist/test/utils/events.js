import { expect } from 'aegir/chai';
import pWaitFor from 'p-wait-for';
export const checkReceivedSubscription = (node, peerIdStr, topic, peerIdx, timeout = 1000) => new Promise((resolve, reject) => {
    const event = 'subscription-change';
    const t = setTimeout(() => reject(new Error(`Not received subscriptions of psub ${peerIdx}, topic ${topic}`)), timeout);
    const cb = (evt) => {
        const { peerId, subscriptions } = evt.detail;
        // console.log('@@@ in test received subscriptions from peer id', peerId.toString())
        if (peerId.toString() === peerIdStr && subscriptions[0].topic === topic && subscriptions[0].subscribe === true) {
            clearTimeout(t);
            node.pubsub.removeEventListener(event, cb);
            if (Array.from(node.pubsub.getSubscribers(topic))
                .map((p) => p.toString())
                .includes(peerIdStr)) {
                resolve();
            }
            else {
                reject(Error('topics should include the peerId'));
            }
        }
    };
    node.pubsub.addEventListener(event, cb);
});
export const checkReceivedSubscriptions = async (node, peerIdStrs, topic, timeout = 5000) => {
    const recvPeerIdStrs = peerIdStrs.filter((peerIdStr) => peerIdStr !== node.components.peerId.toString());
    const promises = recvPeerIdStrs.map(async (peerIdStr, idx) => await checkReceivedSubscription(node, peerIdStr, topic, idx, timeout));
    await Promise.all(promises);
    for (const str of recvPeerIdStrs) {
        expect(Array.from(node.pubsub.getSubscribers(topic)).map((p) => p.toString())).to.include(str);
    }
    await pWaitFor(() => {
        return recvPeerIdStrs.every((peerIdStr) => {
            return node.pubsub.streamsOutbound.has(peerIdStr);
        });
    });
};
export const awaitEvents = async (emitter, event, number, timeout = 30000) => {
    return new Promise((resolve, reject) => {
        let counter = 0;
        const t = setTimeout(() => {
            emitter.removeEventListener(event, cb);
            reject(new Error(`${counter} of ${number} '${String(event)}' events received after ${timeout}ms`));
        }, timeout);
        const cb = () => {
            counter++;
            if (counter >= number) {
                clearTimeout(t);
                emitter.removeEventListener(event, cb);
                resolve();
            }
        };
        emitter.addEventListener(event, cb);
    });
};
//# sourceMappingURL=events.js.map
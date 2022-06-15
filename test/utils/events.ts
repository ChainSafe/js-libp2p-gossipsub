import { Components } from '@libp2p/interfaces/dist/src/components'
import type { SubscriptionChangeData } from '@libp2p/interfaces/pubsub'
import type { EventEmitter } from '@libp2p/interfaces/events'
import { expect } from 'aegir/chai'
import pWaitFor from 'p-wait-for'
import { GossipSub, GossipsubEvents } from '../../src/index.js'

export const checkReceivedSubscription = (
  node: Components,
  peerIdStr: string,
  topic: string,
  peerIdx: number,
  timeout = 1000
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const event = 'subscription-change'
    const t = setTimeout(
      () => reject(new Error(`Not received subscriptions of psub ${peerIdx}, topic ${topic}`)),
      timeout
    )
    const cb = (evt: CustomEvent<SubscriptionChangeData>) => {
      const { peerId, subscriptions } = evt.detail

      // console.log('@@@ in test received subscriptions from peer id', peerId.toString())
      if (peerId.toString() === peerIdStr && subscriptions[0].topic === topic && subscriptions[0].subscribe === true) {
        clearTimeout(t)
        node.getPubSub().removeEventListener(event, cb)
        if (
          Array.from(node.getPubSub().getSubscribers(topic))
            .map((p) => p.toString())
            .includes(peerIdStr)
        ) {
          resolve()
        } else {
          reject(Error('topics should include the peerId'))
        }
      }
    }
    node.getPubSub().addEventListener(event, cb)
  })

export const checkReceivedSubscriptions = async (
  node: Components,
  peerIdStrs: string[],
  topic: string,
  timeout = 5000
): Promise<void> => {
  const recvPeerIdStrs = peerIdStrs.filter((peerIdStr) => peerIdStr !== node.getPeerId().toString())
  const promises = recvPeerIdStrs.map(
    async (peerIdStr, idx) => await checkReceivedSubscription(node, peerIdStr, topic, idx, timeout)
  )
  await Promise.all(promises)
  for (const str of recvPeerIdStrs) {
    expect(Array.from(node.getPubSub().getSubscribers(topic)).map((p) => p.toString())).to.include(str)
  }
  await pWaitFor(() => {
    return recvPeerIdStrs.every((peerIdStr) => {
      const peerStream = (node.getPubSub() as GossipSub).peers.get(peerIdStr)

      return peerStream?.isWritable
    })
  })
}

export const awaitEvents = async <Events = GossipsubEvents>(
  emitter: EventEmitter<Events>,
  event: keyof Events,
  number: number,
  timeout = 30000
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    let counter = 0
    const t = setTimeout(() => {
      emitter.removeEventListener(event, cb)
      reject(new Error(`${counter} of ${number} '${String(event)}' events received after ${timeout}ms`))
    }, timeout)
    const cb = () => {
      counter++
      if (counter >= number) {
        clearTimeout(t)
        emitter.removeEventListener(event, cb)
        resolve()
      }
    }
    emitter.addEventListener(event, cb)
  })
}

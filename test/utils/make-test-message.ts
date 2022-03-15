import { InMessage } from 'libp2p-interfaces/src/pubsub'

export const makeTestMessage = (i: number, topicIDs: string[] = []): InMessage => {
  return {
    receivedFrom: '',
    seqno: Uint8Array.from(new Array(8).fill(i)),
    data: Uint8Array.from([i]),
    from: 'test',
    topicIDs
  }
}

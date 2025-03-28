import { stop, isPubSub } from '@libp2p/interface'
import { mockNetwork } from '@libp2p/interface-compliance-tests/mocks'
import { expect } from 'aegir/chai'
import { createComponents, type GossipSubAndComponents } from './utils/create-pubsub.js'

describe('is-pub-sub', () => {
  let node: GossipSubAndComponents

  before(async () => {
    mockNetwork.reset()
    node = await createComponents({})
  })

  after(async () => {
    await stop(node.pubsub, ...Object.entries(node.components))
    mockNetwork.reset()
  })

  it('should be a pub-sub node', () => {
    expect(isPubSub(node.pubsub)).to.be.true()
  })
})

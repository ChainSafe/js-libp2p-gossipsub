const Gossipsub = require('../../src')
const { fastMsgIdFn } = require('./msgId')

const { createPeers } = require('./create-peer')

/**
 * Start node - gossipsub + libp2p
 */
async function startNode(gs) {
  await gs._libp2p.start()
  await gs.start()
}

/**
 * Stop node - gossipsub + libp2p
 */
async function stopNode(gs) {
  await gs._libp2p.stop()
  await gs.stop()
}

async function connectGossipsub(gs1, gs2) {
  await gs1._libp2p.dialProtocol(gs2._libp2p.peerId, gs1.multicodecs)
}

/**
 * Create a number of preconfigured gossipsub nodes
 */
async function createGossipsubs({ number = 1, started = true, options = {} } = {}) {
  const libp2ps = await createPeers({ number, started })
  const gss = libp2ps.map((libp2p) => new Gossipsub(libp2p, { ...options, fastMsgIdFn: fastMsgIdFn }))

  if (started) {
    await Promise.all(gss.map((gs) => gs.start()))
  }

  return gss
}

/**
 * Stop gossipsub nodes
 */
async function tearDownGossipsubs(gss) {
  await Promise.all(
    gss.map(async (p) => {
      await p.stop()
      await p._libp2p.stop()
    })
  )
}

/**
 * Connect some gossipsub nodes to others
 * @param {Gossipsub[]} gss
 * @param {number} num number of peers to connect
 */
async function connectSome(gss, num) {
  for (let i = 0; i < gss.length; i++) {
    for (let j = 0; j < num; j++) {
      const n = Math.floor(Math.random() * gss.length)
      if (n === i) {
        j--
        continue
      }
      await connectGossipsub(gss[i], gss[n])
    }
  }
}

async function sparseConnect(gss) {
  await connectSome(gss, 3)
}

async function denseConnect(gss) {
  await connectSome(gss, 10)
}

/**
 * Connect every gossipsub node to every other
 * @param {Gossipsub[]} gss
 */
async function connectGossipsubs(gss) {
  for (let i = 0; i < gss.length; i++) {
    for (let j = i + 1; j < gss.length; j++) {
      await connectGossipsub(gss[i], gss[j])
    }
  }
}

/**
 * Create a number of fully connected gossipsub nodes
 */
async function createConnectedGossipsubs({ number = 2, options = {} } = {}) {
  const gss = await createGossipsubs({ number, started: true, options })
  await connectGossipsubs(gss)
  return gss
}

module.exports = {
  startNode,
  stopNode,
  connectGossipsub,
  createGossipsubs,
  connectSome,
  sparseConnect,
  denseConnect,
  connectGossipsubs,
  createConnectedGossipsubs,
  tearDownGossipsubs
}

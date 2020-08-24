const Gossipsub = require('../../src')

const {
  createPeer,
  createPeers,
} = require('./create-peer')

/**
 * Start node - gossipsub + libp2p
 */
async function startNode(gs) {
  await gs._libp2p.start()
  gs.start()
}

/**
 * Stop node - gossipsub + libp2p
 */
async function stopNode(gs) {
  await gs._libp2p.stop()
  gs.stop()
}

/**
 * Create a number of preconfigured gossipsub nodes
 */
async function createGossipsubs({ number = 1, started = true, options = {}} = {}) {
  const libp2ps = await createPeers({ number, started })
  const gss = libp2ps.map(libp2p => new Gossipsub(libp2p, options))

  if (started) {
    await Promise.all(
      gss.map(gs => gs.start())
    )
  }

  return gss
}

/**
 * Connect every gossipsub node to every other
 * @param {Gossipsub[]} gss
 */
async function connectGossipsubs (gss) {
  for (let i = 0; i < gss.length; i++) {
    for (let j = i + 1; j < gss.length; j++) {
      await gss[i]._libp2p.dialProtocol(gss[j]._libp2p.peerId, gss[i].multicodecs)
    }
  }
}

/**
 * Create a number of fully connected gossipsub nodes
 */
async function createConnectedGossipsubs ({ number = 2, options = {}} = {}) {
  const gss = await createGossipsubs({ number, started: true, options })
  await connectGossipsubs(gss)
  return gss
}

module.exports = {
  startNode,
  stopNode,
  createGossipsubs,
  connectGossipsubs,
  createConnectedGossipsubs
}

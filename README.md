js-libp2p-gossipsub
==================

[![](https://img.shields.io/badge/made%20by-ChainSafe-blue.svg?style=flat-square)](https://chainsafe.io/)
[![Travis CI](https://flat.badgen.net/travis/ipfs/aegir)](https://travis-ci.com/ipfs/aegir)

## Lead Maintainer

[Cayman Nava](https://github.com/wemeetagain)

## Table of Contents

* [Specs](#specs)
* [Install](#Install)
* [Usage](#Usage)
* [API](#API)
* [Contribute](#Contribute)
* [License](#License)

## Specs
Gossipsub is an implementation of pubsub based on meshsub and floodsub. You can read the specification [here](https://github.com/libp2p/specs/tree/master/pubsub/gossipsub).

## Install

`npm install libp2p-gossipsub`

## Usage

```javascript
const Gossipsub = require('libp2p-gossipsub')

const gsub = new Gossipsub(node)

gsub.start((err) => {
  if (err) {
    console.log('Upsy', err)
  }
  gsub.on('fruit', (data) => {
    console.log(data)
  })
  gsub.subscribe('fruit')

  gsub.publish('fruit', new Buffer('banana'))
})

```

## API

### Create a gossipsub implementation

```js
const options = {…}
const gossipsub = new Gossipsub(libp2pNode, options)
```

Options is an optional object with the following key-value pairs:

* **`fallbackToFloodsub`**: boolean identifying whether the node should fallback to the floodsub protocol, if another connecting peer does not support gossipsub (defaults to **true**).
* **`emitSelf`**: boolean identifying whether the node should emit to self on publish, in the event of the topic being subscribed (defaults to **false**).

## Contribute

This module is actively under development. Please check out the issues and submit PRs!

## License

MIT © ChainSafe Systems

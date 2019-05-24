js-libp2p-gossipsub
==================

[![](https://img.shields.io/badge/made%20by-ChainSafe-blue.svg?style=flat-square)](https://chainsafe.io/)
[![Travis CI](https://flat.badgen.net/travis/ipfs/aegir)](https://travis-ci.com/ipfs/aegir)

## Lead Maintainer

[Vasco Santos](https://github.com/vasco-santos)

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

## Contribute

This module is actively under development. Please check out the issues and submit PRs!

## License

MIT © Protocol Labs

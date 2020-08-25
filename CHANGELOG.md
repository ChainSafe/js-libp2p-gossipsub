<a name="0.5.0"></a>
# [0.5.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.6...v0.5.0) (2020-08-12)


### Bug Fixes

* replace node buffers with uint8arrays ([#118](https://github.com/ChainSafe/gossipsub-js/issues/118)) ([2f50108](https://github.com/ChainSafe/gossipsub-js/commit/2f50108))


### BREAKING CHANGES

* - The `.data` and `.seq` properties of messages used to be node Buffers, now they are Uint8Arrays
- All deps of this module now use Uint8Arrays instead of Buffers

* chore: remove gh url from dep version



<a name="0.4.6"></a>
## [0.4.6](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.5...v0.4.6) (2020-07-07)


### Bug Fixes

* connected with a subscriber before a mesh is created should send messages ([060346a](https://github.com/ChainSafe/gossipsub-js/commit/060346a))



<a name="0.4.5"></a>
## [0.4.5](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.4...v0.4.5) (2020-06-04)


### Bug Fixes

* use unidirectional streams ([#78](https://github.com/ChainSafe/gossipsub-js/issues/78)) ([8118894](https://github.com/ChainSafe/gossipsub-js/commit/8118894))



<a name="0.4.4"></a>
## [0.4.4](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.3...v0.4.4) (2020-06-03)


### Bug Fixes

* add static member for multicodec ([#81](https://github.com/ChainSafe/gossipsub-js/issues/81)) ([dd86739](https://github.com/ChainSafe/gossipsub-js/commit/dd86739))



<a name="0.4.3"></a>
## [0.4.3](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.2...v0.4.3) (2020-06-03)



<a name="0.4.2"></a>
## [0.4.2](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.1...v0.4.2) (2020-05-27)


### Features

* add topic validators to pubsub ([5712fd1](https://github.com/ChainSafe/gossipsub-js/commit/5712fd1))



<a name="0.4.1"></a>
## [0.4.1](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.0...v0.4.1) (2020-05-27)



<a name="0.4.0"></a>
# [0.4.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.3.0...v0.4.0) (2020-04-23)


### Chores

* remove peer-info usage ([602ccaa](https://github.com/ChainSafe/gossipsub-js/commit/602ccaa))


### BREAKING CHANGES

* using new topology api with peer-id instead of peer-info and new pubsub internal peer data structure



<a name="0.3.0"></a>
# [0.3.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.6...v0.3.0) (2020-04-23)


### Bug Fixes

* add buffer and update deps ([d8e9d1b](https://github.com/ChainSafe/gossipsub-js/commit/d8e9d1b))



<a name="0.2.6"></a>
## [0.2.6](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.5...v0.2.6) (2020-04-04)



<a name="0.2.5"></a>
## [0.2.5](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.4...v0.2.5) (2020-03-21)



<a name="0.2.4"></a>
## [0.2.4](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.3...v0.2.4) (2020-02-14)


### Bug Fixes

* remove use of assert module ([#65](https://github.com/ChainSafe/gossipsub-js/issues/65)) ([e0a37cc](https://github.com/ChainSafe/gossipsub-js/commit/e0a37cc))



<a name="0.2.3"></a>
## [0.2.3](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.2.3) (2020-02-03)


### Bug Fixes

* bind is not needed ([7faae98](https://github.com/ChainSafe/gossipsub-js/commit/7faae98))
* fix double publish bug ([519f868](https://github.com/ChainSafe/gossipsub-js/commit/519f868)), closes [/github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js#L21](https://github.com//github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js/issues/L21) [/travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804#L270](https://github.com//travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804/issues/L270)
* fix heartbeat startup/shutdown timing bug ([a8302f9](https://github.com/ChainSafe/gossipsub-js/commit/a8302f9))
* parameter to _onPeerDisconnected ([d43ceb5](https://github.com/ChainSafe/gossipsub-js/commit/d43ceb5))


### Chores

* update dependencies ([7a44b66](https://github.com/ChainSafe/gossipsub-js/commit/7a44b66))


### Code Refactoring

* switch to async iterators ([3027835](https://github.com/ChainSafe/gossipsub-js/commit/3027835))


### Performance Improvements

* do not depend on floodsub ([#63](https://github.com/ChainSafe/gossipsub-js/issues/63)) ([f825e07](https://github.com/ChainSafe/gossipsub-js/commit/f825e07))


### BREAKING CHANGES

* getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording
* Switch to using async/await and async iterators for all the API. Moreover, gossipsub does not need the libp2p instance anymore, receiving a registerar that enables it to receive the necessary events from libp2p



<a name="0.2.2"></a>
## [0.2.2](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.2.2) (2020-01-24)


### Bug Fixes

* bind is not needed ([7faae98](https://github.com/ChainSafe/gossipsub-js/commit/7faae98))
* fix double publish bug ([519f868](https://github.com/ChainSafe/gossipsub-js/commit/519f868)), closes [/github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js#L21](https://github.com//github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js/issues/L21) [/travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804#L270](https://github.com//travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804/issues/L270)
* fix heartbeat startup/shutdown timing bug ([a8302f9](https://github.com/ChainSafe/gossipsub-js/commit/a8302f9))
* parameter to _onPeerDisconnected ([d43ceb5](https://github.com/ChainSafe/gossipsub-js/commit/d43ceb5))


### Chores

* update dependencies ([7a44b66](https://github.com/ChainSafe/gossipsub-js/commit/7a44b66))


### Code Refactoring

* switch to async iterators ([3027835](https://github.com/ChainSafe/gossipsub-js/commit/3027835))


### BREAKING CHANGES

* getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording
* Switch to using async/await and async iterators for all the API. Moreover, gossipsub does not need the libp2p instance anymore, receiving a registerar that enables it to receive the necessary events from libp2p



<a name="0.2.1"></a>
## 0.2.1 (2019-01-14)


### Bug Fixes

* bind is not needed ([7faae98](https://github.com/ChainSafe/gossipsub-js/commit/7faae98))



<a name="0.2.0"></a>
## [0.2.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.1.0) (2019-12-02)

### Chores

* update dependencies ([7a44b66](https://github.com/ChainSafe/gossipsub-js/commit/7a44b66))

### BREAKING CHANGES

* getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording.



<a name="0.1.0"></a>
## [0.1.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.1.0) (2019-19-14)

### Code Refactoring

* switch to async iterators ([ec8db51](https://github.com/ChainSafe/gossipsub-js/commit/2c32d25))

### BREAKING CHANGES

* Switch to using async/await and async iterators.

<a name="0.0.2"></a>
## [0.0.2](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.1...v0.0.2) (2019-06-04)



<a name="0.0.1"></a>
## 0.0.1 (2019-06-04)


### Bug Fixes

* integration with js-libp2p ([f894281](https://github.com/ChainSafe/gossipsub-js/commit/f894281))




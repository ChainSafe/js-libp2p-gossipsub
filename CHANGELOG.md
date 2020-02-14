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




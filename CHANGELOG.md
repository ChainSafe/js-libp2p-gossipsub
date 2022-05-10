# [0.14.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.14.0...v0.13.2) (2022-04-05)

- New gossipsub implementation: better performance, async validation flow, improved peer scores significantly, add a lot of metrics

# [0.13.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.13.2...v0.13.1) (2022-03-25)

- Do not apply P3 penalty if peers are pruned from topic mesh
- Fix flood publish behavior
- Increase the default for seenTTL to match that of go-libp2p
- _publish: Only compute score if peer stream has FloodsubID protocol
- Migrate tests to Typescript
- Prettier
- Apply strict-boolean-expression eslint rule

# [0.13.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.13.1...v0.13.0) (2022-02-14)

- Fix async getFastMsgIdStr function

# [0.13.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.12.2...v0.13.0) (2022-01-20)

## [1.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.14.0...v1.0.0) (2022-05-10)


### ⚠ BREAKING CHANGES

* the output of this module is now ESM-only

### Bug Fixes

* browser tests ([cd09f89](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cd09f891d116cb4de6783b3a0814d6dcb2df5489))
* event awaiting ([799dd3f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/799dd3fa9f7fb9ed5176de25f8c2675231d23caa))
* flaky test and [#208](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/208) ([86a27a6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/86a27a66bd0d00f7f43997eab5728f1a09516096))
* gossip test for piggyback control ([25e7838](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/25e7838a506fe1a4928256e9e7517887f7ac8c03))
* more of the go-gossipsub tests passing ([2045fde](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2045fde3687a56331cd31463930bcd2f9e34362c))
* test mesh at time of publish ([b653f00](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b653f00865c4a43bd12f801fd93bba3522e5f404))
* tests passing ([2d74e27](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2d74e270dc7033e5ac304a312d4bc22863ebe199))
* update to esm libp2p and deps ([6785f17](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6785f1705aae763096315c004bf7355efea314ea))


### Miscellaneous

* add missing dep ([102c68b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/102c68b98a58a73531d38a772d2d44d14a7bc7da))
* add missing dep ([07c130b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/07c130b4f074c026ef93d7ab1c24e4f6725498f7))
* add missing protons dev dep ([da13c30](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/da13c309a9f612a5ee4ed4f29e21bffea0b7ff73))
* another missing dep ([4df0d81](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4df0d810959016cbc59b63472deb13e6c3d0fed8))
* disable firefox tests ([cc97f84](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cc97f847c3283b82d3d7263035aad0c801d172ea))
* do not wait in order ([f65d56d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f65d56d4ae110aa0d7cdbd1c61d93997bb1d80a8))
* ensure we get the right number of connections ([903d698](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/903d698a0f88f1f5fc646e02ae88cef24a6d9238))
* missing deps ([4a703b8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4a703b8bc5864af8f75ab14cf2a8505a2a937e54))
* only wait for the heartbeat of the node under test ([6d0afe9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6d0afe9f59050ac4464bc80e8acc4f473982b499))
* partial revert ([1d65689](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1d65689ed824f0a4e71f357b718db84798e6d820))
* remove libp2p dep in favour of programatic streams ([6d36b4b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6d36b4bda7db8f51d284e437bb12bb9e548f6577))
* restore license ([e110b2f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e110b2ffc3f68ec07aa1ef9b99b38d0a624f99e2))
* revert interface to type ([51d2135](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/51d21350f8153a3633c5d908e55936832ffd451b))
* run go tests on node ([3619aca](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3619acaf2dc7a7bc80d27006c09d695bab4510de))
* slow ci is slow ([02da20a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/02da20a5f7724862fd541b011ca31d3910608e04))
* test mesh before use ([9278534](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9278534977a344929b538456dbb7cc6bcca5f6e4))
* update ci ([18db40e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/18db40e09a1bedfb34d6f74ba5bf560cac921f8c))
* update interfaces ([1ec595c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1ec595cc577477232af7885f0aa6aee4bf45ce0e))

## [0.12.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.12.1...v0.12.2) (2022-01-20)

### Features

- async peerstore ([5c3491c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5c3491cc352670b32226e9d13e4289a473fa31d2))

### BREAKING CHANGES

- peerstore methods and pubsub start/stop are now all async

### Features

- Add optional fast message id cache via the `fastMsgIdFn` option
  - In certain applications, computing the message id (`getMsgId`) is relatively expensive. This addition allows for an application to optionally define a "fast" message id function that will be used internally.
- Add optional cached message id function via `getCachedMsgIdStr` method override
  - Applications can maintain their own cache of message ids

## [0.12.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.12.0...v0.12.1) (2021-12-03)

# [0.12.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.11.4...v0.12.0) (2021-12-02)

### chore

- update peer-id ([#173](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/173)) ([e61668e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e61668e6a11be3b633815960015124fb89f82f53))

### BREAKING CHANGES

- requires node 15+

## [0.11.4](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.11.3...v0.11.4) (2021-09-20)

### Bug Fixes

- hearbeat tick handler rounding issue ([#166](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/166)) ([a6d24de](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a6d24de39fc87f5860c6f45df1e7529056684030))
- ignore yarn lock ([b804758](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b80475838753e2472c736617f6ebf8fe4820734d))
- remove yarn.lock ([10e5dfe](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/10e5dfe3bb142bfc60cfe691205a591fd91f8b76))

### Features

- add more configuration options ([#165](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/165)) ([ff67106](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ff67106a98820f43511ac211f180e6761a689f1b))

## [0.11.3](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.11.1...v0.11.3) (2021-09-03)

## [0.11.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.11.1...v0.11.2) (2021-09-02)

## [0.11.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.11.0...v0.11.1) (2021-08-24)

# [0.11.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.10.0...v0.11.0) (2021-07-09)

### chore

- update deps ([#155](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/155)) ([df69a90](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/df69a909db2a770f5a7d054a898bab72020946df))

### BREAKING CHANGES

- the new `peer-id` module uses the new `CID` class and not the old one

# [0.10.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.9.2...v0.10.0) (2021-05-28)

## [0.9.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.9.1...v0.9.2) (2021-05-28)

### Reverts

- Revert "chore: update pubsub interface to run subsystem tests (#148)" ([87607fb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/87607fbcf0ed6c2c03f4d72fa1a888a3dff72d7a)), closes [#148](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/148)

## [0.9.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.9.0...v0.9.1) (2021-05-28)

# [0.9.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.8.0...v0.9.0) (2021-04-28)

# [0.8.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.7.0...v0.8.0) (2020-12-19)

<a name="0.7.0"></a>

# [0.7.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.6...v0.7.0) (2020-11-13)

<a name="0.6.6"></a>

## [0.6.6](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.5...v0.6.6) (2020-11-13)

<a name="0.6.5"></a>

## [0.6.5](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.4...v0.6.5) (2020-11-12)

<a name="0.6.4"></a>

## [0.6.4](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.3...v0.6.4) (2020-10-22)

<a name="0.6.3"></a>

## [0.6.3](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.2...v0.6.3) (2020-10-05)

<a name="0.6.2"></a>

## [0.6.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.1...v0.6.2) (2020-09-22)

<a name="0.6.1"></a>

## [0.6.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.6.0...v0.6.1) (2020-09-03)

<a name="0.6.0"></a>

# [0.6.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.5.0...v0.6.0) (2020-08-25)

### Bug Fixes

- pick uintarrays commit ([be47b50](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/be47b50))

### Features

- add \_acceptFrom filter ([1ff5816](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1ff5816))
- add adaptive gossip ([0c56763](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0c56763))
- add direct peer connections ([7103b83](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7103b83))
- add extended topic validators ([a1208b6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a1208b6))
- add flood publishing ([5854d26](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5854d26))
- add invalid message spam protection ([27fe567](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/27fe567))
- add iwant request tracking ([b3942e4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b3942e4))
- add opportunistic grafting ([cbee3a2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cbee3a2))
- add outbound mesh quota ([47bc4a7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/47bc4a7))
- add peer exchange ([a0a691b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a0a691b))
- add prune backoff ([4eb492c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4eb492c))
- libp2p as gossipsub parameter ([02dff12](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/02dff12))
- track ihave/iwant counts ([8e04a11](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8e04a11))

### BREAKING CHANGES

- Gossipsub default export parameter changed, now accepts
  (libp2p, options)

<a name="0.5.0"></a>

# [0.5.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.6...v0.5.0) (2020-08-12)

### Bug Fixes

- replace node buffers with uint8arrays ([#118](https://github.com/ChainSafe/gossipsub-js/issues/118)) ([2f50108](https://github.com/ChainSafe/gossipsub-js/commit/2f50108))

### BREAKING CHANGES

- - The `.data` and `.seq` properties of messages used to be node Buffers, now they are Uint8Arrays

* All deps of this module now use Uint8Arrays instead of Buffers

- chore: remove gh url from dep version

<a name="0.4.6"></a>

## [0.4.6](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.5...v0.4.6) (2020-07-07)

### Bug Fixes

- connected with a subscriber before a mesh is created should send messages ([060346a](https://github.com/ChainSafe/gossipsub-js/commit/060346a))

<a name="0.4.5"></a>

## [0.4.5](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.4...v0.4.5) (2020-06-04)

### Bug Fixes

- use unidirectional streams ([#78](https://github.com/ChainSafe/gossipsub-js/issues/78)) ([8118894](https://github.com/ChainSafe/gossipsub-js/commit/8118894))

<a name="0.4.4"></a>

## [0.4.4](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.3...v0.4.4) (2020-06-03)

### Bug Fixes

- add static member for multicodec ([#81](https://github.com/ChainSafe/gossipsub-js/issues/81)) ([dd86739](https://github.com/ChainSafe/gossipsub-js/commit/dd86739))

<a name="0.4.3"></a>

## [0.4.3](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.2...v0.4.3) (2020-06-03)

<a name="0.4.2"></a>

## [0.4.2](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.1...v0.4.2) (2020-05-27)

### Features

- add topic validators to pubsub ([5712fd1](https://github.com/ChainSafe/gossipsub-js/commit/5712fd1))

<a name="0.4.1"></a>

## [0.4.1](https://github.com/ChainSafe/gossipsub-js/compare/v0.4.0...v0.4.1) (2020-05-27)

<a name="0.4.0"></a>

# [0.4.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.3.0...v0.4.0) (2020-04-23)

### Chores

- remove peer-info usage ([602ccaa](https://github.com/ChainSafe/gossipsub-js/commit/602ccaa))

### BREAKING CHANGES

- using new topology api with peer-id instead of peer-info and new pubsub internal peer data structure

<a name="0.3.0"></a>

# [0.3.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.6...v0.3.0) (2020-04-23)

### Bug Fixes

- add buffer and update deps ([d8e9d1b](https://github.com/ChainSafe/gossipsub-js/commit/d8e9d1b))

<a name="0.2.6"></a>

## [0.2.6](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.5...v0.2.6) (2020-04-04)

<a name="0.2.5"></a>

## [0.2.5](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.4...v0.2.5) (2020-03-21)

<a name="0.2.4"></a>

## [0.2.4](https://github.com/ChainSafe/gossipsub-js/compare/v0.2.3...v0.2.4) (2020-02-14)

### Bug Fixes

- remove use of assert module ([#65](https://github.com/ChainSafe/gossipsub-js/issues/65)) ([e0a37cc](https://github.com/ChainSafe/gossipsub-js/commit/e0a37cc))

<a name="0.2.3"></a>

## [0.2.3](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.2.3) (2020-02-03)

### Bug Fixes

- bind is not needed ([7faae98](https://github.com/ChainSafe/gossipsub-js/commit/7faae98))
- fix double publish bug ([519f868](https://github.com/ChainSafe/gossipsub-js/commit/519f868)), closes [/github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js#L21](https://github.com//github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js/issues/L21) [/travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804#L270](https://github.com//travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804/issues/L270)
- fix heartbeat startup/shutdown timing bug ([a8302f9](https://github.com/ChainSafe/gossipsub-js/commit/a8302f9))
- parameter to \_onPeerDisconnected ([d43ceb5](https://github.com/ChainSafe/gossipsub-js/commit/d43ceb5))

### Chores

- update dependencies ([7a44b66](https://github.com/ChainSafe/gossipsub-js/commit/7a44b66))

### Code Refactoring

- switch to async iterators ([3027835](https://github.com/ChainSafe/gossipsub-js/commit/3027835))

### Performance Improvements

- do not depend on floodsub ([#63](https://github.com/ChainSafe/gossipsub-js/issues/63)) ([f825e07](https://github.com/ChainSafe/gossipsub-js/commit/f825e07))

### BREAKING CHANGES

- getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording
- Switch to using async/await and async iterators for all the API. Moreover, gossipsub does not need the libp2p instance anymore, receiving a registerar that enables it to receive the necessary events from libp2p

<a name="0.2.2"></a>

## [0.2.2](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.2.2) (2020-01-24)

### Bug Fixes

- bind is not needed ([7faae98](https://github.com/ChainSafe/gossipsub-js/commit/7faae98))
- fix double publish bug ([519f868](https://github.com/ChainSafe/gossipsub-js/commit/519f868)), closes [/github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js#L21](https://github.com//github.com/ChainSafe/gossipsub-js/blob/master/test/floodsub.spec.js/issues/L21) [/travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804#L270](https://github.com//travis-ci.com/ChainSafe/gossipsub-js/jobs/278427804/issues/L270)
- fix heartbeat startup/shutdown timing bug ([a8302f9](https://github.com/ChainSafe/gossipsub-js/commit/a8302f9))
- parameter to \_onPeerDisconnected ([d43ceb5](https://github.com/ChainSafe/gossipsub-js/commit/d43ceb5))

### Chores

- update dependencies ([7a44b66](https://github.com/ChainSafe/gossipsub-js/commit/7a44b66))

### Code Refactoring

- switch to async iterators ([3027835](https://github.com/ChainSafe/gossipsub-js/commit/3027835))

### BREAKING CHANGES

- getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording
- Switch to using async/await and async iterators for all the API. Moreover, gossipsub does not need the libp2p instance anymore, receiving a registerar that enables it to receive the necessary events from libp2p

<a name="0.2.1"></a>

## 0.2.1 (2019-01-14)

### Bug Fixes

- bind is not needed ([7faae98](https://github.com/ChainSafe/gossipsub-js/commit/7faae98))

<a name="0.2.0"></a>

## [0.2.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.1.0) (2019-12-02)

### Chores

- update dependencies ([7a44b66](https://github.com/ChainSafe/gossipsub-js/commit/7a44b66))

### BREAKING CHANGES

- getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording.

<a name="0.1.0"></a>

## [0.1.0](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.5...v0.1.0) (2019-19-14)

### Code Refactoring

- switch to async iterators ([ec8db51](https://github.com/ChainSafe/gossipsub-js/commit/2c32d25))

### BREAKING CHANGES

- Switch to using async/await and async iterators.

<a name="0.0.2"></a>

## [0.0.2](https://github.com/ChainSafe/gossipsub-js/compare/v0.0.1...v0.0.2) (2019-06-04)

<a name="0.0.1"></a>

## 0.0.1 (2019-06-04)

### Bug Fixes

- integration with js-libp2p ([f894281](https://github.com/ChainSafe/gossipsub-js/commit/f894281))

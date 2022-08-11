## [1.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.14.0...v1.0.0) (2022-05-10)


### ⚠ BREAKING CHANGES

* the output of this module is now ESM-only by @achingbrain in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/236
* Tiddy Gossipsub API and comments by @dapplion in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/227

### Bug Fixes

* Fix rpc.control metrics and reduce object creation by @dapplion in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/230
* Remove duplicate record of msgReceivedPreValidation metric by @tuyennhv in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/228

### Miscellaneous
* chore: update cd action by @mpetrunic in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/245


## [3.5.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.5.0...v3.5.1) (2022-08-11)


### Bug Fixes

* freeze libp2p dependencies to get through build errors ([#316](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/316)) ([5e6ce1f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5e6ce1f20a69c821536c4f362eb524f403475bfa))
* handle closing outbound stream ([#314](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/314)) ([74c08b1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/74c08b179ae4c77b6adccc53b123121efd0f3509))


### Miscellaneous

* benchmark protobuf ([#320](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/320)) ([af51f36](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/af51f36f16dbc99d909037a40b95e034439945d8))
* migrate to it-length-prefixed 8.0.2 ([#312](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/312)) ([90c2a0b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/90c2a0ba70ad7004618b14db8a265ab843f906dc))

## [3.5.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.4.0...v3.5.0) (2022-08-02)


### Features

* switch back to protobufjs ([#310](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/310)) ([64b40fc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/64b40fc597dbfd39e7c4941ba43cb62aec0dce23))

## [3.4.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.3.0...v3.4.0) (2022-07-22)


### Features

* allow configuring stream limits ([#293](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/293)) ([e0d3a7d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e0d3a7de4db5309ea2a66864de0abdd8677f3c2a))

## [3.3.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.2.0...v3.3.0) (2022-07-20)


### Features

* remove unnecessary direct dependency ([#303](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/303)) ([77baa6e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/77baa6eed78c24923bd89df525f65f3c0852f1f2))

## [3.2.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.1.0...v3.2.0) (2022-07-19)


### Features

* allow usage of custom codecs ([#288](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/288)) ([0e76f49](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0e76f49d2924d65a6e76ecd1e842db66f2eddd34))

## [3.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.0.2...v3.1.0) (2022-07-11)


### Features

* tweak stream handling ([#298](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/298)) ([7eda34b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7eda34b16cf00077038f82ac243dcf0ed52a8892))

## [3.0.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.0.1...v3.0.2) (2022-06-30)


### Bug Fixes

* allow publish of no-sign messages ([#296](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/296)) ([40dadb8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/40dadb8d8b70257459a266271adf83457bb3a3fc))

## [3.0.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.0.0...v3.0.1) (2022-06-29)


### Bug Fixes

* unblock strict no sign messages ([#294](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/294)) ([9e964cc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9e964cc02c52364ecf494cad5603c3712153c433))

## [3.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v2.0.0...v3.0.0) (2022-06-29)


### ⚠ BREAKING CHANGES

* connection interface updated

### Miscellaneous

* fix link to interface doc ([#290](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/290)) ([4801f19](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4801f1937b8fb4503186fa2f331a085760c2f17f))
* update interface dependencies ([#291](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/291)) ([6399072](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6399072001aaba3cb47b6263d93cb7443cf07f20))

## [2.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.2.0...v2.0.0) (2022-06-15)


### ⚠ BREAKING CHANGES

* uses new single-issue libp2p interface modules

### Features

* update libp2p interfaces ([#284](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/284)) ([0b69109](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0b691090db3d997a56ea8a6324db04a8d6d78fc2))

## [1.2.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.1.2...v1.2.0) (2022-06-15)


### Features

* add msgIdToStrFn option ([#270](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/270)) ([7f475c5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7f475c5e02a6dae4b490ec8608b0cc60d9dd19f1))
* improve heartbeat performance ([#268](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/268)) ([840883d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/840883dabe02520164ff889e649c76d57fbf0d09))
* remove messageIdFromString ([#274](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/274)) ([43faf93](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/43faf93a16e3cb0dc5dabe2ec63e866bbd0dbc82))


### Bug Fixes

* finding outbound peers in heartbeat ([#266](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/266)) ([17c25a1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/17c25a1b4af1446615c42bdb2ed2f208b3f6a5ad))
* only gossip validated messages ([#277](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/277)) ([c8784c7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/c8784c7f41593cdd9ffa8670fd306ccab6c1e671))


### Miscellaneous

* add linting to tests ([#279](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/279)) ([4b9b040](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4b9b0402b898b71e6de4e6e4f1ce17688d8f1d13))
* add missing release token ([#280](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/280)) ([fd75b2a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/fd75b2a76ba05bf572e3e408274054a459655fc2))
* remove gossipIncoming param ([#281](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/281)) ([d327999](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/d327999f790047e545f90a44dd920abf00b5c4fd))
* update aegir ([#285](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/285)) ([e487d08](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e487d0886e1b90fb87cd102af493240e629de7c9))

## [1.1.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.1.1...v1.1.2) (2022-06-03)


### Bug Fixes

* fix typesVersions ([#264](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/264)) ([8a4e6a8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8a4e6a84a3bf165d7022c471d07afce52d01f517))

## [1.1.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.1.0...v1.1.1) (2022-06-03)


### Bug Fixes

* fix subpath exports ([#261](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/261)) ([281608e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/281608ee13832f1ffa7cba7ce9f49ec836bbb13d))

## [1.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.0.1...v1.1.0) (2022-06-03)


### Features

* add subpath exports ([#255](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/255)) ([998fa79](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/998fa79d369f40606581a8ed2d70b244e2b460cd))


### Bug Fixes

* opportunistic graft ([#257](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/257)) ([035314c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/035314c472f936520357dd2023ca96ccb4be0853))


### Miscellaneous

* separate e2e tests ([#259](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/259)) ([e84a7fd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e84a7fd25ff63d55f98f543da86724aec0f61edc))

### [1.0.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.0.0...v1.0.1) (2022-05-23)


### Miscellaneous

* move ts/ to src/ ([#250](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/250)) ([6bf0693](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6bf0693f924785abd933c9ee37332ab00ce947d0))
* update interface deps ([#254](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/254)) ([01b28fd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/01b28fd7dcd1dc488b0c78c09f72f455e05f745f))

## [0.14.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.14.0...v0.13.2) (2022-04-05)

- New gossipsub implementation: better performance, async validation flow, improved peer scores significantly, add a lot of metrics

## [0.13.2](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.13.2...v0.13.1) (2022-03-25)

- Do not apply P3 penalty if peers are pruned from topic mesh
- Fix flood publish behavior
- Increase the default for seenTTL to match that of go-libp2p
- _publish: Only compute score if peer stream has FloodsubID protocol
- Migrate tests to Typescript
- Prettier
- Apply strict-boolean-expression eslint rule

## [0.13.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.13.1...v0.13.0) (2022-02-14)

- Fix async getFastMsgIdStr function

## [0.13.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.12.2...v0.13.0) (2022-01-20)

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

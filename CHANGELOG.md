## [1.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.14.0...v1.0.0) (2022-05-10)


### ⚠ BREAKING CHANGES

* the output of this module is now ESM-only by @achingbrain in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/236
* Tiddy Gossipsub API and comments by @dapplion in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/227

### Bug Fixes

* Fix rpc.control metrics and reduce object creation by @dapplion in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/230
* Remove duplicate record of msgReceivedPreValidation metric by @tuyennhv in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/228

### Miscellaneous
* chore: update cd action by @mpetrunic in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/245

## [1.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v1.0.0...v1.0.0) (2022-05-10)


### ⚠ BREAKING CHANGES

* the output of this module is now ESM-only
* peerstore methods and pubsub start/stop are now all async
* requires node 15+
* the new `peer-id` module uses the new `CID` class and not the old one
* Gossipsub default export parameter changed, now accepts (libp2p, options)
* using new topology api with peer-id instead of peer-info and new pubsub internal peer data structure
* getPeersSubscribed from parent class renamed to getSubscribers to remove redundant wording
* Switch to using async/await and async iterators for all the API. Moreover, gossipsub does not need the libp2p instance anymore, receiving a registerar that enables it to receive the necessary events from libp2p

### Features

* add _acceptFrom filter ([1ff5816](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1ff581650c0eae2fdd97df72244de6d234fc0364))
* add adaptive gossip ([0c56763](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0c56763dcf76a8f4f19e8cfa44cb45a58bcb47d7))
* add direct peer connections ([7103b83](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7103b837de8b147440cbe1caccc525a8a7ffe134))
* add extended topic validators ([a1208b6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a1208b60c6ed6ee339e1d25f32d5e28bed1c838a))
* add flood publishing ([5854d26](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5854d2629a596fb174f1f82b7124e72c77baa256))
* add invalid message spam protection ([27fe567](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/27fe567cb4b0f8d70c1c7931652f0e908feb5dce))
* add iwant request tracking ([b3942e4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b3942e4caa5f1ab9d11fb0e6f34402c3d3b94e6d))
* add more configuration options ([#165](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/165)) ([ff67106](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ff67106a98820f43511ac211f180e6761a689f1b))
* add opportunistic grafting ([cbee3a2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cbee3a24111835eec77811040b5979cf40d43d81))
* add outbound mesh quota ([47bc4a7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/47bc4a71a3036e8bf66c4bd5a5663f4347423d5d))
* add peer exchange ([a0a691b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a0a691b80d82a7b8512640fca39feed75d2200fa))
* add prune backoff ([4eb492c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4eb492ccbe1d4edf8e1ca014b866a47629066320))
* add strict signing ([0908c10](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0908c10666c2a7a1681a265ff462e7b294e3078e))
* add topic validators to pubsub ([5712fd1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5712fd15249bd3429604ef42f24483b55f396a55))
* async peerstore ([5c3491c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5c3491cc352670b32226e9d13e4289a473fa31d2))
* fallback to floodsub ([707d106](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/707d10632822723fc2384687dc24ebd3b91e16a6))
* libp2p as gossipsub parameter ([02dff12](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/02dff12d8c6fdd2700e1edc9bb22fa8460e42bd0))
* self emit option added ([bf17585](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bf1758592f96becb4a6ce7ff0d5e6aeea41bc20b))
* track ihave/iwant counts ([8e04a11](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8e04a118c92a630f6a2dc01e9210184e2462bb1f))


### Bug Fixes

* add buffer and update deps ([d8e9d1b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/d8e9d1be9295fa4fd0e4eb704eb1b4049627c1f8))
* add static member for multicodec ([#81](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/81)) ([dd86739](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/dd86739be289022e17e99aab83939749bdb45ee2))
* bind is not needed ([7faae98](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7faae98f0ef7a1a35edc4f2c6b27bdf43791dfa9))
* browser tests ([cd09f89](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cd09f891d116cb4de6783b3a0814d6dcb2df5489))
* connected with a subscriber before a mesh is created should send messages ([060346a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/060346a249f8b3d1fcfa5258766ae75d0fa09cf5))
* event awaiting ([799dd3f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/799dd3fa9f7fb9ed5176de25f8c2675231d23caa))
* fix double publish bug ([519f868](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/519f86846efa2886ec3a5379d26405e9305b42b0))
* fix heartbeat startup/shutdown timing bug ([a8302f9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a8302f92f88f99928522421695e5302da93c5ec1))
* flaky test and [#208](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/208) ([86a27a6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/86a27a66bd0d00f7f43997eab5728f1a09516096))
* gossip test for piggyback control ([25e7838](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/25e7838a506fe1a4928256e9e7517887f7ac8c03))
* hearbeat tick handler rounding issue ([#166](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/166)) ([a6d24de](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a6d24de39fc87f5860c6f45df1e7529056684030))
* ignore yarn lock ([b804758](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b80475838753e2472c736617f6ebf8fe4820734d))
* more of the go-gossipsub tests passing ([2045fde](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2045fde3687a56331cd31463930bcd2f9e34362c))
* multicodec for floodsub missing ([21240f1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/21240f18ce7b23b940d1d2ddba8906493f8a55f5))
* parameter to _onPeerDisconnected ([d43ceb5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/d43ceb5df71a7f4c079106e98cb224c670180df1))
* pick uintarrays commit ([be47b50](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/be47b500f7327cf2cd6aa8153052932c1ff2a30e))
* remove use of assert module ([#65](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/65)) ([e0a37cc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e0a37ccbb7a4577d6e4b125c021a9945f17d3ea5))
* remove yarn.lock ([10e5dfe](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/10e5dfe3bb142bfc60cfe691205a591fd91f8b76))
* replace node buffers with uint8arrays ([#118](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/118)) ([2f50108](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2f5010815ba16cf2545ec4afb5a218586b1cfe52))
* send subscriptions once ready ([3d12e2d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3d12e2d44f3c8c4f51e08a4497469cc2375a87fa))
* test mesh at time of publish ([b653f00](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b653f00865c4a43bd12f801fd93bba3522e5f404))
* tests passing ([2d74e27](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2d74e270dc7033e5ac304a312d4bc22863ebe199))
* update to esm libp2p and deps ([6785f17](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6785f1705aae763096315c004bf7355efea314ea))
* use unidirectional streams ([#78](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/78)) ([8118894](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8118894e7aace29220d0a683cdccfeb368bfd770))


### refactor

* switch to async iterators ([3027835](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3027835b2ade8c723ba53470eb7697d8178fb095))


### Miscellaneous

* add build step to travis ([a1a78cb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a1a78cbf41a69825f1d520fa033a15af4bd2bc0e))
* add constant for prune backoff ticks ([378e459](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/378e459ba346881f4cb9bf9df05db318d85ede73))
* add constants and comments ([0b3e5e4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0b3e5e4783cebe1470d58e0e63aea606c987e7bd))
* add dev dependencies ([54ff4b6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/54ff4b6df08d2a1c4f5d9f4c3a786c21e09ed1b7))
* add err-code ([a6c4de4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a6c4de4965a97457969b96e006d05773974be200))
* add fn comments ([53e7a0a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/53e7a0adf8849a05ae6ef4e1f99df6c73c191248))
* add go gossipsub tests ([8d1975a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8d1975ab8c2af10f7aed15762a7e8d3545772f6b))
* add gossip retransmission counter ([255271d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/255271dfc08e21f28c2ae06c975668c375600409))
* add gossipsubv1.0 as a fallback multicodec ([9ab70e5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9ab70e5c2a633448a40805cc7f24df4a607f1035))
* add iwant tracer tests ([efb680c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/efb680c41420a65645693dd26b90609e19538486))
* add lead maintainer property ([d48dfbc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/d48dfbc7fce97856b790cc35edf10e0f232d8bb5))
* add libp2p as dependency ([1c0a39c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1c0a39c3707b7ba9b4a9f90b3e9889d1c5ec44c1))
* add message delivery to _publish ([b1d7e03](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b1d7e03c51ed79252a5a4403314281862c38168c))
* add message signing options ([#141](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/141)) ([3f9f03a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3f9f03ae133483678472224252daf84bfc51ba95))
* add missing dep ([102c68b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/102c68b98a58a73531d38a772d2d44d14a7bc7da))
* add missing dep ([07c130b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/07c130b4f074c026ef93d7ab1c24e4f6725498f7))
* add missing protons dev dep ([da13c30](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/da13c309a9f612a5ee4ed4f29e21bffea0b7ff73))
* add more comments to RPC interfaces ([12c40d1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/12c40d1edef0ad3fa44fedee04cad31aca5777e6))
* add new dev dependencies ([4beb8b2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4beb8b20060cc601e504aa6e16db26b10c33f218))
* add overlay params as configurable options ([9351e32](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9351e32b6c3f8039dc633c1a5480cdcf8015290e))
* add override jsdoc ([7362227](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7362227b34c2ea5104c2a6964c0b3812695d3c17))
* add peer score machinery ([cddee52](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cddee527246a943b2a416701f74459c8f33d4827))
* add peer score obj to gossipsub ([280a7d3](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/280a7d390fe0847cc9efcbfbc6343cca36751071))
* add pre_script to travis ([ba64575](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ba645759dbc96d2d0c9d870f87e78ddc0c6212fa))
* add prebuild to each travis step ([7a10769](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7a1076941db9d2eebe4d478cb1a1ce52548d6569))
* add pretest script ([666099e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/666099e8452c3179850db53bf6bbf182adb5fcd3))
* add retry for opportunistic grafting test ([035d43d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/035d43da2af88f32012bfb9fe8a2777228d24d4a))
* add started to createPeer ([9520272](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/95202727f17033b4d86d4b1523dce16ac0638d9d))
* add/remove peer from peer scoring ([513b90c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/513b90c17856f88935e1b80fdf3cdfff0bc2f438))
* address PR comments ([8610696](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8610696c908097987b8197e097b9f3d198388b26))
* address PR comments ([9e35ed6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9e35ed6b0cb66847a033d1ff86b6be2adc74ea41))
* address review ([bfa4378](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bfa43784901c5111c8ac6adf4787664f0a910004))
* AddressBook => ConnectionManager ([f17b2c6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f17b2c6cf50fc32d37edd9bae8662dce8a2d74c5))
* another missing dep ([4df0d81](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4df0d810959016cbc59b63472deb13e6c3d0fed8))
* appease linter ([2754dcf](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2754dcf16fa8cc496ac5d0ed061fcbfbe20fa187))
* apply iwant penalties in heartbeat ([b63df8b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b63df8b8a90affc77846b0dd6c8f8e38c1c804aa))
* apply suggestions from code review ([fd19fa5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/fd19fa5a4e5d9fdf7aa5447bc8c2104ae65de9be))
* apply suggestions from code review ([12c1805](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/12c1805607c23ab0f259619e0be1b4acd3e3b82c))
* await test send/recieve msgs at once ([0973442](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0973442cff88640b6c062b30c2e8d84777604e9d))
* clean up package.json ([f2ab1fd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f2ab1fdc8b73cdb4618002227a3ba5a6c8d9adad))
* clean up protobuf exports ([0f69461](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0f69461dfb2005df20753fafc0df109a248d2038))
* code review feedback handled ([66f79ef](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/66f79ef41ca85932f576b993f8632be0caf9c6a9))
* consistent files naming ([932801e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/932801e8fe083abad986633607a299d341a4520c))
* consolidate publish functionality ([e7d881c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e7d881c97f8757c9e39d98c87b0736b9eb73f9c3))
* create px messages concurrently ([74f764a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/74f764a0fa2ec143a0e34131091437ae7498de8a))
* default constructors score params/thresholds ([98beab9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/98beab9ce826bda78fd527d87c20eea309f6e29a))
* default params/thresholds as objects ([3ccbfa8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3ccbfa8ca7c8b44d187f64d70a259f3e4f0d6db7))
* disable firefox tests ([cc97f84](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cc97f847c3283b82d3d7263035aad0c801d172ea))
* do not wait in order ([f65d56d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f65d56d4ae110aa0d7cdbd1c61d93997bb1d80a8))
* emit to self ([fdb5599](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/fdb5599ae8985898f474a86b9e5f5f314d7d1cf5))
* ensure we get the right number of connections ([903d698](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/903d698a0f88f1f5fc646e02ae88cef24a6d9238))
* factor out msg sending function ([454e6cd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/454e6cd85c503be08963407db127a65c3f00ae58))
* fix edge-case in checkReceivedMessage ([e13d19e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e13d19e4c3fba7c623ac4a2f4a0128db47a86f6b))
* fix floodsub test ([bc7ffe9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bc7ffe942e8da42a3a6fc9629764dc0dd1c8e761))
* fix p retry throw ([7f5ddeb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7f5ddeb0be1e872b2949cb69aff86f910074f5bb))
* fix peerScore test ([88480ec](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/88480ec412e820ee8c546ce3305a36be3d3584f3))
* fix PeerScore#deliverMessage ([2663dcb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2663dcbe838fc801ff4612fcccdc277ef3502915))
* fix subscribe/unsubscribe ([44e22c9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/44e22c9516f22ee052cc991e86d169bda1f13be4))
* fix tests ([518fcc7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/518fcc7d84f173bb48576fe1d5f80d9630806a96))
* fix tests ([09a0846](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/09a0846cc9210df2ab7756dad3d1d1aa28c6436f))
* fix up subscribe/unsubscribe ([#129](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/129)) ([86c3bf7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/86c3bf72aada9d490fde0e281fe49ae47751c1d2))
* fix various bugs ([7acba0b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7acba0bcd3328d7b54c9dcbebb54db5d95e252c2))
* GossipSub => Gossipsub ([414ed51](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/414ed5170e60f82d97a6efc2d116f2ecac99cb1e))
* ignore iwant from peers with low score ([3a59969](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3a5996957b13c9fcc4379aae735ca019bd02897b))
* ignore messages from unsubbed topics ([ccac786](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ccac7868420ef8c7e0df1c6fa0ab2b4618ca96b3))
* increase heartbeat event timeout ([9d97e3c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9d97e3c806916825112add478a9bc8306c3b7c21))
* increase test timeouts ([55c3d0b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/55c3d0b2eeff2ae6471b82860c9a5aa24ca4d8ea))
* increase the default for seenTTL to match that of go-libp2p ([cabb894](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cabb894996f32f1321b2246a2c073ad331407a33))
* libp2p as dev and peer dependency ([40b8974](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/40b89747522d61c41b32752d25ca7b2c0dce380b))
* maps / internal methods use string id ([61698eb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/61698eb8c4ec417500f92ca4142e56fff6e11fc6))
* **master:** release 1.0.0 ([#246](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/246)) ([2d66a46](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2d66a46df42263609deac7032705812bb7e7c13a))
* merge master ([2754660](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2754660258a6a912421a86cda0422ff0b8711c3b))
* misc fixes ([37a107c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/37a107cc477d60d3d8dfdfed750c4b12f3a57e83))
* missing deps ([4a703b8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4a703b8bc5864af8f75ab14cf2a8505a2a937e54))
* move getGossipPeers to separate file ([7e81b06](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7e81b066a2682667d35c7479dec18d210efa76c8))
* move utils to utils folder ([ceafe1e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ceafe1e5a9f1b90ff3cc0a4ee487247eb6676fcd))
* only wait for the heartbeat of the node under test ([6d0afe9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6d0afe9f59050ac4464bc80e8acc4f473982b499))
* partial revert ([1d65689](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1d65689ed824f0a4e71f357b718db84798e6d820))
* peerScore: use string instead of peer id ([31224a6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/31224a61c69f825cca2ff2fdc6780447f08e1899))
* readme with 1.1 spec ([#134](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/134)) ([95fd1a0](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/95fd1a0bd605afa719d7a8b6f60fa189c2d7dc43))
* refactor onDial logic ([446c6f8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/446c6f810017ba0101d832bf944ede484ed50143))
* release 1.0.0 ([2358129](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2358129eb10f1c1adacc07fd7121e9e28364b39f))
* release version v0.0.1 ([c69ecb5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/c69ecb5a3aba278cdf275f80749655c10b9a1e4b))
* release version v0.0.2 ([27436ce](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/27436ce910f07ad4d07c6834a157c09a8af4b8f8))
* release version v0.1.0 ([ccb49bf](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ccb49bf48a9d11a2bb83c98cd108a934a44060f1))
* release version v0.10.0 ([3c3c465](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3c3c46595f65823fcd7900ed716f43f76c6b355c))
* release version v0.11.0 ([350ed5f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/350ed5fa35b806b434193cc9418d29d2af324933))
* release version v0.11.1 ([1131131](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1131131a7a12bf2d45a39a4c44eafb25ff13966a))
* release version v0.11.3 ([16d2c42](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/16d2c42649e6981fc35c293c8d58230c468e42bd))
* release version v0.11.4 ([efb8cba](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/efb8cba0b4f5a56dc0edc323ced0ae2d1bfeed86))
* release version v0.12.0 ([2548894](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/25488948ba00b7a3a4a1405cdf9c9df487d70d38))
* release version v0.12.1 ([1843887](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/184388766f29d760dfbc5da4c268bf2b1f64415f))
* release version v0.12.2 ([e361955](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e3619555cbedb28f811bf54d6ac2cc95816efa42))
* release version v0.13.0 ([60dc8d1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/60dc8d13a35f5071fc77d95a2dbf3372ce185534))
* release version v0.2.0 ([8e15324](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8e153242aa3110dce60b57a747b3582647048e0e))
* release version v0.2.1 ([ae9dde2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ae9dde28b80480e6a464936304614a9c3289d705))
* release version v0.2.2 ([67e35c2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/67e35c252f45d9105e94a2431c1d6f68ed0f9622))
* release version v0.2.3 ([978444d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/978444d2bab09c7bf16cf50719c7f76de77cb358))
* release version v0.2.4 ([97515f7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/97515f7022b305867440f61acde365c61c802159))
* release version v0.2.5 ([7c6f65b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7c6f65bdc14e596f696e01a918990ae2fbec65a9))
* release version v0.2.6 ([f2b67a2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f2b67a23a1c88d7bf68ba8c4a370c9ce6df0b426))
* release version v0.3.0 ([cf62125](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cf621254985db624c3438433efb911e4278bf670))
* release version v0.4.0 ([aafe59a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/aafe59aa84cb78b367bcfaf26c8df94fe80c4a30))
* release version v0.4.1 ([05fbf3c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/05fbf3c038a2818147a930f6d6c71d77712cd6f8))
* release version v0.4.2 ([7d31804](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7d318046e5092d46fcc35fd5f83e09ac7d75d608))
* release version v0.4.3 ([df12156](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/df12156f25a6aef953b2091d53c5855ad2bd1666))
* release version v0.4.4 ([beaa225](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/beaa2258369cd780a096b8c26cf909c8dc08f383))
* release version v0.4.5 ([97943fe](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/97943feb72b1cf992c99c9ecb0efe01c5d1d5a57))
* release version v0.4.6 ([a590997](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a590997c6a5f689b1b629fa4348c3b4987c79658))
* release version v0.5.0 ([28d214e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/28d214e8f071d29aa2ed91fd6060e39b78ee2d4c))
* release version v0.6.0 ([ac7805a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ac7805a7c1eb88925a6ebdb9b18f0d233fee7fd8))
* release version v0.6.1 ([f8bfa8d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f8bfa8dbad615bdb05cc5fb4a5e21b3b829c0268))
* release version v0.6.2 ([00ebb10](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/00ebb105d9c69498367ccc65647b677cf1ecae90))
* release version v0.6.3 ([92589ec](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/92589ecc38e697c5999efdd5e806c040fd7cd9bd))
* release version v0.6.4 ([3909464](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/39094642cfa71eacc5462f26f4983ecbaed2c5c3))
* release version v0.6.5 ([8e6bed4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8e6bed47a5f7556e4e1ddec05baabd215aadd827))
* release version v0.6.6 ([3ead034](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3ead034e94e62c4c7e77e08e78e67a968d46d67d))
* release version v0.7.0 ([299cfd9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/299cfd9ec53cfaf2f9bf59d10b7c3e67f8e89d74))
* release version v0.8.0 ([e4ed074](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e4ed0749fd6f93dcb89d0a562f498e91ead3b96f))
* release version v0.9.0 ([966bd47](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/966bd4724b7bee794c9be3428dcaf183193490c6))
* release version v0.9.1 ([eb9f0ae](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/eb9f0aec689ee27c7026e2205dc01cab085e6118))
* release version v0.9.2 ([28c996d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/28c996d60efeeabe0cbfb041559866426566918c))
* remove allowJs tsconfig option ([b2b1888](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b2b1888d821f61c5cbe13c19ac31949cc40c7983))
* remove duplication in RPC interfaces ([99bb48f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/99bb48fcfe5b268d80140d81a90a65b25dda4493))
* remove emit self tests ([e44efdc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e44efdc8bd574866e2bf9b25b81f004e3fe4117a))
* remove libp2p dep in favour of programatic streams ([6d36b4b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6d36b4bda7db8f51d284e437bb12bb9e548f6577))
* remove libp2p-pubsub usage ([7fe7aff](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7fe7aff3d3cf66a952929bd5824f618ce3224c15))
* remove node buffers ([#174](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/174)) ([cee561e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cee561e9e506666c6d1cc219085520ae80c4d3ad))
* remove peer-info usage ([602ccaa](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/602ccaaf77016323900b523cb19b3b438f7f6276))
* remove pubsub file ([5b6cc8b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5b6cc8b2b679adf46fc2f57d23555667ce171e13))
* remove pubsubStopped validations ([fc9f13a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/fc9f13a0667191a401665a8b4c74d34868eb69da))
* remove skips from go-gossipsub tests ([30b2b05](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/30b2b0596c19f802ab6b825fe64c2c6be5ee9a3d))
* remove stray async ([09ef6d9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/09ef6d9d5d24e18cd3c3e5d7711a18cff86bf1fb))
* remove type annotation from js file ([42eea65](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/42eea658763ba4dfa9840e611ebf93bb34615de7))
* remove type annotation from js file ([7f313bc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7f313bcff4c07e0a24b4501bf07b15b9feca5e3b))
* remove unused comment ([15befbd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/15befbd82a68b52a7b610941dea7e668c658f3a1))
* remove unused deps and move libp2p to a test dep ([ae85173](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ae851735bf217b0d8468bd0476b1e68df5d40638))
* rename stray peerStreams ([91ba696](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/91ba6960e1e9688b2fcea37d852b88bd276616ba))
* rename Stream to DuplexIterableStream ([af2ef9e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/af2ef9ed78a50624f137e5f2e19dab5bae1b7406))
* replace timeouts with suite-wide timeout ([f38b420](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f38b420a79465f36eea55a034a76d8f9a49a6918))
* restore license ([e110b2f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e110b2ffc3f68ec07aa1ef9b99b38d0a624f99e2))
* revert interface to type ([51d2135](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/51d21350f8153a3633c5d908e55936832ffd451b))
* run go tests on node ([3619aca](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3619acaf2dc7a7bc80d27006c09d695bab4510de))
* simplify handleIWant, etc fn signatures ([02da71d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/02da71d8f4b1af8e2be1e30afbb85d63193723c5))
* skip unreliable tests ([cda02f9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cda02f9ab8f618fa6d81e3cc10821db9594fde97))
* slow ci is slow ([02da20a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/02da20a5f7724862fd541b011ca31d3910608e04))
* split score params/thresholds files ([2293dc4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2293dc4884966b3e18c0ab2949393ae5b4ba9fb6))
* support uint8Array message id ([#143](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/143)) ([2a72ec2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2a72ec28046a1642ad91811e571305e8c33b43e2))
* sync IP update, clear data on stop ([7206a9d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7206a9df9cab9d6046b6a824fb8f45301eac105b))
* test mesh before use ([9278534](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9278534977a344929b538456dbb7cc6bcca5f6e4))
* test tweaks ([fea3341](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/fea33413cd7bb3afdd22567dd743123276669192))
* tweak non-flood-publish behavior ([0a49b20](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0a49b20000864bc46122b2f4b7cd0753258752ba))
* tweak PeerScore start/stop ([eea879f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/eea879ffd3a1502bfc613b3ddc02e931687a5f0f))
* tweak test ([5c6df19](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5c6df19b290b145ba78c74c81e61872fc5959c7b))
* tweak test timeouts ([37d7020](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/37d7020dc4ef68f27c0a21bc4c0a6300bb7f12f8))
* tweak tests ([05e8b1c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/05e8b1c991ccc12895f566ff7949b392fc3a8175))
* tweak tests ([44e0e2e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/44e0e2ed578435c737b28d081d464462e30a56f2))
* tweak tests ([cf581eb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cf581ebfbd226854ed65282f80b52d8ebd1c4635))
* tweak tests ([761e8a5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/761e8a537eb848ec52b1f2ce48ad58dda15e78f3))
* tweak tests ([565662c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/565662c626a431abb2caeb290635744a2ba3fdd6))
* update aegir ([7312d13](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7312d1362fb8708d10968369d6a17fe4e4a483c3))
* update aegir ([a7edf4f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a7edf4fa472ca01ee48d174783a1571d8a93390c))
* update benchmarks ([#147](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/147)) ([12626e8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/12626e863075d5fb1ef88cfed36b72c3b70cdf0f))
* update ci ([18db40e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/18db40e09a1bedfb34d6f74ba5bf560cac921f8c))
* update comments ([3bd547f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3bd547fb0137f0cb570e4d40d5e1f64d978dac68))
* update contributors ([5868137](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/586813710bf8130d201c4cd1692b1a33b139a30e))
* update contributors ([83bf8d4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/83bf8d47e8271076b4741946292f113d149697d6))
* update contributors ([05806da](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/05806da031e77163efb9cd305c7463893cb57fb6))
* update contributors ([281db72](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/281db72c21dc65c618e609dba81e8eba1e45a222))
* update contributors ([25b358d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/25b358d6f0f50a161cd6db670c589d633834a785))
* update contributors ([cdfe958](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cdfe958539cf83e9bd770946baf793c86ace4a96))
* update contributors ([05084d5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/05084d5fee440b378ec0324c9f6796cbed369a73))
* update contributors ([b5771c3](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b5771c3633190558f9dbe6f4236db62c80e54d2d))
* update contributors ([424004b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/424004b34e8e38cda6fc8a589698ff9f20cd5865))
* update contributors ([bc95b15](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bc95b159dfe6e96ba7f5e25b93b99db261d7a1d5))
* update contributors ([bbb3707](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bbb370710b73093e4bbc454245c9bc965e4f2fac))
* update contributors ([18a7c35](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/18a7c35e32f0e80deb8136500be7fd898b385753))
* update contributors ([4d08e40](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4d08e4037239612bc7e7074a290119f23610ce0d))
* update contributors ([155f6e1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/155f6e1c51d690f179edd7f58157143de2a5dc2a))
* update contributors ([e338638](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e338638b33660aeb9f3c3fa23f728c768b6276ac))
* update contributors ([5be6956](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5be6956961f67be430c2e77a045d1fc425f972d7))
* update contributors ([7560d7d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7560d7d70a889d57c404fad35c7a47e143b20abb))
* update contributors ([60ce484](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/60ce4841a06eb5f18496a569ae8eb6f8b549b141))
* update contributors ([f2a4c88](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f2a4c88f2fcec5915dc947ef97caf1a5d0bd6347))
* update contributors ([808ebe1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/808ebe11b86b3644257858dc0a00e1423b09c856))
* update contributors ([45c8b25](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/45c8b25787ab4dbdf6884f3ce7a377100053e2d7))
* update contributors ([60c1486](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/60c1486fa9f1c4392dbbbf19964b205b0d8e4235))
* update contributors ([a76f829](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a76f8297ac65a61d2453526c58859b062a59ddb0))
* update contributors ([2f1fdaa](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2f1fdaa935aa242d060ffb2b95867e96bbece15b))
* update contributors ([569d66d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/569d66d36d3db52368502b6ff5581e44e97c99ca))
* update contributors ([e69b983](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e69b98325e7d207961bfe78f0dc4101fe2be9b13))
* update contributors ([a3cfaae](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a3cfaae31ec65552fad5493d6aae1e63d91747ef))
* update contributors ([ec553e9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ec553e9bf9c76a7cea191869cbe6abc2b1f05489))
* update contributors ([c1bd368](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/c1bd36858d7f664a8a54e39d8cecb377c31b2c21))
* update contributors ([83095cb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/83095cb23533c5b224849c0e7fced7bf6ee571c3))
* update contributors ([5a2ee18](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5a2ee18b2ce0d3d9a5f58f4df4ef30ed6511ad60))
* update contributors ([9102b0d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9102b0dd3b1a649421c3410d2e5c9bbe80fb85f8))
* update contributors ([d18692b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/d18692bd04d35625eab696a2e4341cb7d95f8e6a))
* update contributors ([63049d8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/63049d89054baac9ec19fb5e5d1812b9fe0c324d))
* update contributors ([9e50a35](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9e50a3507575d51535f3d222d5077ccc4c3fa715))
* update contributors ([e526fe7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e526fe727cbf551e5317fb86fddd30b5587e52f8))
* update contributors ([64f82ca](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/64f82ca792d169a8144e1838a4d6a4fd1882d819))
* update dependencies ([7a44b66](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7a44b6675c370d2642035cc0d5990f502947468b))
* update dependencies ([5ea7f23](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5ea7f233aa470a58824f7645ce7fa0c9f064d3d4))
* update deps ([660b054](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/660b0542e4f3ca708221579fed42067f39d0d000))
* update deps ([#155](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/155)) ([df69a90](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/df69a909db2a770f5a7d054a898bab72020946df))
* update deps and remove protons ([#153](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/153)) ([41232f5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/41232f5a250740109672e3bc6a764f6d288272e3))
* update deps with uintarrays ([590b7e4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/590b7e4475a7ce76ef3152c843b05762a9f51956))
* update expectSet util function ([f45e488](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f45e488c44439b60c7dd1833ad9bcab854b4120f))
* update floodsub ([3afa40d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3afa40dd49a489fa2485fcc416e468835c606df6))
* update function comments ([26518a3](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/26518a3967bd1877577ff35b9f5c8850f98e3240))
* update getGossipPeers ([b582120](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b582120988a17d225960eed5249667d13057a24b))
* update gossipsub multicodec ([ffa2ad3](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ffa2ad3e3d027570e5f2fd8741f0acf5f46b2f17))
* update incorrect test comments ([a544049](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a5440495488cc45e59bb9a6434e3fb20435a8487))
* update interfaces ([1ec595c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1ec595cc577477232af7885f0aa6aee4bf45ce0e))
* update it-length-prefixed dep ([eaab883](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/eaab883efa5d7146140f4ad05020328bdb0d28b1))
* update js-libp2p-interfaces ([#145](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/145)) ([105f2a6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/105f2a67fdd4d85e7e40a0037408fdc8a7f03298))
* update js-libp2p-interfaces ([#145](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/145)) ([4af4363](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4af436333dd4ec95aad05419edcb65ecba309ee6))
* update libp2p dep ([#137](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/137)) ([8bb962d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8bb962dee91404a28c64e5272f400a096af7bc14))
* update libp2p-pubsub ([c758f8f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/c758f8f9b015bbff47045787a1b4273dee160044))
* update libp2p-pubsub dependency ([005cdba](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/005cdba7001cb7e557aeca8df71922f93c06d631))
* update peer-id ([#173](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/173)) ([e61668e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e61668e6a11be3b633815960015124fb89f82f53))
* update pubsub ([3de6f46](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3de6f462004fc2c3bf5bc9964473c0915d6dd85d))
* update pubsub interface to run subsystem tests ([#148](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/148)) ([8cfe546](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8cfe54688908d41961168b76c97fa64030bd3821))
* update pubsub interface to run subsystem tests ([#148](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/148)) ([5356be5](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5356be58aebf806bf70ca5178c8a3c55ccf7bfcf))
* update pubsub super signature ([bc67d4c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bc67d4c89c402364d16880a5a29b11edfb81070e))
* update readme usage ([#135](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/135)) ([f37ac83](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/f37ac832073c1c1b6a37fc2a48641225e8c1c0bb))
* update to new libp2p interface with types ([#146](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/146)) ([9ff2e65](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9ff2e656ecb2aca872efd80b638d411723c426eb))
* update ts/messageCache.ts ([e171315](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e171315354af0ed726a172a80131207d93178b0e))
* update uint8arrays ([970f530](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/970f5303817223c1e27d6245b86e103059fafdab))
* use delay ([7c7893e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7c7893ee398bbd69f780abf5e766b254b43504b3))
* use latest libp2p release ([43be666](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/43be666311c8972f509063513f6fc60a9002e647))
* use libp2p-interfaces0.5.1 and libp2p0.29 rc ([#130](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/130)) ([27010d6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/27010d61dce107ce224898d59d3be2f543abf310))
* use libp2p@0.29 branch ([ed45aad](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ed45aaddee61a14d60384088c46d4d13f5f199d4))
* use libp2p#feat/certified-addressbook ([1b840ea](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1b840eaeb19f3bd853771ed09313a50f598d935c))
* use new version of pubsub pr ([5e45409](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5e45409423fc94528ffe778fdab711fa53fe3c26))
* use publish threshold for floodsub peers ([a6d30f0](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a6d30f09d1cd04fb66531e6642b698a614ebaa1a))
* use pubsub interface ([59beb2f](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/59beb2f25cf1ee13b9d419b89f84da558e43b803))
* use refactored base implementation ([eacd7ac](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/eacd7ac5aa2b6ca2d6233f4365748caae9d6cdcf))
* use topology interface ([5b7e14a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5b7e14a264ec9d6804affb0da380cc400979dfbb))

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

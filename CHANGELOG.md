## [1.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v0.14.0...v1.0.0) (2022-05-10)


### ⚠ BREAKING CHANGES

* the output of this module is now ESM-only by @achingbrain in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/236
* Tiddy Gossipsub API and comments by @dapplion in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/227

### Bug Fixes

* Fix rpc.control metrics and reduce object creation by @dapplion in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/230
* Remove duplicate record of msgReceivedPreValidation metric by @tuyennhv in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/228

### Miscellaneous
* chore: update cd action by @mpetrunic in https://github.com/ChainSafe/js-libp2p-gossipsub/pull/245


## [11.2.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v11.2.0...v11.2.1) (2024-02-05)


### Bug Fixes

* remove abortable iterator ([#488](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/488)) ([e39b2e2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e39b2e2910571eba03c1ba2f84a087e4903858c9))

## [11.2.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v11.1.0...v11.2.0) (2024-01-30)


### Features

* add runOnTransientConnection option to pass to registrar ([#485](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/485)) ([986ff6c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/986ff6c420026654179bc398ba139c87a2277ea7))


### Bug Fixes

* write peer stream messages atomically ([#484](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/484)) ([cc4ff3b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cc4ff3bfa4f09b9a1b4bfedd20468dc2c06be895))

## [11.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v11.0.1...v11.1.0) (2024-01-08)


### Features

* batch publish ([#480](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/480)) ([c11b924](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/c11b924f9df02e150b884f01200206f48dc7a666))
* type safe metric labels ([#479](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/479)) ([67c2a55](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/67c2a55fb523988c9e130a29b86051347a14ebda))

## [11.0.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v11.0.0...v11.0.1) (2023-12-05)


### Bug Fixes

* make peer score use component logger ([#476](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/476)) ([dba38d1](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/dba38d1d5093bac32d4c5c37a35699b09131e762))

## [11.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v10.1.1...v11.0.0) (2023-12-03)


### ⚠ BREAKING CHANGES

* requires libp2p v1

### Bug Fixes

* update to libp2p v1 deps ([#473](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/473)) ([01f46d8](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/01f46d88b0f073721ab2bf481e9878fbcce02084))

## [10.1.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v10.1.0...v10.1.1) (2023-11-21)


### Bug Fixes

* runsFactor in benchmark ([#467](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/467)) ([aa208c2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/aa208c2f6bad1c4c0b03cf48e6c76078c272bff9))
* use typed event emitter class ([#470](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/470)) ([3af4e7a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3af4e7aec8e295ae3132e2ff3f79cca458fecd5d))


### Miscellaneous

* update linter rules ([#471](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/471)) ([a39115c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a39115c1b38da45e20ff4d8643675e26dd82e63f))

## [10.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v10.0.0...v10.1.0) (2023-08-22)


### Features

* unbundle fixed-label metrics ([bb5596d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bb5596dca786e59d930ed58b6dc05c80925786b2))
* unbundle fixed-label metrics ([#460](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/460)) ([bb5596d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bb5596dca786e59d930ed58b6dc05c80925786b2))


### Bug Fixes

* export supporting metrics types ([#462](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/462)) ([09296bd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/09296bd915839b6bbbffcf7ea31be64ba3f4bc20))
* revise onPrevalidationResult metrics ([#464](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/464)) ([e51f248](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e51f248b621b600b34741b452601a5a80a3b5ebd))

## [10.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v9.1.0...v10.0.0) (2023-08-03)


### ⚠ BREAKING CHANGES

* stream close methods are now asyc, requires libp2p@0.46.x or later

### Features

* close streams gracefully ([#458](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/458)) ([3153ebf](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3153ebff847cdfa560a094e1cd6b559090a24614))
* track time to publish a message ([#451](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/451)) ([83b8e61](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/83b8e61e700f45743940e33b8ca2c28c1e18a1d5))


### Bug Fixes

* track publish time in second ([#457](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/457)) ([7c3fc8d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7c3fc8d2aa47070434a87d576c10d5aaeb047277))

## [9.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v9.0.0...v9.1.0) (2023-06-29)


### Features

* add UnsubscribeBackoff param ([#447](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/447)) ([ec570ca](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ec570cadb2ea4e327f204038c85b86ccc7555802))


### Bug Fixes

* check backoff when join ([#444](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/444)) ([fd8c61b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/fd8c61b18d6deccb19a375c913dfe3dec9a0dfeb))
* correct metric in handlePrune() ([#440](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/440)) ([cbdae04](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cbdae0463868673de9ae59b7a357aedfeb085e0a))


### Miscellaneous

* track backoff time for connected peers ([#445](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/445)) ([8646b4d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8646b4d3c1255474cb86478eca4279dd18f11580))

## [9.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v8.0.1...v9.0.0) (2023-06-20)


### ⚠ BREAKING CHANGES

* reportMessageValidationResult to accept peer id string ([#432](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/432))

### Features

* track async validation delay from first seen ([#435](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/435)) ([e2505d6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e2505d668ac9b34e8889562d975ed71ec1866b33))


### Bug Fixes

* reportMessageValidationResult to accept peer id string ([a963680](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a963680fd9fb1da55e28e15c8e5469b9fe7dfbfa))
* reportMessageValidationResult to accept peer id string ([#432](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/432)) ([a963680](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a963680fd9fb1da55e28e15c8e5469b9fe7dfbfa))

## [8.0.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v8.0.0...v8.0.1) (2023-06-15)


### Bug Fixes

* unbundle 2-label metrics ([#433](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/433)) ([1e33bb2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/1e33bb279d28126d369eb0aea7978dca79a48f4b))
* unhandle protocol on stop ([#438](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/438)) ([549641b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/549641bf4a728709119509252a6a19ff0cd42b8c))

## [8.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v7.0.0...v8.0.0) (2023-05-16)


### ⚠ BREAKING CHANGES

* update peerstore and releated deps for libp2p@0.45 compat ([#425](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/425))

### Bug Fixes

* update peerstore and releated deps for libp2p@0.45 compat ([#425](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/425)) ([b6225d6](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b6225d62fa3f372acee31f3ad71579693e0fcdbe))


### Miscellaneous

* Update README.md usage example ([#429](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/429)) ([9bd5a3c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/9bd5a3c2f7324a3332c537bfb6bbd26d518d7503))

## [7.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v6.3.0...v7.0.0) (2023-04-20)


### ⚠ BREAKING CHANGES

* the type of the source/sink properties have changed

### Bug Fixes

* update stream types ([#423](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/423)) ([6761c6e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6761c6e66b294ed3cb5eb9e8e364f335c7f5f1ef))

## [6.3.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v6.2.0...v6.3.0) (2023-04-13)


### Features

* make log as protected ([#407](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/407)) ([5b3aee9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5b3aee94c90dcd0e42266b5413c0349674cf309c))


### Bug Fixes

* add rpc error metrics ([#412](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/412)) ([5cd8b07](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5cd8b0737a2ef40d9a093977e19240ae6d93b951))
* add types to exports in packages.json ([#419](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/419)) ([100592a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/100592a019c38ff5e0ab5db596feb7fa6ae4923c))
* track promise only after a successful sendRpc() ([#415](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/415)) ([a959b09](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/a959b096c0e78d8754b5a9726e11e055d8685ef0))


### Miscellaneous

* **deps:** bump @libp2p/interface-connection to 4.0.0 ([#421](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/421)) ([50a99c7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/50a99c74bdb0e02a4bece21a9878590cb5da9042))
* **deps:** bump xml2js, @azure/ms-rest-js, @azure/storage-blob and aws-sdk ([#420](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/420)) ([2a2e9fa](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/2a2e9faec7565e0e1fdc6ef4bbcd9f89024c72f8))
* remove lead maintainer ([#422](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/422)) ([38d5d65](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/38d5d657a3d975c6ad72c6822ce4281ea0f1b0d0))

## [6.2.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v6.1.0...v6.2.0) (2023-02-21)


### Features

* allow ignoring PublishError.Duplicate ([#404](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/404)) ([dcde3c9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/dcde3c97ee9eee8c8f1c9c496a5232ea43b21d37))


### Miscellaneous

* **deps:** bump http-cache-semantics from 4.1.0 to 4.1.1 ([#400](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/400)) ([bae1492](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/bae14929fe93db8b5e6f24271f5b6c1c900532cb))

## [6.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v6.0.0...v6.1.0) (2023-01-19)


### Features

* added allowPublishToZeroPeers as optional param to publish function ([#395](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/395)) ([e7c88ac](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e7c88acb83d6b7f25f38074f37668e17860dd518))


### Bug Fixes

* ignore new closed connection ([#399](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/399)) ([20d54f4](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/20d54f4d3cad5732859e4594f3bc54cc0b7278dd))


### Miscellaneous

* replace err-code with CodeError ([#397](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/397)) ([4842680](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/484268005aec682bb8104d6f617a4bab5d8be82a))

## [6.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.4.1...v6.0.0) (2023-01-09)


### ⚠ BREAKING CHANGES

* update multiformats and related dependencies ([#393](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/393))

### Bug Fixes

* fix browser tests ([dcece33](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/dcece3315c5dab018f069963f93902dcc25a8c15))
* update multiformats and related dependencies ([#393](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/393)) ([2090501](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/209050194e765a600e8e479bf0ee573ee6e9028d))


### Miscellaneous

* update readme code example to new API. ([#382](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/382)) ([b24d1ff](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/b24d1ff75845dc5308df2f00ee5110d0aeefbe6c))

## [5.4.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.4.0...v5.4.1) (2022-12-23)


### Bug Fixes

* remove change:multiaddrs listener ([#387](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/387)) ([ad1e6ce](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ad1e6cee2df68141a263ff16c64240a89961b9ab))

## [5.4.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.3.0...v5.4.0) (2022-12-22)


### Features

* track pruned messages in tracer ([#384](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/384)) ([dbeb879](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/dbeb8792a380c172f6aade3ab01e6c90140375e5))


### Bug Fixes

* tracer to track delivered message if duplicate ([#385](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/385)) ([0c8ddee](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0c8ddee13a94b44f182ea685cdddc6b7cee43ec4))

## [5.3.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.2.1...v5.3.0) (2022-12-01)


### Features

* add `src` folder to package to enable access to source map ([#337](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/337)) ([7a20b0c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7a20b0ca7b0c01c791c71ee89fffdd436bc1dfc2))


### Bug Fixes

* sync leave() function ([#378](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/378)) ([ac7fd52](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ac7fd52c04b9a7f07106221341a765523007c91c))

## [5.2.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.2.0...v5.2.1) (2022-11-15)


### Bug Fixes

* unbound event listener ([#374](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/374)) ([087a66a](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/087a66aa13a430c973dfeb74735f38b1d3133363))

## [5.2.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.1.1...v5.2.0) (2022-11-13)


### Features

* remove unnecessary conversion from Multiaddr to IP ([#369](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/369)) ([e37c7c2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/e37c7c2e7872284093eabc765a4ddafb9e56f690))

## [5.1.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.1.0...v5.1.1) (2022-11-03)


### Bug Fixes

* add .js extension to imported file ([#370](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/370)) ([129b9cd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/129b9cdc26bb5fca02c717d9c1c599536a3f64a4))

## [5.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v5.0.0...v5.1.0) (2022-10-28)


### Features

* Add stream option to limit inbound message size ([#349](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/349)) ([3475242](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/3475242ed254f7647798ab7f36b21909f6cb61da))


### Bug Fixes

* mark import as type ([#365](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/365)) ([19507d9](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/19507d9da5e11702182cfc97300642c5fb78f964))

## [5.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v4.2.0...v5.0.0) (2022-10-22)


### Bug Fixes

* TimeCache handle key collision to prevent leak ([#358](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/358)) ([8f0ba37](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8f0ba37a73560f3ffd12567603720564d7c2862a))


### Miscellaneous

* bump version ([#364](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/364)) ([7a8ff3e](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/7a8ff3ecb796eab0304aaff031f1defacc1ee0fe))
* release 5.0.0 ([d13c44d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/d13c44d827fb206a6bac5e003da27c61ac849362))

## [4.2.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v4.1.1...v4.2.0) (2022-10-18)


### Features

* allow only defined list of topics ([#348](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/348)) ([6b5ff4d](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/6b5ff4d3e40139b2a6cf8cbf670564c9d1b91090))
* limit RPC lists on decode ([#352](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/352)) ([8fbcb4c](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/8fbcb4cab0157631641d5281daf9cefe69eb18ec))
* support FastMsgIdFn returning a number ([#355](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/355)) ([4df9677](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4df9677fbc4c54bf189a874ec7a93dd483c4c9fe))
* track mcache not validated count ([#351](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/351)) ([27bdee7](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/27bdee7b99f3a605d8d7a8983887d692a5185ea1))


### Bug Fixes

* copy js files to dist manually ([#340](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/340)) ([4c73e81](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/4c73e81c4b441149f4858aad7beccdd76ad27959))
* flip conditional in piggyback control - typo from [#347](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/347) ([#353](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/353)) ([cad96c2](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/cad96c21322a788b19fb3aa37f7ffe34cbc7d09c))
* sendRpc in a for loop ([#347](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/347)) ([74cb495](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/74cb495a9f2171b5a08161880a6709013fbeb2c0))
* update @multiformats/multiaddr to 11.0.0 ([#339](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/339)) ([940dafc](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/940dafca97d142aeb026ba469fcd58887d256124))
* update event type to extend `{ [s: string]: any }` ([#336](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/336)) ([5c0db52](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/5c0db528a677c6c196b74222256ba032f1fe7d80))


### Miscellaneous

* commit package-lock.json ([#359](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/359)) ([eb1a145](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/eb1a145ee8d5fee8a18d87434fc8bcfb3b60f950))
* retry tests ([#354](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/354)) ([494ffbb](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/494ffbb534f9aa62e6b74d618e2378eae0e51c09))

## [4.1.1](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v4.1.0...v4.1.1) (2022-08-24)


### Bug Fixes

* catch errored push of rpc ([#334](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/334)) ([64cf477](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/64cf477fb2ff792a9ce1c2710eb80db82f5f1016))

## [4.1.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v4.0.0...v4.1.0) (2022-08-24)


### Features

* add option to limit OutboundStream buffer size ([#325](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/325)) ([ce9b671](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/ce9b671fd17b98b8ecc48ec61df6a503c181eaee))


### Bug Fixes

* skip heartbeat only if it's close to the next heartbeat ([#332](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/332)) ([0c6c42b](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/0c6c42bce0e6f0aa5fb2e7955d225197bd2b4f5e))

## [4.0.0](https://github.com/ChainSafe/js-libp2p-gossipsub/compare/v3.5.1...v4.0.0) (2022-08-11)


### ⚠ BREAKING CHANGES

* 

### Miscellaneous

* update dependencies ([#322](https://github.com/ChainSafe/js-libp2p-gossipsub/issues/322)) ([891c6fd](https://github.com/ChainSafe/js-libp2p-gossipsub/commit/891c6fddaaf5e5c62c293987ceea94e8014117ae))

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

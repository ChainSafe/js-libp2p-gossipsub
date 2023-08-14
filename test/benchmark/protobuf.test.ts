import { itBench, setBenchOpts } from '@dapplion/benchmark'
import { RPC } from '../../src/message/rpc.js'

describe('protobuf', function () {
  this.timeout(0)
  setBenchOpts({
    maxMs: 200 * 1000,
    minMs: 60 * 1000
  })

  const rpc: RPC = {
    subscriptions: [],
    messages: [
      {
        topic: 'topic1',
        // typical Attestation
        data: Buffer.from(
          'e40000000a000000000000000a00000000000000a45c8daa336e17a150300afd4c717313c84f291754c51a378f20958083c5fa070a00000000000000a45c8daa336e17a150300afd4c717313c84f291754c51a378f20958083c5fa070a00000000000000a45c8daa336e17a150300afd4c717313c84f291754c51a378f20958083c5fa0795d2ef8ae4e2b4d1e5b3d5ce47b518e3db2c8c4d082e4498805ac2a686c69f248761b78437db2927470c1e77ede9c18606110faacbcbe4f13052bde7f7eff6aab09edf7bc4929fda2230f943aba2c47b6f940d350cb20c76fad4a8d40e2f3f1f01',
          'hex'
        ),
        signature: Uint8Array.from(Array.from({ length: 96 }, () => 100))
      }
    ],
    control: undefined
  }

  const bytes = RPC.encode(rpc)

  const runsFactor = 100

  itBench({
    id: 'decode Attestation message using protons 5.1.0',
    fn: () => {
      for (let i = 0; i < runsFactor; i++) {
        RPC.decode(bytes)
      }
    },
    runsFactor: 100
  })

  itBench({
    id: 'encode Attestation message using protons 5.1.0',
    fn: () => {
      for (let i = 0; i < runsFactor; i++) {
        RPC.encode(rpc)
      }
    },
    runsFactor: 100
  })
})

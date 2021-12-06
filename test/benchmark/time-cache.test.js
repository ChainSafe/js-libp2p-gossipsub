const {itBench, setBenchOpts} = require("@dapplion/benchmark");
const TimeCache = require('time-cache')
const {SimpleTimeCache} = require("../../src/utils/time-cache");

describe("npm TimeCache vs SimpleTimeCache", () => {
  setBenchOpts({
    maxMs: 100 * 1000,
    minMs: 60 * 1000,
    runs: 512,
  });

  const iterations = [1_000_000, 4_000_000, 8_000_000, 16_000_000];
  const timeCache = new TimeCache({ validity: 1 });
  const simpleTimeCache = new SimpleTimeCache({ validityMs: 1000 });

  for (const iteration of iterations) {
    itBench(
      {
        id: `npm TimeCache.put ${iteration} times`,
      },
      () => {
        for (let j = 0; j < iteration; j++) timeCache.put(String(j));
      }
    );

    itBench(
      {
        id: `SimpleTimeCache.put ${iteration} times`,
      },
      () => {
        for (let j = 0; j < iteration; j++) simpleTimeCache.put(String(j));
      }
    );
  }

});

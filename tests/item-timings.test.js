import assert from "node:assert/strict";
import test from "node:test";
import { buildItemTimingBenchmarks } from "../server/item-timings.js";

test("builds per-item median purchase timings and win rates from parsed matches", () => {
  const result = buildItemTimingBenchmarks([
    { result: "WIN", purchaseLog: [{ id: 1, name: "Blink", time: 300 }, { id: 1, time: 200 }, { id: 2, name: "Boots", time: 100 }] },
    { result: "WIN", purchaseLog: [{ id: 1, name: "Blink", time: 400 }] },
    { result: "LOSS", purchaseLog: [{ id: 1, name: "Blink", time: 600 }] },
    { result: "LOSS", purchaseLog: null },
    { result: "UNRANKED", purchaseLog: [{ id: 3, name: "Invalid", time: 1 }] },
  ]);

  assert.equal(result.sampleMatches, 3);
  assert.equal(result.wins, 2);
  assert.equal(result.losses, 1);
  assert.deepEqual(result.items[0], {
    id: 1,
    name: "Blink",
    image: null,
    win: { medianSeconds: 300, samples: 2, matchRate: 100 },
    loss: { medianSeconds: 600, samples: 1, matchRate: 100 },
  });
});

test("does not fabricate item timing benchmarks when matches lack parsed purchase logs", () => {
  assert.deepEqual(buildItemTimingBenchmarks([
    { result: "WIN", purchaseLog: null },
    { result: "LOSS", purchaseLog: undefined },
  ]), { sampleMatches: 0, wins: 0, losses: 0, items: [] });
});

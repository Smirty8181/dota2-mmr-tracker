import assert from "node:assert/strict";
import test from "node:test";
import { serializeRankedStats } from "../server/player-stats.js";

test("uses the full ranked sample and leaves unknown averages null", () => {
  assert.deepEqual(
    serializeRankedStats({ matches: 240, wins: 132, averageGpm: 512.4, averageXpm: 601.6 }),
    {
      matches: 240,
      totalMatches: 240,
      wins: 132,
      losses: 108,
      winRate: 55,
      averageGpm: 512,
      averageXpm: 602,
    },
  );
});

test("does not report a zero win rate when no ranked matches exist", () => {
  assert.deepEqual(
    serializeRankedStats({ matches: 0, wins: 0, averageGpm: null, averageXpm: null }),
    {
      matches: 0,
      totalMatches: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      averageGpm: null,
      averageXpm: null,
    },
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildComparisonSnapshot } from "../server/comparison.js";

test("builds a comparison from only valid ranked matches without inventing metrics", () => {
  const profile = {
    profile: { account_id: 123, personaname: "Example", avatarfull: "https://example.test/avatar.png" },
    rank_tier: 44,
    leaderboard_rank: 900,
  };
  const matches = [
    {
      lobby_type: 7, radiant_win: true, player_slot: 0, start_time: 1_800_000_000,
      hero_id: 1, kills: 8, deaths: 2, assists: 10, gold_per_min: 500,
    },
    {
      lobby_type: 7, radiant_win: true, player_slot: 128, start_time: 1_800_000_060,
      hero_id: 2, kills: 2, deaths: 8, assists: 4, gold_per_min: 300, xp_per_min: 400,
    },
    { lobby_type: 0, radiant_win: true, player_slot: 0, start_time: 1_800_000_120 },
    { lobby_type: 7, radiant_win: null, player_slot: 0, start_time: 1_800_000_180 },
  ];

  const snapshot = buildComparisonSnapshot(profile, matches, new Date(1_800_000_200_000));

  assert.equal(snapshot.accountId, "123");
  assert.equal(snapshot.name, "Example");
  assert.equal(snapshot.rankTier, 44);
  assert.equal(snapshot.sampleLimit, 100);
  assert.equal(snapshot.analysis.matches, 2);
  assert.equal(snapshot.analysis.wins, 1);
  assert.equal(snapshot.analysis.losses, 1);
  assert.equal(snapshot.analysis.winRate, 50);
  assert.equal(snapshot.analysis.averageGpm.value, 400);
  assert.equal(snapshot.analysis.averageGpm.sample, 2);
  assert.equal(snapshot.analysis.averageXpm.value, 400);
  assert.equal(snapshot.analysis.averageXpm.sample, 1);
  assert.equal(snapshot.analysis.averageDenies.value, null);
});

test("rejects missing profile identity or invalid match collections", () => {
  assert.throws(() => buildComparisonSnapshot({}, []), TypeError);
  assert.throws(() => buildComparisonSnapshot({ profile: { account_id: 1 } }, null), TypeError);
});

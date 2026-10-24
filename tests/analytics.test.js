import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRankedMatches } from "../server/analytics.js";

const match = (overrides) => ({
  isRanked: true,
  result: "WIN",
  playedAt: new Date("2026-10-24T00:00:00.000Z"),
  kills: 4,
  deaths: 2,
  assists: 6,
  duration: 1800,
  gpm: 500,
  xpm: 600,
  lastHits: 250,
  denies: 8,
  mmrChange: 25,
  heroId: 1,
  ...overrides,
});

test("summarizes ranked matches, streaks, and hero usage from the full sample", () => {
  const matches = [
    match({ matchId: "3", result: "WIN", playedAt: "2026-10-24T00:00:00.000Z" }),
    match({ matchId: "2", result: "WIN", playedAt: "2026-10-23T00:00:00.000Z", heroId: 2 }),
    match({ matchId: "1", result: "LOSS", playedAt: "2026-10-22T00:00:00.000Z", mmrChange: -25 }),
    match({ matchId: "unranked", isRanked: false }),
  ];

  const analytics = analyzeRankedMatches(matches, new Date("2026-10-24T12:00:00.000Z"));

  assert.equal(analytics.overall.matches, 3);
  assert.equal(analytics.overall.wins, 2);
  assert.equal(analytics.overall.losses, 1);
  assert.equal(analytics.overall.winRate, 67);
  assert.equal(analytics.overall.averageKda, 5);
  assert.equal(analytics.overall.averageGpm.value, 500);
  assert.equal(analytics.overall.averageGpm.sample, 3);
  assert.equal(analytics.overall.averageKills.value, 4);
  assert.equal(analytics.overall.averageDuration.value, 1800);
  assert.equal(analytics.overall.averageDuration.sample, 3);
  assert.equal(analytics.overall.mmrDelta, 25);
  assert.deepEqual(analytics.recent.currentStreak, { result: "WIN", matches: 2 });
  assert.equal(analytics.recent.longestWinStreak, 2);
  assert.deepEqual(analytics.heroes.map(({ heroId, matches: games }) => [heroId, games]), [[1, 2], [2, 1]]);
  assert.equal(analytics.heroes[0].averageKda, 5);
  assert.equal(analytics.heroes[0].averageKills.value, 4);
  assert.equal(analytics.periods["7d"].heroes[0].heroId, 1);
  assert.equal(analytics.lastSevenDays.matches, 3);
  assert.equal(analytics.weeklyActivity.length, 7);
  assert.deepEqual(analytics.weeklyActivity.at(-1), { date: "2026-10-24", matches: 1, wins: 1, losses: 0 });
});

test("keeps unavailable values null and ignores invalid match records", () => {
  const analytics = analyzeRankedMatches([
    match({ kills: null, deaths: null, assists: null, duration: null, gpm: null, xpm: null, lastHits: null, denies: null }),
    { ...match({ result: "UNKNOWN" }) },
    { ...match({ playedAt: "not-a-date" }) },
  ], new Date("2026-10-24T12:00:00.000Z"));

  assert.equal(analytics.overall.matches, 1);
  assert.equal(analytics.overall.winRate, 100);
  assert.equal(analytics.overall.averageKda, null);
  assert.equal(analytics.overall.kdaSample, 0);
  assert.deepEqual(analytics.overall.averageGpm, { value: null, sample: 0 });
  assert.deepEqual(analytics.overall.averageKills, { value: null, sample: 0 });
  assert.deepEqual(analytics.overall.averageDuration, { value: null, sample: 0 });
  assert.equal(analytics.recent.previousWindow, null);
});

test("does not present unknown historical MMR changes as zero", () => {
  const analytics = analyzeRankedMatches([
    match({ mmrChange: null }),
    match({ mmrChange: 25 }),
  ], new Date("2026-10-24T12:00:00.000Z"));

  assert.equal(analytics.overall.mmrDelta, 25);
  assert.equal(analytics.overall.mmrDeltaSample, 1);
  assert.equal(analyzeRankedMatches([match({ mmrChange: null })]).overall.mmrDelta, null);
});

test("returns explicit empty states instead of zero-rate claims", () => {
  const analytics = analyzeRankedMatches([], new Date("2026-10-24T12:00:00.000Z"));
  assert.equal(analytics.overall.matches, 0);
  assert.equal(analytics.overall.winRate, null);
  assert.equal(analytics.recent.currentStreak, null);
  assert.equal(analytics.lastSevenDays.averageXpm.value, null);
  assert.deepEqual(analytics.heroes, []);
});

test("does not truncate a current streak at the recent-form window size", () => {
  const matches = Array.from({ length: 12 }, (_, index) =>
    match({ playedAt: new Date(Date.UTC(2026, 9, 24 - index)), result: "LOSS" }),
  );
  const analytics = analyzeRankedMatches(matches, new Date("2026-10-24T12:00:00.000Z"));
  assert.equal(analytics.recent.window, 10);
  assert.deepEqual(analytics.recent.currentStreak, { result: "LOSS", matches: 12 });
});

test("compares exact rolling periods with the immediately preceding equal window", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");
  const analytics = analyzeRankedMatches([
    match({ matchId: "current-edge", playedAt: "2026-10-17T12:00:00.000Z", result: "WIN" }),
    match({ matchId: "previous-edge", playedAt: "2026-10-10T12:00:00.000Z", result: "LOSS" }),
    match({ matchId: "previous-end", playedAt: "2026-10-17T11:59:59.999Z", result: "WIN" }),
    match({ matchId: "future", playedAt: "2026-10-24T12:00:00.001Z", result: "WIN" }),
  ], now);

  assert.equal(analytics.periods["7d"].current.matches, 1);
  assert.equal(analytics.periods["7d"].current.winRate, 100);
  assert.equal(analytics.periods["7d"].previous.matches, 2);
  assert.equal(analytics.periods["7d"].previous.winRate, 50);
  assert.equal(analytics.periods["30d"].current.matches, 3);
  assert.equal(analytics.periods.all.current.matches, 4);
  assert.equal(analytics.periods.all.previous, null);
});

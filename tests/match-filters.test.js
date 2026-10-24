import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortMatches } from "../shared/match-filters.js";

const matches = [
  { matchId: "new-win", hero: "Axe", result: "Победа", playedAt: "2026-10-24T12:00:00.000Z", duration: 1800 },
  { matchId: "old-loss", hero: "Lina", result: "Поражение", playedAt: "2026-09-01T12:00:00.000Z", duration: 2800 },
  { matchId: "mid-win", hero: "Lina", result: "Победа", playedAt: "2026-10-20T12:00:00.000Z", duration: 2700 },
];

test("filters match history by result, hero, date period, and duration", () => {
  const result = filterAndSortMatches(matches, {
    result: "win",
    hero: "Lina",
    periodDays: 7,
    duration: "medium",
    now: Date.parse("2026-10-24T13:00:00.000Z"),
  });

  assert.deepEqual(result.map(({ item }) => item.matchId), ["mid-win"]);
});

test("search and sort preserve the original match selection indexes", () => {
  const result = filterAndSortMatches(matches, {
    query: "lina",
    sortOrder: "oldest",
  });

  assert.deepEqual(result.map(({ item, index }) => [item.matchId, index]), [
    ["old-loss", 1],
    ["mid-win", 2],
  ]);
});

test("duration sorting puts unavailable durations last without changing input", () => {
  const rows = [matches[0], { matchId: "unknown", hero: "Puck", duration: null }];
  const result = filterAndSortMatches(rows, { sortOrder: "longest" });

  assert.deepEqual(result.map(({ item }) => item.matchId), ["new-win", "unknown"]);
  assert.deepEqual(rows.map(({ matchId }) => matchId), ["new-win", "unknown"]);
});

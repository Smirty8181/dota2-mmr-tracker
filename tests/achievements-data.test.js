import assert from "node:assert/strict";
import test from "node:test";
import { buildAchievementProgress } from "../src/components/achievements-data.js";

test("unlocks milestones only when supported by ranked match and MMR data", () => {
  const achievements = buildAchievementProgress({
    totalRankedMatches: 100,
    startingMmr: 2500,
    personalBestMmr: 2600,
    matches: [{ result: "Победа" }, { result: "Победа" }, { result: "Победа" }],
  });

  assert.deepEqual(
    achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id),
    ["first-ranked-match", "ten-ranked-matches", "hundred-ranked-matches", "personal-best", "three-win-streak"],
  );
  assert.equal(achievements.find((achievement) => achievement.id === "personal-best").current, 2600);
});

test("keeps unknown match counts and uninitialized MMR as unavailable", () => {
  const achievements = buildAchievementProgress({
    totalRankedMatches: null,
    startingMmr: null,
    personalBestMmr: null,
    matches: [{ result: "Победа" }, { result: "Поражение" }, { result: "Победа" }],
  });

  assert.equal(achievements[0].current, null);
  assert.equal(achievements[0].unlocked, false);
  assert.equal(achievements.find((achievement) => achievement.id === "personal-best").current, null);
  assert.equal(achievements.find((achievement) => achievement.id === "three-win-streak").current, 1);
});

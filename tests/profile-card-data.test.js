import assert from "node:assert/strict";
import test from "node:test";
import { calculateCardAchievements, calculateCardMetrics } from "../src/components/profile-card-data.js";

test("calculates KDA from available matches and excludes unknown fields", () => {
  const metrics = calculateCardMetrics(
    { winRate: 58, totalMatches: 20 },
    [
      { kills: 7, deaths: 2, assists: 9 },
      { kills: 3, deaths: 4, assists: 5 },
      { kills: null, deaths: 0, assists: 1 },
    ],
    3200,
    3400,
  );

  assert.equal(metrics[0].value.replace(/\s/g, ""), "3200MMR");
  assert.equal(metrics[1].value, "58%");
  assert.equal(metrics[2].value, "4.00");
  assert.equal(metrics[2].sample, 2);
  assert.equal(metrics[3].value, "20");
  assert.match(metrics[4].value, /^3\s400 MMR$/);
});

test("only reports achievements supported by saved player and match data", () => {
  const achievements = calculateCardAchievements(
    { totalMatches: 120 },
    [{ result: "Победа" }, { result: "Победа" }, { result: "Победа" }],
    2500,
    3000,
  );
  assert.equal(achievements.some((label) => label.startsWith("Первый матч")), true);
  assert.equal(achievements.some((label) => label.includes("100 матчей")), true);
  assert.equal(achievements.some((label) => label.includes("Новый пик")), true);
  assert.equal(achievements.some((label) => label.startsWith("Серия побед")), true);
  assert.deepEqual(calculateCardAchievements(null, [], null, null), []);
});

test("leaves unavailable profile metrics empty instead of inventing values", () => {
  const metrics = calculateCardMetrics(null, [], null, null);
  assert.equal(metrics.every((metric) => metric.value === null), true);
});

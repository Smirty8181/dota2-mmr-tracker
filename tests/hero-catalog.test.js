import assert from "node:assert/strict";
import test from "node:test";
import {
  HERO_CATALOG,
  getHeroById,
  isCorrectHeroAnswer,
  resolveHeroAnswer,
} from "../shared/hero-catalog.js";

test("contains a complete catalog with unique stable IDs and official display names", () => {
  const ids = HERO_CATALOG.map((hero) => hero.id);
  const names = HERO_CATALOG.map((hero) => hero.displayName.toLocaleLowerCase("en"));

  assert.equal(HERO_CATALOG.length, 127);
  assert.equal(new Set(ids).size, HERO_CATALOG.length);
  assert.equal(new Set(names).size, HERO_CATALOG.length);
  for (const hero of HERO_CATALOG) {
    assert.ok(Number.isInteger(hero.id));
    assert.match(hero.apiName, /^npc_dota_hero_[a-z0-9_]+$/);
    assert.ok(hero.displayName.trim());
    assert.ok(Array.isArray(hero.aliases) && hero.aliases.includes(hero.displayName));
    if (hero.id === 135) {
      assert.equal(hero.portrait, hero.artwork);
    } else {
      assert.match(hero.portrait, /\/apps\/dota2\/images\/heroes\/[a-z0-9_]+_full\.png$/);
    }
    assert.match(hero.icon, /\/apps\/dota2\/images\/dota_react\/heroes\/icons\/[a-z0-9_]+\.png$/);
    assert.match(hero.artwork, /\/apps\/dota2\/images\/dota_react\/heroes\/[a-z0-9_]+\.png$/);
  }
});

test("uses official names while preserving nonstandard internal API names and IDs", () => {
  assert.deepEqual(
    [11, 21, 42, 76, 131].map((id) => {
      const hero = getHeroById(id);
      return [hero?.displayName, hero?.apiName];
    }),
    [
      ["Shadow Fiend", "npc_dota_hero_nevermore"],
      ["Windranger", "npc_dota_hero_windrunner"],
      ["Wraith King", "npc_dota_hero_skeleton_king"],
      ["Outworld Destroyer", "npc_dota_hero_obsidian_destroyer"],
      ["Ringmaster", "npc_dota_hero_ringmaster"],
    ],
  );
  assert.match(getHeroById(11).portrait, /nevermore_full\.png$/);
  assert.match(getHeroById(42).portrait, /skeleton_king_full\.png$/);
});

test("matches quiz responses by complete canonical names or verified aliases only", () => {
  assert.equal(resolveHeroAnswer("  shadow   fiend ")?.id, 11);
  assert.equal(resolveHeroAnswer("Nevermore")?.id, 11);
  assert.equal(resolveHeroAnswer("Outworld Devourer")?.id, 76);
  assert.equal(resolveHeroAnswer("Ring Master")?.id, 131);
  assert.equal(resolveHeroAnswer("Outworld"), null);
  assert.equal(resolveHeroAnswer("Shadow"), null);
  assert.equal(isCorrectHeroAnswer("anti mage", 1), true);
  assert.equal(isCorrectHeroAnswer("Axe", 1), false);
});

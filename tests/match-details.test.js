import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchBreakdown } from "../server/match-details.js";

test("builds team rosters, totals, item details, and match timelines from OpenDota data", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({
    account_id: 1000 + index,
    player_slot: index < 5 ? index : 128 + index - 5,
    personaname: `Player ${index + 1}`,
    hero_id: 1,
    level: 20 + index,
    kills: index,
    deaths: 2,
    assists: 5,
    gold_per_min: 400 + index,
    xp_per_min: 500 + index,
    last_hits: 200 + index,
    denies: 10,
    net_worth: 10_000 + index * 100,
    hero_damage: 20_000,
    tower_damage: 3_000,
    hero_healing: 100,
    lane_role: 2,
    item_0: 1,
    item_1: 0,
    backpack_0: 2,
    item_neutral: 3,
    obs_placed: 2,
    sen_placed: 1,
    purchase_log: [{ item_id: 4, time: 120 }, { item_id: 1, time: 60 }, { item_id: 0, time: 150 }],
    gold_t: index === 0 ? [100, 250, null, "300"] : [],
    lh_t: index === 0 ? [0, 10, 20] : [],
    xp_t: index === 0 ? [0, 200, 450] : [],
  }));
  const details = {
    players,
    radiant_team: { name: "Radiant Squad" },
    dire_team: { name: "Dire Squad" },
    radiant_win: true,
    radiant_score: 30,
    dire_score: 22,
    duration: 2400,
    radiant_gold_adv: [-100, 200],
    radiant_xp_adv: [-50, 150],
    start_time: 1_700_000_000,
    game_mode: 22,
    lobby_type: 7,
  };
  const items = {
    "1": { name: "Blink", image: "https://example.test/blink.png" },
    "2": { name: "Boots", image: "https://example.test/boots.png" },
    "3": { name: "Neutral item", image: "https://example.test/neutral.png" },
    "4": { name: "Magic Wand", image: "https://example.test/wand.png" },
  };

  const result = buildMatchBreakdown(details, "1000", items);

  assert.equal(result.teams.radiant.name, "Radiant Squad");
  assert.equal(result.teams.dire.name, "Dire Squad");
  assert.equal(result.teams.radiant.members.length, 5);
  assert.equal(result.teams.dire.members.length, 5);
  assert.equal(result.teams.radiant.netWorth, 51_000);
  assert.equal(result.teams.dire.netWorth, 53_500);
  assert.deepEqual(result.teams.radiant.members[0].inventory[0], {
    id: 1,
    name: "Blink",
    image: "https://example.test/blink.png",
  });
  assert.equal(result.teams.radiant.members[0].purchaseLog[0].name, "Blink");
  assert.equal(result.teams.radiant.members[0].purchaseLog[0].time, 60);
  assert.equal(result.teams.radiant.members[0].purchaseLog[1].name, "Magic Wand");
  assert.equal(result.teams.radiant.members[0].purchaseLog[1].time, 120);
  assert.deepEqual(result.timelines, { gold: [100, 250, null, null], lastHits: [0, 10, 20], xp: [0, 200, 450] });
  assert.equal(result.matchInfo.radiantWin, true);
  assert.deepEqual(result.matchInfo.radiantGoldAdvantage, [-100, 200]);
  assert.equal(result.selectedPlayer.netWorth, 10_000);
});

test("does not invent a full team net worth when player data is missing", () => {
  const players = [
    { player_slot: 0, account_id: 123, net_worth: 8000 },
    { player_slot: 128, account_id: 456, net_worth: 9000 },
  ];

  const result = buildMatchBreakdown({ players }, "123");

  assert.equal(result.teams.radiant.netWorth, null);
  assert.equal(result.teams.radiant.netWorthSampleCount, 1);
  assert.equal(result.teams.dire.netWorth, null);
  assert.equal(result.teams.dire.netWorthSampleCount, 1);
});

test("ignores invalid and duplicate player slots instead of corrupting team totals", () => {
  const players = [
    { player_slot: 0, account_id: 1, net_worth: 8000 },
    { player_slot: 0, account_id: 2, net_worth: 9000 },
    { player_slot: 5, account_id: 3, net_worth: 12000 },
    { player_slot: 127, account_id: 4, net_worth: 13000 },
    { player_slot: 128, account_id: 5, net_worth: 7000 },
    { player_slot: 133, account_id: 6, net_worth: 6000 },
  ];

  const result = buildMatchBreakdown({ players }, "1");

  assert.deepEqual(result.teams.radiant.members.map((player) => player.slot), [0]);
  assert.equal(result.teams.radiant.netWorth, null);
  assert.deepEqual(result.teams.dire.members.map((player) => player.slot), [128]);
  assert.equal(result.teams.dire.netWorth, null);
});

test("uses the stored match hero to build the selected player's timeline when account IDs are hidden", () => {
  const hiddenAccountPlayer = {
    account_id: null,
    player_slot: 2,
    hero_id: 6,
    gold_t: [100, 250],
    lh_t: [0, 12],
    xp_t: [0, 220],
    gold_per_min: 450,
    net_worth: 12_000,
  };
  const result = buildMatchBreakdown(
    { players: [hiddenAccountPlayer] },
    "12345",
    {},
    hiddenAccountPlayer,
  );

  assert.deepEqual(result.timelines, { gold: [100, 250], lastHits: [0, 12], xp: [0, 220] });
  assert.equal(result.selectedPlayer.netWorth, 12_000);
});

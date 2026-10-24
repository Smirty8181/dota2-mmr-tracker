import { getHeroIcon, getHeroName, getItemDetails, getLaneName } from "./opendota.js";

const integerOrNull = (value) => Number.isInteger(value) ? value : null;
const finiteNumbers = (values) => Array.isArray(values)
  ? values.map((value) => Number.isFinite(value) ? value : null)
  : [];

function serializeItem(itemId, itemConstants) {
  if (!Number.isInteger(itemId) || itemId <= 0) return null;
  return { id: itemId, ...getItemDetails(itemId, itemConstants) };
}

function serializePurchaseLog(entries, itemConstants) {
  return Array.isArray(entries)
    ? entries
      .filter((entry) => Number.isInteger(entry?.item_id) && Number.isFinite(entry?.time))
      .map((entry) => ({
        ...serializeItem(entry.item_id, itemConstants),
        time: entry.time,
      }))
      .filter((entry) => entry.id)
      .sort((first, second) => first.time - second.time)
    : [];
}

function serializePlayer(player, itemConstants, index) {
  if (!Number.isInteger(player.player_slot)) return null;
  const isRadiant = player.player_slot < 128;
  const inventory = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
    .map((itemId) => serializeItem(itemId, itemConstants))
    .filter(Boolean);
  const backpack = [player.backpack_0, player.backpack_1, player.backpack_2]
    .map((itemId) => serializeItem(itemId, itemConstants))
    .filter(Boolean);
  const neutralItem = serializeItem(player.item_neutral, itemConstants);

  return {
    slot: player.player_slot,
    side: isRadiant ? "radiant" : "dire",
    accountId: Number.isInteger(player.account_id) ? String(player.account_id) : null,
    name: typeof player.personaname === "string" && player.personaname.trim()
      ? player.personaname.trim()
      : `Игрок ${index + 1}`,
    avatar: typeof player.avatarfull === "string" ? player.avatarfull : null,
    heroId: integerOrNull(player.hero_id),
    hero: getHeroName(player.hero_id),
    heroIcon: getHeroIcon(player.hero_id),
    level: integerOrNull(player.level),
    kills: integerOrNull(player.kills),
    deaths: integerOrNull(player.deaths),
    assists: integerOrNull(player.assists),
    gpm: integerOrNull(player.gold_per_min),
    xpm: integerOrNull(player.xp_per_min),
    lastHits: integerOrNull(player.last_hits),
    denies: integerOrNull(player.denies),
    netWorth: integerOrNull(player.net_worth),
    heroDamage: integerOrNull(player.hero_damage),
    towerDamage: integerOrNull(player.tower_damage),
    heroHealing: integerOrNull(player.hero_healing),
    campsStacked: integerOrNull(player.camps_stacked),
    stuns: Number.isFinite(player.stuns) ? player.stuns : null,
    lane: getLaneName(player),
    wards: {
      observers: integerOrNull(player.obs_placed),
      sentries: integerOrNull(player.sen_placed),
    },
    inventory,
    backpack,
    neutralItem,
    purchaseLog: serializePurchaseLog(player.purchase_log, itemConstants),
  };
}

function serializeTeam(name, side, players) {
  const members = [];
  const seenSlots = new Set();
  players.forEach((player, index) => {
    const serialized = serializePlayer(player, side.itemConstants, index);
    const validSlot = side.key === "radiant"
      ? player.player_slot >= 0 && player.player_slot < 5
      : player.player_slot >= 128 && player.player_slot < 133;
    if (serialized?.side === side.key && validSlot && !seenSlots.has(player.player_slot) && members.length < 5) {
      members.push(serialized);
      seenSlots.add(player.player_slot);
    }
  });
  const netWorthValues = members.map((player) => player.netWorth);
  return {
    name: typeof name === "string" && name.trim() ? name.trim() : side.name,
    members,
    netWorth: members.length === 5 && netWorthValues.every(Number.isInteger)
      ? netWorthValues.reduce((total, value) => total + value, 0)
      : null,
    netWorthSampleCount: netWorthValues.filter(Number.isInteger).length,
  };
}

export function buildMatchBreakdown(details, accountId, itemConstants = {}, selectedPlayerOverride = null) {
  const players = Array.isArray(details.players) ? details.players : [];
  const radiant = serializeTeam(details.radiant_team?.name, {
    key: "radiant",
    name: "Сияние",
    itemConstants,
  }, players);
  const dire = serializeTeam(details.dire_team?.name, {
    key: "dire",
    name: "Тьма",
    itemConstants,
  }, players);
  const selectedPlayer = selectedPlayerOverride
    || players.find((player) => String(player.account_id) === accountId);
  const timelines = {
    gold: finiteNumbers(selectedPlayer?.gold_t),
    lastHits: finiteNumbers(selectedPlayer?.lh_t),
    xp: finiteNumbers(selectedPlayer?.xp_t),
  };

  return {
    teams: { radiant, dire },
    matchInfo: {
      radiantWin: typeof details.radiant_win === "boolean" ? details.radiant_win : null,
      radiantScore: integerOrNull(details.radiant_score),
      direScore: integerOrNull(details.dire_score),
      duration: integerOrNull(details.duration),
      radiantGoldAdvantage: finiteNumbers(details.radiant_gold_adv),
      radiantXpAdvantage: finiteNumbers(details.radiant_xp_adv),
      startTime: integerOrNull(details.start_time),
      gameMode: integerOrNull(details.game_mode),
      lobbyType: integerOrNull(details.lobby_type),
    },
    timelines,
    selectedPlayer: selectedPlayer ? {
      heroDamage: integerOrNull(selectedPlayer.hero_damage),
      towerDamage: integerOrNull(selectedPlayer.tower_damage),
      heroHealing: integerOrNull(selectedPlayer.hero_healing),
      campsStacked: integerOrNull(selectedPlayer.camps_stacked),
      stuns: Number.isFinite(selectedPlayer.stuns) ? selectedPlayer.stuns : null,
      denies: integerOrNull(selectedPlayer.denies),
      netWorth: integerOrNull(selectedPlayer.net_worth),
      purchaseLog: serializePurchaseLog(selectedPlayer.purchase_log, itemConstants),
    } : null,
  };
}

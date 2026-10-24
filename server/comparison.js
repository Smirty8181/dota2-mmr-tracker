import { analyzeRankedMatches } from "./analytics.js";

function getRankedResult(match) {
  if (typeof match?.radiant_win !== "boolean" || !Number.isInteger(match.player_slot)) return null;
  return (match.player_slot < 128) === match.radiant_win ? "WIN" : "LOSS";
}

export function buildComparisonSnapshot(profile, rows, now = new Date()) {
  const accountId = Number(profile?.profile?.account_id);
  if (!Number.isSafeInteger(accountId) || accountId < 1 || !Array.isArray(rows)) {
    throw new TypeError("Для сравнения нужны профиль OpenDota и список матчей.");
  }

  const rankedMatches = rows
    .filter((match) => match?.lobby_type === 7 && Number.isInteger(match.start_time))
    .map((match) => ({
      heroId: Number.isInteger(match.hero_id) ? match.hero_id : null,
      result: getRankedResult(match),
      isRanked: true,
      playedAt: new Date(match.start_time * 1000),
      kills: Number.isFinite(match.kills) ? match.kills : null,
      deaths: Number.isFinite(match.deaths) ? match.deaths : null,
      assists: Number.isFinite(match.assists) ? match.assists : null,
      gpm: Number.isFinite(match.gold_per_min) ? match.gold_per_min : null,
      xpm: Number.isFinite(match.xp_per_min) ? match.xp_per_min : null,
      lastHits: Number.isFinite(match.last_hits) ? match.last_hits : null,
      denies: Number.isFinite(match.denies) ? match.denies : null,
    }))
    .filter((match) => match.result);

  return {
    accountId: String(accountId),
    name: profile.profile.personaname || `Игрок ${accountId}`,
    avatarUrl: profile.profile.avatarfull || null,
    rankTier: Number.isInteger(profile.rank_tier) ? profile.rank_tier : null,
    leaderboardRank: Number.isInteger(profile.leaderboard_rank) ? profile.leaderboard_rank : null,
    sampleLimit: 100,
    analysis: analyzeRankedMatches(rankedMatches, now).overall,
  };
}

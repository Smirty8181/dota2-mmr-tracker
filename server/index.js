import "dotenv/config";
import cors from "cors";
import express from "express";
import cron from "node-cron";
import {
  fetchItemConstants,
  fetchHeroStats,
  fetchMatchDetails,
  fetchOpenDotaProfile,
  fetchProPlayers,
  fetchRecentMatches,
  getHeroImage,
  getHeroIcon,
  getHeroName,
  getItemDetails,
  getLaneName,
  normalizeAccountId,
  OpenDotaError,
  requestMatchParse,
} from "./opendota.js";
import { getHeroById } from "../shared/hero-catalog.js";
import { calculateRankedMmr } from "./mmr.js";
import { serializeRankedStats } from "./player-stats.js";
import { analyzeRankedMatches } from "./analytics.js";
import { buildComparisonSnapshot } from "./comparison.js";
import { buildItemTimingBenchmarks } from "./item-timings.js";
import { formatKda } from "./match-format.js";
import { buildMatchBreakdown } from "./match-details.js";
import { fetchHeroArtwork, HeroArtworkError } from "./hero-artwork.js";
import { createDatabase } from "./database.js";
import { parseMatchPagination } from "./match-pagination.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const { prisma, mode: databaseMode, close: closeDatabase } = await createDatabase();
const syncLocks = new Map();
const API_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: API_ORIGIN }));
app.use(express.json({ limit: "32kb" }));
app.use((request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getRankedResult(row) {
  if (typeof row.radiant_win !== "boolean" || !Number.isInteger(row.player_slot)) return null;
  const isRadiant = row.player_slot < 128;
  return isRadiant === row.radiant_win ? "WIN" : "LOSS";
}

function matchToCreateData(row, playerId, mmrChange = null) {
  const result = getRankedResult(row);
  if (!result || !row.match_id || !row.start_time) return null;
  const items = [row.item_0, row.item_1, row.item_2, row.item_3, row.item_4, row.item_5]
    .filter((item) => Number.isInteger(item) && item > 0);
  return {
    playerId,
    matchId: String(row.match_id),
    heroId: Number.isInteger(row.hero_id) ? row.hero_id : null,
    heroName: Number.isInteger(row.hero_id) ? getHeroName(row.hero_id) : null,
    result,
    isRanked: row.lobby_type === 7,
    mmrChange: row.lobby_type === 7 ? mmrChange : null,
    kills: Number.isInteger(row.kills) ? row.kills : null,
    deaths: Number.isInteger(row.deaths) ? row.deaths : null,
    assists: Number.isInteger(row.assists) ? row.assists : null,
    duration: Number.isInteger(row.duration) ? row.duration : null,
    gpm: Number.isInteger(row.gold_per_min) ? row.gold_per_min : null,
    xpm: Number.isInteger(row.xp_per_min) ? row.xp_per_min : null,
    lastHits: Number.isInteger(row.last_hits) ? row.last_hits : null,
    denies: Number.isInteger(row.denies) ? row.denies : null,
    lane: getLaneName(row),
    items,
    playedAt: new Date(row.start_time * 1000),
  };
}

function serializeMatch(match, itemConstants) {
  const seconds = match.duration || 0;
  return {
    ...match,
    hero: getHeroName(match.heroId),
    heroImage: getHeroImage(match.heroId),
    heroIcon: getHeroIcon(match.heroId),
    result: match.result === "WIN" ? "Победа" : "Поражение",
    kda: formatKda(match),
    durationLabel: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    mmr: match.mmrChange,
    date: match.playedAt.toISOString(),
    gold: Array.isArray(match.goldTimeline) ? match.goldTimeline : [],
    lastHitsTimeline: Array.isArray(match.lhTimeline) ? match.lhTimeline : [],
    xp: Array.isArray(match.xpTimeline) ? match.xpTimeline : [],
    itemImages: Array.isArray(match.items)
      ? match.items.map((itemId) => ({ id: itemId, ...getItemDetails(itemId, itemConstants) })).filter((item) => item.name && item.image)
      : [],
    purchaseLog: Array.isArray(match.purchaseLog) ? match.purchaseLog : [],
  };
}

async function loadAssetConstants() {
  const [itemsResult] = await Promise.allSettled([fetchItemConstants()]);
  const warnings = [];
  if (itemsResult.status === "rejected") {
    console.warn("Не удалось загрузить справочник предметов OpenDota:", itemsResult.reason);
    warnings.push("Изображения предметов временно недоступны.");
  }
  return {
    items: itemsResult.status === "fulfilled" ? itemsResult.value : {},
    warnings,
  };
}

async function getRecentRows(accountId, maximum = 500, stopAtMatchId = null) {
  const rows = [];
  for (let offset = 0; offset < maximum; offset += 100) {
    const page = await fetchRecentMatches(accountId, 100, offset);
    if (!Array.isArray(page)) throw new OpenDotaError("OpenDota вернул некорректный список матчей.", 502);
    rows.push(...page);
    if (stopAtMatchId && page.some((row) => String(row.match_id) === stopAtMatchId)) break;
    if (page.length < 100) break;
  }
  return rows;
}

async function syncPlayer(accountId) {
  if (syncLocks.has(accountId)) return syncLocks.get(accountId);
  const operation = (async () => {
    const player = await prisma.player.findUnique({ where: { accountId } });
    if (!player) throw new OpenDotaError("Профиль не найден. Сначала подключите игрока.", 404);

    const [profile, rows, assetConstants] = await Promise.all([
      fetchOpenDotaProfile(accountId),
      getRecentRows(accountId, 500, player.lastSyncedMatchId),
      loadAssetConstants(),
    ]);
    const rankTier = Number.isInteger(profile.rank_tier) ? profile.rank_tier : player.rankTier;
    const normalizedRows = rows
      .filter((row) => row && row.match_id && Number.isInteger(row.start_time))
      .sort((a, b) => b.start_time - a.start_time);
    const latestMatchId = normalizedRows[0] ? String(normalizedRows[0].match_id) : player.lastSyncedMatchId;
    let unseenRows = [];
    let historicalRows = [];

    if (player.lastSyncedMatchId) {
      const cursorIndex = normalizedRows.findIndex((row) => String(row.match_id) === player.lastSyncedMatchId);
      if (cursorIndex === -1 && normalizedRows.length) {
        throw new OpenDotaError("Не удалось найти сохранённую точку синхронизации среди последних 500 матчей. Синхронизация остановлена, чтобы не потерять матчи.", 409);
      }
      if (cursorIndex > 0) unseenRows = normalizedRows.slice(0, cursorIndex);
    } else {
      const lastSyncSeconds = player.lastSyncedAt ? Math.floor(player.lastSyncedAt.getTime() / 1000) : Number.POSITIVE_INFINITY;
      historicalRows = normalizedRows.filter((row) => row.start_time <= lastSyncSeconds && row.lobby_type === 7 && getRankedResult(row));
      unseenRows = normalizedRows.filter((row) => row.start_time > lastSyncSeconds && row.lobby_type === 7 && getRankedResult(row));
    }

    const newestFirst = player.lastSyncedMatchId ? unseenRows.filter((row) => row.lobby_type === 7 && getRankedResult(row)) : unseenRows;
    const newMatchData = [];
    const orderedNewMatches = [...newestFirst].reverse();
    const progression = calculateRankedMmr(
      player.estimatedMmr,
      player.personalBestMmr,
      orderedNewMatches.map(getRankedResult),
    );
    const estimate = progression.estimatedMmr;
    const best = progression.personalBestMmr;
    orderedNewMatches.forEach((row, index) => {
      const delta = progression.deltas[index];
      const data = matchToCreateData(row, player.id, delta);
      if (data) newMatchData.push(data);
    });
    newMatchData.push(...historicalRows
      .map((row) => matchToCreateData(row, player.id))
      .filter(Boolean));

    const updated = await prisma.$transaction(async (transaction) => {
      if (newMatchData.length) {
        await transaction.match.createMany({ data: newMatchData, skipDuplicates: true });
      }
      const refreshed = await transaction.player.update({
        where: { id: player.id },
        data: {
          personaName: profile.profile?.personaname || player.personaName,
          avatarUrl: profile.profile?.avatarfull || player.avatarUrl,
          rankTier,
          estimatedMmr: estimate,
          personalBestMmr: best,
          lastSyncedMatchId: latestMatchId,
          lastSyncedAt: new Date(),
        },
      });
      await transaction.rankSnapshot.upsert({
        where: { playerId_capturedOn: { playerId: player.id, capturedOn: getTodayUtcDate() } },
        create: {
          playerId: player.id,
          capturedOn: getTodayUtcDate(),
          rankTier,
          estimatedMmr: estimate,
        },
        update: {
          rankTier,
          estimatedMmr: estimate,
        },
      });
      return refreshed;
    });

    return {
      player: updated,
      syncedRankedMatches: newestFirst.length,
      importedHistoricalMatches: historicalRows.length,
      mmrChange: estimate - player.estimatedMmr,
      rankTier: rankTier ?? null,
      warnings: assetConstants.warnings,
    };
  })();

  syncLocks.set(accountId, operation);
  try {
    return await operation;
  } finally {
    syncLocks.delete(accountId);
  }
}

app.get("/api/health", async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: databaseMode, provider: "OpenDota", timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assets/heroes/:heroId", async (request, response, next) => {
  try {
    if (!/^\d{1,3}$/.test(request.params.heroId)) {
      return response.status(400).json({ error: "Некорректный ID героя." });
    }
    const image = await fetchHeroArtwork(Number(request.params.heroId));
    response.set({
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": image.contentType,
      "X-Content-Type-Options": "nosniff",
    });
    response.send(image.buffer);
  } catch (error) {
    if (error instanceof HeroArtworkError) {
      return response.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

app.get("/api/pro-players", async (_request, response, next) => {
  try {
    response.json(await fetchProPlayers());
  } catch (error) {
    next(error);
  }
});

app.post("/api/players", async (request, response, next) => {
  try {
    const body = request.body || {};
    const accountId = normalizeAccountId(body.accountId);
    const initialMmr = Number(body.initialMmr);
    if (!accountId) return response.status(400).json({ error: "Введите числовой Steam account ID или SteamID64." });
    if (!Number.isInteger(initialMmr) || initialMmr < 0 || initialMmr > 15000) {
      return response.status(400).json({ error: "MMR должен быть целым числом от 0 до 15000." });
    }

    const [profileResult, recentResult] = await Promise.allSettled([
      fetchOpenDotaProfile(accountId),
      fetchRecentMatches(accountId, 100),
    ]);
    if (profileResult.status === "rejected") throw profileResult.reason;
    const profile = profileResult.value;
    const recent = recentResult.status === "fulfilled" ? recentResult.value : [];
    const warnings = [];
    if (recentResult.status === "rejected") {
      console.warn("Не удалось загрузить историю матчей при регистрации профиля:", recentResult.reason);
      warnings.push("Профиль добавлен, но историю матчей пока не удалось загрузить. Повторите обновление позже.");
    }
    if (!Array.isArray(recent)) throw new OpenDotaError("OpenDota вернул некорректный список матчей.", 502);
    const existing = await prisma.player.findUnique({ where: { accountId } });
    if (existing) {
      const updated = await prisma.player.update({
        where: { id: existing.id },
        data: { personaName: profile.profile.personaname || existing.personaName, avatarUrl: profile.profile.avatarfull || existing.avatarUrl, rankTier: Number.isInteger(profile.rank_tier) ? profile.rank_tier : existing.rankTier },
      });
      return response.json({ player: updated, created: false, warnings });
    }

    const latestMatchId = recent[0]?.match_id ? String(recent[0].match_id) : null;
    const assetConstants = await loadAssetConstants();
    const player = await prisma.$transaction(async (transaction) => {
      const created = await transaction.player.create({
        data: {
          accountId,
          personaName: profile.profile.personaname || null,
          avatarUrl: profile.profile.avatarfull || null,
          rankTier: Number.isInteger(profile.rank_tier) ? profile.rank_tier : null,
          initialMmr,
          estimatedMmr: initialMmr,
          personalBestMmr: initialMmr,
          lastSyncedMatchId: latestMatchId,
          lastSyncedAt: new Date(),
        },
      });
      const history = recent
        .filter((row) => row.lobby_type === 7)
        .map((row) => matchToCreateData(row, created.id, 0))
        .filter(Boolean);
      if (history.length) await transaction.match.createMany({ data: history, skipDuplicates: true });
      await transaction.rankSnapshot.create({
        data: {
          playerId: created.id,
          capturedOn: getTodayUtcDate(),
          rankTier: Number.isInteger(profile.rank_tier) ? profile.rank_tier : null,
          estimatedMmr: initialMmr,
        },
      });
      return created;
    });
    response.status(201).json({ player, created: true, warnings: [...warnings, ...assetConstants.warnings] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/players/:accountId", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const player = await prisma.player.findUnique({
      where: { accountId },
      include: { rankSnapshots: { orderBy: { capturedOn: "asc" } } },
    });
    if (!player) return response.status(404).json({ error: "Профиль не найден." });
    const rankedWhere = { playerId: player.id, isRanked: true };
    const [recentMatches, rankedAggregate, wins, assetConstants] = await Promise.all([
      prisma.match.findMany({ where: { playerId: player.id }, orderBy: { playedAt: "desc" }, take: 30 }),
      prisma.match.aggregate({
        where: rankedWhere,
        _count: { _all: true },
        _avg: { gpm: true, xpm: true },
      }),
      prisma.match.count({ where: { ...rankedWhere, result: "WIN" } }),
      loadAssetConstants(),
    ]);
    const stats = serializeRankedStats({
      matches: rankedAggregate._count._all,
      wins,
      averageGpm: rankedAggregate._avg.gpm,
      averageXpm: rankedAggregate._avg.xpm,
    });
    response.json({
      player,
      rankSnapshots: player.rankSnapshots,
      stats,
      recentMatches: recentMatches.map((match) => serializeMatch(match, assetConstants.items)),
      warnings: assetConstants.warnings,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/players/:accountId/analytics", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const player = await prisma.player.findUnique({
      where: { accountId },
      select: { id: true },
    });
    if (!player) return response.status(404).json({ error: "Профиль не найден." });
    const matches = await prisma.match.findMany({
      where: { playerId: player.id, isRanked: true },
      orderBy: { playedAt: "desc" },
      select: {
        heroId: true,
        result: true,
        isRanked: true,
        mmrChange: true,
        kills: true,
        deaths: true,
        assists: true,
        gpm: true,
        xpm: true,
        lastHits: true,
        denies: true,
        duration: true,
        playedAt: true,
      },
    });
    response.json(analyzeRankedMatches(matches));
  } catch (error) {
    next(error);
  }
});

app.get("/api/compare/:firstAccountId/:secondAccountId", async (request, response, next) => {
  try {
    const accountIds = [
      normalizeAccountId(request.params.firstAccountId),
      normalizeAccountId(request.params.secondAccountId),
    ];
    if (accountIds.some((accountId) => !accountId)) {
      return response.status(400).json({ error: "Укажите два корректных Steam account ID." });
    }
    if (accountIds[0] === accountIds[1]) {
      return response.status(400).json({ error: "Выберите два разных Steam-профиля." });
    }

    const players = await Promise.all(accountIds.map(async (accountId) => {
      const [profile, matches] = await Promise.all([
        fetchOpenDotaProfile(accountId),
        fetchRecentMatches(accountId, 100),
      ]);
      return buildComparisonSnapshot(profile, matches);
    }));
    response.json({ sampleLimit: 100, players });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/players/:accountId/mmr", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    const mmr = Number((request.body || {}).mmr);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    if (!Number.isInteger(mmr) || mmr < 0 || mmr > 15000) {
      return response.status(400).json({ error: "MMR должен быть целым числом от 0 до 15000." });
    }
    const existing = await prisma.player.findUnique({ where: { accountId }, select: { id: true, personalBestMmr: true } });
    if (!existing) return response.status(404).json({ error: "Профиль не найден." });
    const player = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.player.update({
        where: { accountId },
        data: { estimatedMmr: mmr, personalBestMmr: Math.max(existing.personalBestMmr, mmr) },
      });
      await transaction.rankSnapshot.upsert({
        where: { playerId_capturedOn: { playerId: updated.id, capturedOn: getTodayUtcDate() } },
        create: { playerId: updated.id, capturedOn: getTodayUtcDate(), rankTier: updated.rankTier, estimatedMmr: mmr },
        update: { rankTier: updated.rankTier, estimatedMmr: mmr },
      });
      return updated;
    });
    response.json(player);
  } catch (error) {
    next(error);
  }
});

app.post("/api/players/:accountId/sync", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const result = await syncPlayer(accountId);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/players/:accountId/matches", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const pagination = parseMatchPagination(request.query);
    if (pagination.error) return response.status(400).json({ error: pagination.error });
    const player = await prisma.player.findUnique({ where: { accountId }, select: { id: true } });
    if (!player) return response.status(404).json({ error: "Профиль не найден." });
    const [matches, total, assetConstants] = await Promise.all([
      prisma.match.findMany({
        where: { playerId: player.id },
        orderBy: [{ playedAt: "desc" }, { matchId: "desc" }],
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.match.count({ where: { playerId: player.id } }),
      loadAssetConstants(),
    ]);
    response.json({
      matches: matches.map((match) => serializeMatch(match, assetConstants.items)),
      total,
      offset: pagination.offset,
      limit: pagination.limit,
      hasMore: pagination.offset + matches.length < total,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/players/:accountId/matches/:matchId/parse", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const player = await prisma.player.findUnique({ where: { accountId }, select: { id: true } });
    if (!player) return response.status(404).json({ error: "Профиль не найден." });
    const storedMatch = await prisma.match.findUnique({
      where: { playerId_matchId: { playerId: player.id, matchId: request.params.matchId } },
      select: { id: true },
    });
    if (!storedMatch) return response.status(404).json({ error: "Матч не найден в истории этого профиля." });
    const job = await requestMatchParse(request.params.matchId);
    response.json({ status: "queued", job });
  } catch (error) {
    next(error);
  }
});

app.get("/api/players/:accountId/matches/:matchId", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const player = await prisma.player.findUnique({ where: { accountId }, select: { id: true } });
    if (!player) return response.status(404).json({ error: "Профиль не найден." });
    const storedMatch = await prisma.match.findUnique({ where: { playerId_matchId: { playerId: player.id, matchId: request.params.matchId } } });
    if (!storedMatch) return response.status(404).json({ error: "Матч не найден в истории этого профиля." });
    const details = await fetchMatchDetails(request.params.matchId);
    const accountMatches = details.players.filter((entry) => String(entry.account_id) === accountId);
    let matchPlayer = accountMatches.length === 1 ? accountMatches[0] : null;
    if (!matchPlayer && Number.isInteger(storedMatch.heroId)) {
      const heroMatches = details.players.filter((entry) => entry.hero_id === storedMatch.heroId);
      if (heroMatches.length === 1) [matchPlayer] = heroMatches;
    }
    const assetConstants = await loadAssetConstants();
    const breakdown = buildMatchBreakdown(details, accountId, assetConstants.items, matchPlayer);
    const timelines = breakdown.timelines;
    const parsed = breakdown.teams.radiant.members.length === 5
      && breakdown.teams.dire.members.length === 5;
    const updateData = {};
    if (timelines.gold.length) updateData.goldTimeline = timelines.gold;
    if (timelines.lastHits.length) updateData.lhTimeline = timelines.lastHits;
    if (timelines.xp.length) updateData.xpTimeline = timelines.xp;
    if (Number.isInteger(matchPlayer?.gold_per_min)) updateData.gpm = matchPlayer.gold_per_min;
    if (Number.isInteger(matchPlayer?.xp_per_min)) updateData.xpm = matchPlayer.xp_per_min;
    if (Number.isInteger(matchPlayer?.last_hits)) updateData.lastHits = matchPlayer.last_hits;
    if (Number.isInteger(matchPlayer?.denies)) updateData.denies = matchPlayer.denies;
    if (Array.isArray(breakdown.selectedPlayer?.purchaseLog)) {
      updateData.purchaseLog = breakdown.selectedPlayer.purchaseLog;
    }
    const match = Object.keys(updateData).length
      ? await prisma.match.update({ where: { id: storedMatch.id }, data: updateData })
      : storedMatch;
    const itemTimingHistory = Number.isInteger(storedMatch.heroId)
      ? await prisma.match.findMany({
        where: {
          playerId: player.id,
          heroId: storedMatch.heroId,
          isRanked: true,
          matchId: { not: request.params.matchId },
        },
        orderBy: { playedAt: "desc" },
        take: 200,
        select: { result: true, purchaseLog: true },
      })
      : [];
    response.json({
      match: serializeMatch(match, assetConstants.items),
      parsed,
      timelines,
      ...breakdown,
      itemTimingBenchmarks: buildItemTimingBenchmarks(itemTimingHistory),
      warnings: assetConstants.warnings,
      player: matchPlayer ? {
        kills: matchPlayer.kills, deaths: matchPlayer.deaths, assists: matchPlayer.assists,
        gpm: matchPlayer.gold_per_min, xpm: matchPlayer.xp_per_min,
        lastHits: matchPlayer.last_hits, denies: matchPlayer.denies,
        heroDamage: matchPlayer.hero_damage, towerDamage: matchPlayer.tower_damage,
        lane: getLaneName(matchPlayer), netWorth: matchPlayer.net_worth,
        heroHealing: matchPlayer.hero_healing,
        items: [matchPlayer.item_0, matchPlayer.item_1, matchPlayer.item_2, matchPlayer.item_3, matchPlayer.item_4, matchPlayer.item_5].filter((item) => Number.isInteger(item) && item > 0),
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/players/:accountId/heroes", async (request, response, next) => {
  try {
    const accountId = normalizeAccountId(request.params.accountId);
    if (!accountId) return response.status(400).json({ error: "Некорректный Steam account ID." });
    const player = await prisma.player.findUnique({ where: { accountId }, select: { id: true } });
    if (!player) return response.status(404).json({ error: "Профиль не найден." });
    const [stats, assetConstants, matchGroups] = await Promise.all([
      fetchHeroStats(accountId),
      loadAssetConstants(),
      prisma.match.groupBy({
        by: ["heroId"],
        where: { playerId: player.id, isRanked: true, heroId: { not: null } },
        _avg: { gpm: true, xpm: true },
        _sum: { kills: true, deaths: true, assists: true },
        _count: { _all: true },
      }),
    ]);
    const matchGroupByHeroId = new Map(matchGroups.map((group) => [group.heroId, group]));
    const unknownHeroIds = stats
      .filter((hero) => !getHeroById(hero.hero_id))
      .map((hero) => hero.hero_id);
    if (unknownHeroIds.length) {
      console.warn("OpenDota вернул неизвестные ID героев; они исключены из списка:", unknownHeroIds);
    }
    const heroes = stats.flatMap((hero) => {
      const catalogHero = getHeroById(hero.hero_id);
      if (!catalogHero) return [];
      const group = matchGroupByHeroId.get(hero.hero_id);
      const games = Number.isInteger(hero.games) && hero.games > 0 ? hero.games : 0;
      const wins = Number.isInteger(hero.win) ? Math.min(games, Math.max(0, hero.win)) : 0;
      const kills = group?._sum.kills;
      const deaths = group?._sum.deaths;
      const assists = group?._sum.assists;
      return {
        id: hero.hero_id,
        name: catalogHero.displayName,
        apiName: catalogHero.apiName,
        russianName: catalogHero.russianName,
        aliases: catalogHero.aliases,
        image: catalogHero.portrait,
        iconImage: catalogHero.icon,
        renderImage: catalogHero.artwork,
        artImage: catalogHero.artwork,
        renderImageType: "official-hero-artwork",
        primaryAttribute: catalogHero.primaryAttribute,
        games,
        wins,
        winRate: games ? Math.round((wins / games) * 100) : null,
        gpm: group?._avg.gpm == null ? null : Math.round(group._avg.gpm),
        xpm: group?._avg.xpm == null ? null : Math.round(group._avg.xpm),
        kda: Number.isFinite(kills) && Number.isFinite(deaths) && Number.isFinite(assists)
          ? Number(((kills + assists) / Math.max(1, deaths)).toFixed(1))
          : null,
        sampledGames: group?._count._all || 0,
      };
    }).sort((a, b) => b.games - a.games || a.id - b.id);
    response.json(heroes);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof OpenDotaError) {
    if (error.retryAfter) response.setHeader("Retry-After", error.retryAfter);
    return response.status(error.status).json({ error: error.message, retryAfter: error.retryAfter || null });
  }
  console.error("API request failed:", error);
  if (error.code === "P2002") return response.status(409).json({ error: "Такая запись уже существует." });
  if (error.code === "P2025") return response.status(404).json({ error: "Профиль не найден." });
  if (error.code === "P1001" || error.code === "ECONNREFUSED") {
    return response.status(503).json({ error: "База PostgreSQL недоступна. Проверьте DATABASE_URL и запустите PostgreSQL." });
  }
  response.status(500).json({ error: "Не удалось обработать запрос. Подробности записаны в журнал сервера." });
});

cron.schedule("15 3 * * *", async () => {
  try {
    const players = await prisma.player.findMany({ select: { accountId: true } });
    for (const player of players) {
      try {
        await syncPlayer(player.accountId);
      } catch (error) {
        console.error(`Ежедневная синхронизация профиля ${player.accountId} завершилась ошибкой:`, error);
      }
    }
  } catch (error) {
    console.error("Не удалось получить профили для ежедневной синхронизации:", error);
  }
}, { timezone: "UTC" });

const server = app.listen(port, () => {
  console.log(`Dota2 MMR Tracker API запущен на http://localhost:${port}; база: ${databaseMode}`);
});

async function shutdown() {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await closeDatabase();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function average(rows, field) {
  const values = rows.map((row) => row[field]).filter(Number.isFinite);
  return {
    value: values.length
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
      : null,
    sample: values.length,
  };
}

function summarizeMatches(rows) {
  const wins = rows.filter((row) => row.result === "WIN").length;
  const losses = rows.length - wins;
  const kdaRows = rows.filter((row) =>
    Number.isFinite(row.kills) && Number.isFinite(row.deaths) && Number.isFinite(row.assists),
  );
  const totalKills = kdaRows.reduce((sum, row) => sum + row.kills, 0);
  const totalDeaths = kdaRows.reduce((sum, row) => sum + row.deaths, 0);
  const totalAssists = kdaRows.reduce((sum, row) => sum + row.assists, 0);

  return {
    matches: rows.length,
    wins,
    losses,
    winRate: rows.length ? Math.round((wins / rows.length) * 100) : null,
    averageKda: kdaRows.length ? Number(((totalKills + totalAssists) / Math.max(1, totalDeaths)).toFixed(2)) : null,
    kdaSample: kdaRows.length,
    averageKills: average(rows, "kills"),
    averageDeaths: average(rows, "deaths"),
    averageAssists: average(rows, "assists"),
    averageDuration: average(rows, "duration"),
    averageGpm: average(rows, "gpm"),
    averageXpm: average(rows, "xpm"),
    averageLastHits: average(rows, "lastHits"),
    averageDenies: average(rows, "denies"),
    mmrDelta: rows.some((row) => Number.isFinite(row.mmrChange))
      ? rows.reduce((sum, row) => sum + (Number.isFinite(row.mmrChange) ? row.mmrChange : 0), 0)
      : null,
    mmrDeltaSample: rows.filter((row) => Number.isFinite(row.mmrChange)).length,
  };
}

function summarizeHeroes(rows) {
  const heroMap = new Map();
  for (const match of rows) {
    if (!Number.isInteger(match.heroId)) continue;
    const group = heroMap.get(match.heroId) || [];
    group.push(match);
    heroMap.set(match.heroId, group);
  }
  return [...heroMap.entries()]
    .map(([heroId, matches]) => ({
      heroId,
      ...summarizeMatches(matches),
    }))
    .sort((first, second) => second.matches - first.matches || first.heroId - second.heroId);
}

function countLongestStreak(rows, result) {
  let longest = 0;
  let current = 0;
  for (const row of rows) {
    current = row.result === result ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function analyzeRankedMatches(matches, now = new Date()) {
  const validMatches = (Array.isArray(matches) ? matches : [])
    .filter((match) => match && match.isRanked === true && (match.result === "WIN" || match.result === "LOSS"))
    .map((match) => ({ ...match, playedAt: toValidDate(match.playedAt) }))
    .filter((match) => match.playedAt)
    .sort((left, right) => right.playedAt - left.playedAt);

  const recent = validMatches.slice(0, 10);
  const previous = validMatches.slice(10, 20);
  const currentResult = recent[0]?.result || null;
  let currentStreak = 0;
  for (const match of validMatches) {
    if (match.result !== currentResult) break;
    currentStreak += 1;
  }
  const chronological = [...validMatches].reverse();
  const currentDate = toValidDate(now) || new Date();
  const currentTime = currentDate.getTime();
  const periods = Object.fromEntries([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
  ].map(([key, days]) => {
    const windowMilliseconds = days * 24 * 60 * 60 * 1000;
    const currentStart = currentTime - windowMilliseconds;
    const previousStart = currentStart - windowMilliseconds;
    const currentMatches = validMatches.filter((match) => {
      const time = match.playedAt.getTime();
      return time >= currentStart && time <= currentTime;
    });
    const previousMatches = validMatches.filter((match) => {
      const time = match.playedAt.getTime();
      return time >= previousStart && time < currentStart;
    });
    return [key, {
      days,
      current: summarizeMatches(currentMatches),
      previous: summarizeMatches(previousMatches),
      heroes: summarizeHeroes(currentMatches),
    }];
  }));
  periods.all = {
    days: null,
    current: summarizeMatches(validMatches),
    previous: null,
    heroes: summarizeHeroes(validMatches),
  };
  const weekStart = new Date(Date.UTC(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    currentDate.getUTCDate() - 6,
  ));
  const weekMatches = validMatches.filter((match) => match.playedAt >= weekStart && match.playedAt <= currentDate);
  const activityByDate = new Map();
  for (const match of weekMatches) {
    const key = match.playedAt.toISOString().slice(0, 10);
    const activity = activityByDate.get(key) || { date: key, matches: 0, wins: 0, losses: 0 };
    activity.matches += 1;
    if (match.result === "WIN") activity.wins += 1;
    else activity.losses += 1;
    activityByDate.set(key, activity);
  }
  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return activityByDate.get(key) || { date: key, matches: 0, wins: 0, losses: 0 };
  });

  return {
    overall: summarizeMatches(validMatches),
    periods,
    recent: {
      ...summarizeMatches(recent),
      window: recent.length,
      currentStreak: currentResult ? { result: currentResult, matches: currentStreak } : null,
      longestWinStreak: countLongestStreak(chronological, "WIN"),
      longestLossStreak: countLongestStreak(chronological, "LOSS"),
      previousWindow: previous.length ? summarizeMatches(previous) : null,
    },
    lastSevenDays: summarizeMatches(weekMatches),
    weeklyActivity,
    heroes: summarizeHeroes(validMatches),
  };
}

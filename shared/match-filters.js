function matchTimestamp(match) {
  const value = new Date(match.playedAt).getTime();
  return Number.isFinite(value) ? value : null;
}

export function filterAndSortMatches(matches, {
  query = "",
  result = "all",
  hero = "all",
  periodDays = null,
  duration = "all",
  sortOrder = "newest",
  now = Date.now(),
} = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const earliestDate = Number.isFinite(periodDays) && periodDays > 0
    ? now - periodDays * 24 * 60 * 60 * 1000
    : null;

  return matches
    .map((item, index) => ({ item, index, playedAt: matchTimestamp(item) }))
    .filter(({ item, playedAt }) => {
      if (!`${item.hero} ${item.result} ${item.matchId}`.toLocaleLowerCase("ru-RU").includes(normalizedQuery)) return false;
      if (result === "win" && item.result !== "Победа") return false;
      if (result === "loss" && item.result !== "Поражение") return false;
      if (hero !== "all" && item.hero !== hero) return false;
      if (earliestDate != null && (playedAt == null || playedAt < earliestDate || playedAt > now)) return false;
      if (duration !== "all") {
        if (!Number.isFinite(item.duration)) return false;
        if (duration === "short" && item.duration >= 30 * 60) return false;
        if (duration === "medium" && (item.duration < 30 * 60 || item.duration > 45 * 60)) return false;
        if (duration === "long" && item.duration <= 45 * 60) return false;
      }
      return true;
    })
    .sort((first, second) => {
      if (sortOrder === "oldest") {
        return (first.playedAt ?? Number.MAX_SAFE_INTEGER) - (second.playedAt ?? Number.MAX_SAFE_INTEGER)
          || first.index - second.index;
      }
      if (sortOrder === "longest") {
        return (second.item.duration ?? -1) - (first.item.duration ?? -1) || first.index - second.index;
      }
      if (sortOrder === "shortest") {
        return (first.item.duration ?? Number.MAX_SAFE_INTEGER) - (second.item.duration ?? Number.MAX_SAFE_INTEGER)
          || first.index - second.index;
      }
      return (second.playedAt ?? -1) - (first.playedAt ?? -1) || first.index - second.index;
    })
    .map(({ item, index }) => ({ item, index }));
}

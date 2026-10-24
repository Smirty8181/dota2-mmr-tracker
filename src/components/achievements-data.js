function getCurrentWinStreak(matches) {
  let streak = 0;
  for (const match of matches) {
    if (match.result !== "Победа") break;
    streak += 1;
  }
  return streak;
}

export function buildAchievementProgress({ totalRankedMatches, startingMmr, personalBestMmr, matches = [] }) {
  const matchCount = Number.isInteger(totalRankedMatches) ? totalRankedMatches : null;
  const currentWinStreak = getCurrentWinStreak(matches);
  const peakKnown = Number.isInteger(startingMmr) && Number.isInteger(personalBestMmr);
  const peakImproved = peakKnown && personalBestMmr > startingMmr;

  return [
    {
      id: "first-ranked-match",
      title: "Первый рейтинг",
      description: "Сыграйте первый сохранённый рейтинговый матч.",
      current: matchCount,
      target: 1,
      unlocked: matchCount != null && matchCount >= 1,
    },
    {
      id: "ten-ranked-matches",
      title: "Вкатился",
      description: "Накопите 10 сохранённых рейтинговых матчей.",
      current: matchCount,
      target: 10,
      unlocked: matchCount != null && matchCount >= 10,
    },
    {
      id: "hundred-ranked-matches",
      title: "Ветеран",
      description: "Накопите 100 сохранённых рейтинговых матчей.",
      current: matchCount,
      target: 100,
      unlocked: matchCount != null && matchCount >= 100,
    },
    {
      id: "personal-best",
      title: "Новый пик",
      description: "Превысьте стартовый расчётный MMR.",
      current: peakKnown ? personalBestMmr : null,
      target: peakKnown ? startingMmr : null,
      unlocked: peakImproved,
    },
    {
      id: "three-win-streak",
      title: "Триумфальная серия",
      description: "Выиграйте три матча подряд в текущей сохранённой выборке.",
      current: currentWinStreak,
      target: 3,
      unlocked: currentWinStreak >= 3,
    },
  ];
}

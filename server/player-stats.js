export function serializeRankedStats({ matches, wins, averageGpm, averageXpm }) {
  const totalMatches = Number.isInteger(matches) && matches > 0 ? matches : 0;
  const totalWins = Number.isInteger(wins) ? Math.min(totalMatches, Math.max(0, wins)) : 0;

  return {
    matches: totalMatches,
    totalMatches,
    wins: totalWins,
    losses: totalMatches - totalWins,
    winRate: totalMatches ? Math.round((totalWins / totalMatches) * 100) : null,
    averageGpm: Number.isFinite(averageGpm) ? Math.round(averageGpm) : null,
    averageXpm: Number.isFinite(averageXpm) ? Math.round(averageXpm) : null,
  };
}

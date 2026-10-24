export const MMR_PER_RANKED_MATCH = 25;

export function calculateRankedMmr(initialMmr, personalBestMmr, results) {
  let estimatedMmr = initialMmr;
  let bestMmr = personalBestMmr;
  const deltas = [];

  for (const result of results) {
    const delta = result === "WIN"
      ? MMR_PER_RANKED_MATCH
      : -Math.min(MMR_PER_RANKED_MATCH, estimatedMmr);
    estimatedMmr += delta;
    bestMmr = Math.max(bestMmr, estimatedMmr);
    deltas.push(delta);
  }

  return { estimatedMmr, personalBestMmr: bestMmr, deltas };
}

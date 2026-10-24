function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((first, second) => first - second);
  const middle = Math.floor(ordered.length / 2);
  return Math.round(ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2);
}

function getMatchPurchases(purchaseLog) {
  if (!Array.isArray(purchaseLog)) return new Map();
  const purchases = new Map();
  for (const item of purchaseLog) {
    if (!Number.isInteger(item?.id) || item.id <= 0 || !Number.isFinite(item.time) || item.time < 0) continue;
    const current = purchases.get(item.id);
    if (!current) {
      purchases.set(item.id, {
        id: item.id,
        name: typeof item.name === "string" && item.name.trim() ? item.name : `Предмет ${item.id}`,
        image: typeof item.image === "string" ? item.image : null,
        time: Math.round(item.time),
      });
      continue;
    }
    if (item.time < current.time) current.time = Math.round(item.time);
    if (typeof item.name === "string" && item.name.trim()) current.name = item.name;
    if (typeof item.image === "string") current.image = item.image;
  }
  return purchases;
}

export function buildItemTimingBenchmarks(matches) {
  const validMatches = matches.filter((match) =>
    (match.result === "WIN" || match.result === "LOSS") && Array.isArray(match.purchaseLog),
  );
  const wins = validMatches.filter((match) => match.result === "WIN");
  const losses = validMatches.filter((match) => match.result === "LOSS");
  const itemIds = new Set();
  const parsedMatches = validMatches.map((match) => {
    const purchases = getMatchPurchases(match.purchaseLog);
    for (const id of purchases.keys()) itemIds.add(id);
    return { result: match.result, purchases };
  });

  const items = [...itemIds].map((id) => {
    const samples = parsedMatches.flatMap((match) => {
      const purchase = match.purchases.get(id);
      return purchase ? [{ result: match.result, ...purchase }] : [];
    });
    const winSamples = samples.filter((sample) => sample.result === "WIN");
    const lossSamples = samples.filter((sample) => sample.result === "LOSS");
    const item = samples[0];
    return {
      id,
      name: item.name,
      image: item.image,
      win: {
        medianSeconds: median(winSamples.map((sample) => sample.time)),
        samples: winSamples.length,
        matchRate: wins.length ? Math.round((winSamples.length / wins.length) * 100) : null,
      },
      loss: {
        medianSeconds: median(lossSamples.map((sample) => sample.time)),
        samples: lossSamples.length,
        matchRate: losses.length ? Math.round((lossSamples.length / losses.length) * 100) : null,
      },
    };
  });

  return {
    sampleMatches: validMatches.length,
    wins: wins.length,
    losses: losses.length,
    items: items.sort((first, second) =>
      (second.win.matchRate ?? -1) - (first.win.matchRate ?? -1)
      || second.win.samples - first.win.samples
      || first.id - second.id,
    ),
  };
}

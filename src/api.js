const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch {
    throw new Error("Не удалось подключиться к API. Проверьте, запущен ли сервер.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`API вернул некорректный ответ (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const errorMessage = typeof data?.error === "string" ? data.error : `Ошибка запроса (${response.status}).`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.retryAfter = data.retryAfter;
    throw error;
  }
  return data;
}

function normalizeMatch(match) {
  const playedAt = new Date(match.playedAt);
  const kdaValues = typeof match.kda === "string" ? match.kda.split(" / ") : [];
  const parseKda = (value, index) => {
    const candidate = match[["kills", "deaths", "assists"][index]] ?? value;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && candidate !== "" && candidate !== null ? parsed : null;
  };
  const [kills, deaths, assists] = [0, 1, 2].map((index) => parseKda(kdaValues[index], index));
  return {
    ...match,
    playedAt: match.date || match.playedAt,
    mark: match.hero.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    color: "red",
    art: match.heroIcon,
    image: match.heroImage,
    date: playedAt.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    gold: match.gold || [],
    lastHitsTimeline: match.lastHitsTimeline || [],
    lastHits: match.lastHitsTimeline || [],
    lh: match.lastHits ?? null,
    kills,
    deaths,
    assists,
    items: Array.isArray(match.items) ? match.items : [],
    itemImages: Array.isArray(match.itemImages) ? match.itemImages : [],
  };
}

export const api = {
  assetUrl: (path) => `${API_BASE}${path}`,
  register: (accountId, initialMmr) => request("/players", {
    method: "POST",
    body: JSON.stringify({ accountId, initialMmr }),
  }),
  profile: (accountId) => request(`/players/${encodeURIComponent(accountId)}`),
  analytics: (accountId) => request(`/players/${encodeURIComponent(accountId)}/analytics`),
  compare: (firstAccountId, secondAccountId) => request(
    `/compare/${encodeURIComponent(firstAccountId)}/${encodeURIComponent(secondAccountId)}`,
  ),
  correctMmr: (accountId, mmr) => request(`/players/${encodeURIComponent(accountId)}/mmr`, {
    method: "PATCH",
    body: JSON.stringify({ mmr }),
  }),
  sync: (accountId) => request(`/players/${encodeURIComponent(accountId)}/sync`, { method: "POST" }),
  matches: async (accountId) => (await api.matchPage(accountId)).matches,
  matchPage: async (accountId, offset = 0, limit = 100) => {
    const page = await request(
      `/players/${encodeURIComponent(accountId)}/matches?limit=${limit}&offset=${offset}`,
    );
    if (!Array.isArray(page.matches)
      || !Number.isSafeInteger(page.total)
      || page.total < 0
      || page.offset !== offset
      || !Number.isSafeInteger(page.limit)
      || page.limit < 1
      || page.matches.length > page.limit
      || typeof page.hasMore !== "boolean") {
      throw new Error("API вернул некорректную страницу истории матчей.");
    }
    return { ...page, matches: page.matches.map(normalizeMatch) };
  },
  proPlayers: () => request("/pro-players"),
  heroes: async (accountId) => (await request(`/players/${encodeURIComponent(accountId)}/heroes`)).map((hero) => ({
    ...hero,
    mark: hero.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    color: "red",
    art: hero.iconImage || hero.image,
    win: hero.winRate,
    kda: hero.kda == null ? null : hero.kda.toFixed(1),
  })),
  matchDetails: (accountId, matchId) => request(`/players/${encodeURIComponent(accountId)}/matches/${encodeURIComponent(matchId)}`),
  requestMatchParse: (accountId, matchId) => request(
    `/players/${encodeURIComponent(accountId)}/matches/${encodeURIComponent(matchId)}/parse`,
    { method: "POST" },
  ),
};

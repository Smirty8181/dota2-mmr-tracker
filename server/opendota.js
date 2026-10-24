import { getHeroById } from "../shared/hero-catalog.js";

const API_BASE = "https://api.opendota.com/api";
const REQUEST_TIMEOUT_MS = 12_000;
const constantsCache = {
  heroes: null,
  items: null,
  proPlayers: null,
  heroesExpiresAt: 0,
  itemsExpiresAt: 0,
  proPlayersExpiresAt: 0,
  heroesRequest: null,
  itemsRequest: null,
  proPlayersRequest: null,
};

export class OpenDotaError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "OpenDotaError";
    this.status = status;
  }
}

export function normalizeAccountId(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,17}$/.test(raw)) return null;
  const numeric = BigInt(raw);
  const steam64Offset = 76561197960265728n;
  const accountId = numeric >= steam64Offset ? numeric - steam64Offset : numeric;
  if (accountId < 1n || accountId > 4294967295n) return null;
  return accountId.toString();
}

async function request(path, { query = {}, timeoutMs = REQUEST_TIMEOUT_MS, method = "GET" } = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  if (process.env.OPENDOTA_API_KEY) url.searchParams.set("api_key", process.env.OPENDOTA_API_KEY);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new OpenDotaError("OpenDota не ответил вовремя. Попробуйте ещё раз позже.", 504);
    }
    throw new OpenDotaError("Не удалось подключиться к OpenDota.", 502);
  }

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    if (response.status === 429) {
      const error = new OpenDotaError("Лимит OpenDota исчерпан. Повторите попытку позже или добавьте API-ключ.", 429);
      error.retryAfter = response.headers.get("retry-after");
      throw error;
    }
    if (response.status === 404) throw new OpenDotaError("Профиль или матч не найден в OpenDota.", 404);
    if (response.status === 400) {
      const message = typeof data?.error === "string" ? data.error : "OpenDota не смог обработать запрос. Проверьте публичность профиля.";
      throw new OpenDotaError(message, 422);
    }
    throw new OpenDotaError(`Ошибка OpenDota (${response.status}).`, 502);
  }
  if (data && typeof data === "object" && typeof data.error === "string") {
    throw new OpenDotaError(data.error, 422);
  }
  return data;
}

export async function fetchOpenDotaProfile(accountId) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) throw new OpenDotaError("Укажите числовой Steam account ID или SteamID64.", 400);
  const profile = await request(`/players/${normalized}`);
  if (!profile || !profile.profile?.account_id) {
    throw new OpenDotaError("OpenDota не нашёл публичный профиль. Проверьте Steam ID и включите Expose Public Match Data в Dota 2.", 404);
  }
  return profile;
}

export async function fetchRecentMatches(accountId, limit = 30, offset = 0) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) throw new OpenDotaError("Укажите корректный Steam account ID.", 400);
  const matches = await request(`/players/${normalized}/matches`, {
    query: {
      significant: 0,
      limit: Math.min(100, Math.max(1, Number(limit) || 30)),
      offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    },
  });
  if (!Array.isArray(matches)) throw new OpenDotaError("OpenDota вернул некорректный список матчей.", 502);
  return matches;
}

export async function fetchHeroStats(accountId) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) throw new OpenDotaError("Укажите корректный Steam account ID.", 400);
  const heroes = await request(`/players/${normalized}/heroes`);
  if (!Array.isArray(heroes)) throw new OpenDotaError("OpenDota вернул некорректную статистику героев.", 502);
  return heroes;
}

export async function fetchProPlayers() {
  if (constantsCache.proPlayers && constantsCache.proPlayersExpiresAt > Date.now()) {
    return constantsCache.proPlayers;
  }
  if (constantsCache.proPlayersRequest) return constantsCache.proPlayersRequest;
  constantsCache.proPlayersRequest = (async () => {
    try {
      const data = await request("/proPlayers", { timeoutMs: 20_000 });
      if (!Array.isArray(data) || data.some((player) =>
        !player
        || !Number.isInteger(player.account_id)
        || !(typeof player.name === "string" && player.name.trim())
          && !(typeof player.personaname === "string" && player.personaname.trim()),
      )) {
        throw new OpenDotaError("OpenDota вернул некорректный список профессиональных игроков.", 502);
      }
      constantsCache.proPlayers = data.map((player) => ({
        accountId: String(player.account_id),
        name: player.name?.trim() || player.personaname?.trim(),
        avatarUrl: typeof player.avatarfull === "string" ? player.avatarfull : null,
        countryCode: typeof player.country_code === "string" ? player.country_code : null,
        teamId: Number.isInteger(player.team_id) ? player.team_id : null,
        teamName: typeof player.team_name === "string" && player.team_name.trim() ? player.team_name.trim() : null,
      }));
      constantsCache.proPlayersExpiresAt = Date.now() + 5 * 60 * 1000;
      return constantsCache.proPlayers;
    } finally {
      constantsCache.proPlayersRequest = null;
    }
  })();
  return constantsCache.proPlayersRequest;
}

export async function fetchMatchDetails(matchId) {
  if (!/^\d{1,20}$/.test(String(matchId))) throw new OpenDotaError("Некорректный ID матча.", 400);
  const match = await request(`/matches/${encodeURIComponent(matchId)}`);
  if (!match || typeof match !== "object" || !Array.isArray(match.players)) {
    throw new OpenDotaError("OpenDota вернул некорректные данные матча.", 502);
  }
  return match;
}

export async function requestMatchParse(matchId) {
  if (!/^\d{1,20}$/.test(String(matchId))) throw new OpenDotaError("Некорректный ID матча.", 400);
  return request(`/request/${encodeURIComponent(matchId)}`, { method: "POST" });
}

export async function fetchHeroConstants() {
  if (constantsCache.heroes && constantsCache.heroesExpiresAt > Date.now()) return constantsCache.heroes;
  if (constantsCache.heroesRequest) return constantsCache.heroesRequest;
  constantsCache.heroesRequest = (async () => {
    const data = await request("/constants/heroes", { timeoutMs: 20_000 });
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new OpenDotaError("OpenDota вернул некорректный список героев.", 502);
    }
    constantsCache.heroes = data;
    constantsCache.heroesExpiresAt = Date.now() + 60 * 60 * 1000;
    return data;
  })().finally(() => {
    constantsCache.heroesRequest = null;
  });
  return constantsCache.heroesRequest;
}

export async function fetchItemConstants() {
  if (constantsCache.items && constantsCache.itemsExpiresAt > Date.now()) return constantsCache.items;
  if (constantsCache.itemsRequest) return constantsCache.itemsRequest;
  constantsCache.itemsRequest = (async () => {
    const data = await request("/constants/items", { timeoutMs: 20_000 });
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new OpenDotaError("OpenDota вернул некорректный список предметов.", 502);
    }
    constantsCache.items = Object.fromEntries(
      Object.entries(data)
        .filter(([, item]) => Number.isInteger(item?.id) && typeof item.img === "string")
        .map(([name, item]) => [String(item.id), {
          name: item.dname || name,
          image: `https://cdn.cloudflare.steamstatic.com${item.img.replace(/\?$/, "")}`,
        }]),
    );
    constantsCache.itemsExpiresAt = Date.now() + 60 * 60 * 1000;
    return constantsCache.items;
  })().finally(() => {
    constantsCache.itemsRequest = null;
  });
  return constantsCache.itemsRequest;
}

export function getItemDetails(itemId, constants) {
  return constants?.[String(itemId)] || null;
}

export function getHeroName(heroId) {
  return getHeroById(heroId)?.displayName || "Неизвестный герой";
}

export function getHeroImage(heroId) {
  return getHeroById(heroId)?.portrait || null;
}

export function getHeroIcon(heroId) {
  return getHeroById(heroId)?.icon || null;
}

export function getHeroRenderImage(heroId) {
  return getHeroById(heroId)?.artwork || null;
}

export function getLaneName(match) {
  if (match.is_roaming) return "Роум";
  return ({ 1: "Лёгкая", 2: "Мид", 3: "Сложная", 4: "Лес" })[match.lane_role] || "Не указана";
}

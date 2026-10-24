import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const VALVE_HERO_LIST_URL = "https://www.dota2.com/datafeed/herolist?language=russian";
const OPENDOTA_HERO_CONSTANTS_URL = "https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json";
const CDN_ORIGIN = "https://cdn.cloudflare.steamstatic.com";
const OUTPUT_PATH = resolve("shared", "hero-catalog.data.js");

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}: HTTP ${response.status}`);
  return response.json();
}

function requireImagePath(path, heroId, field) {
  if (typeof path !== "string" || !path.startsWith("/apps/dota2/images/dota_react/heroes/")) {
    throw new Error(`OpenDota вернул неподтверждённый путь ${field} для героя ${heroId}.`);
  }
  return `${CDN_ORIGIN}${path.replace(/\?$/, "")}`;
}

const [officialResponse, communityConstants] = await Promise.all([
  fetchJson(VALVE_HERO_LIST_URL),
  fetchJson(OPENDOTA_HERO_CONSTANTS_URL),
]);

const officialHeroes = officialResponse?.result?.data?.heroes;
if (!Array.isArray(officialHeroes) || !communityConstants || typeof communityConstants !== "object") {
  throw new Error("Источники вернули некорректный каталог героев.");
}

const officialById = new Map();
for (const hero of officialHeroes) {
  if (!Number.isInteger(hero.id) || officialById.has(hero.id)) {
    throw new Error(`Официальный каталог содержит повторяющийся или неверный ID: ${hero.id}.`);
  }
  officialById.set(hero.id, hero);
}

const heroCatalogData = officialHeroes.map((official) => {
  const metadata = communityConstants[String(official.id)];
  if (!metadata || metadata.id !== official.id || metadata.name !== official.name) {
    throw new Error(`Не совпали ID или API-имя героя ${official.id} между Valve и OpenDota.`);
  }
  const displayName = official.name_english_loc || metadata.localized_name;
  if (typeof displayName !== "string" || !displayName.trim()) {
    throw new Error(`У героя ${official.id} нет подтверждённого английского названия.`);
  }
  const apiShortName = official.name.replace(/^npc_dota_hero_/, "");
  const possibleRussianName = official.name_loc;
  const russianName = typeof possibleRussianName === "string" && /[А-Яа-яЁё]/u.test(possibleRussianName)
    ? possibleRussianName
    : null;
  const aliases = [...new Set([
    displayName,
    russianName,
    metadata.localized_name,
    apiShortName.replace(/_/g, " "),
    official.name,
  ].filter((alias) => typeof alias === "string" && alias.trim()))];
  const artwork = requireImagePath(metadata.img, official.id, "artwork");
  const icon = requireImagePath(metadata.icon, official.id, "icon");
  const portrait = official.id === 135
    ? artwork
    : `${CDN_ORIGIN}/apps/dota2/images/heroes/${apiShortName}_full.png`;

  return {
    id: official.id,
    apiName: official.name,
    displayName: displayName.trim(),
    russianName,
    aliases,
    primaryAttribute: metadata.primary_attr || null,
    attackType: metadata.attack_type || null,
    roles: Array.isArray(metadata.roles) ? metadata.roles : [],
    portrait,
    icon,
    artwork,
  };
});

const ids = new Set(heroCatalogData.map((hero) => hero.id));
if (ids.size !== heroCatalogData.length || ids.size !== Object.keys(communityConstants).length) {
  throw new Error("Наборы ID героев Valve и OpenDota не совпадают.");
}

const normalizedNames = new Map();
for (const hero of heroCatalogData) {
  const key = hero.displayName.normalize("NFKC").trim().toLocaleLowerCase("en");
  const existing = normalizedNames.get(key);
  if (existing && existing !== hero.id) {
    throw new Error(`Официальное название "${hero.displayName}" неоднозначно между героями.`);
  }
  normalizedNames.set(key, hero.id);
}

const output = `export const HERO_CATALOG_SOURCE = Object.freeze({
  valve: ${JSON.stringify(VALVE_HERO_LIST_URL)},
  openDota: ${JSON.stringify(OPENDOTA_HERO_CONSTANTS_URL)},
});

export const heroCatalogData = ${JSON.stringify(heroCatalogData, null, 2)};
`;

await writeFile(OUTPUT_PATH, output, "utf8");
console.log(`Сохранено ${heroCatalogData.length} героев из каталогов Valve и OpenDota: ${OUTPUT_PATH}`);

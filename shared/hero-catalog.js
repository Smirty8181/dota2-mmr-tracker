import { heroCatalogData } from "./hero-catalog.data.js";

export const HERO_CATALOG = Object.freeze(heroCatalogData.map((hero) => Object.freeze(hero)));
export const HERO_BY_ID = new Map(HERO_CATALOG.map((hero) => [hero.id, hero]));

function normalizeAlias(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru-RU")
    .replace(/[^a-z0-9а-яё]+/giu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const heroByAlias = new Map();
const ambiguousAliases = new Set();
for (const hero of HERO_CATALOG) {
  for (const alias of [hero.displayName, hero.russianName, ...hero.aliases]) {
    const normalized = normalizeAlias(alias);
    if (!normalized || ambiguousAliases.has(normalized)) continue;
    const existing = heroByAlias.get(normalized);
    if (existing && existing.id !== hero.id) {
      heroByAlias.delete(normalized);
      ambiguousAliases.add(normalized);
      continue;
    }
    heroByAlias.set(normalized, hero);
  }
}

export function getHeroById(heroId) {
  const id = Number(heroId);
  return Number.isInteger(id) ? HERO_BY_ID.get(id) || null : null;
}

export function resolveHeroAnswer(answer) {
  const normalized = normalizeAlias(answer);
  return normalized ? heroByAlias.get(normalized) || null : null;
}

export function isCorrectHeroAnswer(answer, heroId) {
  const hero = resolveHeroAnswer(answer);
  return Boolean(hero && hero.id === Number(heroId));
}

export function normalizeHeroName(value) {
  return normalizeAlias(value);
}
